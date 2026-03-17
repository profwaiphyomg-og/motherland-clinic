const express = require('express');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');
const TelegramBot = require('node-telegram-bot-api');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'data.json');

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Data management
function loadData() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    }
  } catch (e) {
    console.error('Failed to load data:', e);
  }
  return { patients: [], settings: { ticketCounter: 0, lastResetDate: new Date().toISOString().split('T')[0] } };
}

function saveData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

// Initialize data
let data = loadData();

// Telegram Bot - Get token from environment or use placeholder
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN || '';
let bot = null;
const userChatIds = new Map(); // username -> chatId

if (TELEGRAM_TOKEN) {
  try {
    bot = new TelegramBot(TELEGRAM_TOKEN, { polling: true });
    console.log('✅ Telegram bot initialized');

    // Handle /start commands to record chat IDs
    bot.onText(/\/start/, (msg) => {
      const chatId = msg.chat.id;
      const username = msg.from.username;
      if (username) {
        userChatIds.set(username.toLowerCase(), chatId);
        bot.sendMessage(chatId, '🌸 Welcome to Motherland Clinic! You will receive notifications when the doctor is ready for you.');
        console.log(`📱 Registered chat for @${username}: ${chatId}`);
      }
    });

    // Handle any message to capture chat ID
    bot.on('message', (msg) => {
      const chatId = msg.chat.id;
      const username = msg.from.username;
      if (username && !userChatIds.has(username.toLowerCase())) {
        userChatIds.set(username.toLowerCase(), chatId);
        console.log(`📱 Captured chat for @${username}: ${chatId}`);
      }
    });
  } catch (e) {
    console.log('⚠️ Telegram bot not available:', e.message);
  }
}

// Helper functions
function generateTicketNumber() {
  const today = new Date().toISOString().split('T')[0];

  // Reset if new day
  if (data.settings.lastResetDate !== today) {
    // Keep completed patients for history, reset ticket counter
    data.settings.lastResetDate = today;
    data.settings.ticketCounter = 0;
  }

  data.settings.ticketCounter += 1;
  const num = data.settings.ticketCounter;
  saveData(data);

  return `A-${num.toString().padStart(3, '0')}`;
}

function getWaitingTime(position) {
  return position * 7;
}

function calculateEstimates() {
  const waiting = data.patients.filter(p => p.status === 'waiting');
  const inConsultation = data.patients.find(p => p.status === 'in-consultation');

  let baseTime = new Date();
  if (inConsultation && inConsultation.calledAt) {
    baseTime = new Date(inConsultation.calledAt);
  }

  waiting.forEach((patient, index) => {
    const estimatedMinutes = getWaitingTime(index);
    patient.estimatedMinutes = estimatedMinutes;
  });

  saveData(data);
}

async function sendTelegramNotification(patient) {
  if (!bot) {
    console.log(`📱 [Mock] Telegram notification to ${patient.telegramUsername || patient.phone}: Dr. is ready for you now!`);
    return;
  }

  try {
    if (patient.telegramUsername) {
      const username = patient.telegramUsername.toLowerCase().replace('@', '');
      const chatId = userChatIds.get(username);

      if (chatId) {
        const message = `🌸 *Motherland Clinic*\n\nDear ${patient.name}, Dr. is ready for you now.\n\nPlease proceed to the consultation room.`;
        await bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
        console.log(`📱 ✅ Notification sent to @${patient.telegramUsername}`);
      } else {
        console.log(`📱 ⚠️ @${patient.telegramUsername} hasn't started the bot yet`);
      }
    } else {
      console.log(`📱 No Telegram username for ${patient.name}`);
    }
  } catch (e) {
    console.log('❌ Telegram notification failed:', e.message);
  }
}

// API Routes

// Get queue status (for public display)
app.get('/api/status', (req, res) => {
  const nowServing = data.patients.find(p => p.status === 'in-consultation');
  const waiting = data.patients.filter(p => p.status === 'waiting').sort((a, b) => new Date(a.joinedAt) - new Date(b.joinedAt));
  const completed = data.patients.filter(p => p.status === 'completed' && p.joinedAt.startsWith(new Date().toISOString().split('T')[0])).length;

  res.json({
    nowServing: nowServing || null,
    waitingCount: waiting.length,
    completedToday: completed,
    estimates: waiting.map((p, i) => ({
      id: p.id,
      ticketNumber: p.ticketNumber,
      name: p.name,
      estimatedMinutes: p.estimatedMinutes || getWaitingTime(i)
    }))
  });
});

// Join queue (patient)
app.post('/api/join', (req, res) => {
  const { name, phone, telegramUsername } = req.body;

  if (!name || !phone) {
    return res.status(400).json({ error: 'Name and phone are required' });
  }

  const waitingCount = data.patients.filter(p => p.status === 'waiting' || p.status === 'in-consultation').length;
  const position = waitingCount + 1;

  const patient = {
    id: uuidv4(),
    name,
    phone,
    telegramUsername: telegramUsername || null,
    ticketNumber: generateTicketNumber(),
    status: 'waiting',
    joinedAt: new Date().toISOString(),
    calledAt: null,
    completedAt: null,
    estimatedMinutes: getWaitingTime(position - 1)
  };

  data.patients.push(patient);
  saveData(data);

  calculateEstimates();

  res.json({
    success: true,
    patient: {
      ...patient,
      position
    }
  });
});

// Get patient status
app.get('/api/patient/:id', (req, res) => {
  const patient = data.patients.find(p => p.id === req.params.id);

  if (!patient) {
    return res.status(404).json({ error: 'Patient not found' });
  }

  const waitingAhead = data.patients.filter(p => p.status === 'waiting' && new Date(p.joinedAt) < new Date(patient.joinedAt)).length;

  res.json({
    ...patient,
    position: patient.status === 'waiting' ? waitingAhead + 1 : null,
    estimatedMinutes: patient.status === 'waiting' ? patient.estimatedMinutes || getWaitingTime(waitingAhead) : null
  });
});

// Cancel/delete patient
app.delete('/api/patient/:id', (req, res) => {
  const index = data.patients.findIndex(p => p.id === req.params.id);

  if (index === -1) {
    return res.status(404).json({ error: 'Patient not found' });
  }

  const patient = data.patients[index];
  data.patients.splice(index, 1);
  saveData(data);

  res.json({ success: true, patient });
});

// Admin: Get all patients
app.get('/api/admin/patients', (req, res) => {
  const today = new Date().toISOString().split('T')[0];
  const todayPatients = data.patients.filter(p => p.joinedAt.startsWith(today));

  const sorted = [...todayPatients].sort((a, b) => {
    const statusOrder = { 'in-consultation': 1, 'waiting': 2, 'completed': 3 };
    if (statusOrder[a.status] !== statusOrder[b.status]) {
      return statusOrder[a.status] - statusOrder[b.status];
    }
    return new Date(a.joinedAt) - new Date(b.joinedAt);
  });

  res.json(sorted);
});

// Admin: Next patient
app.post('/api/admin/next', (req, res) => {
  const inConsultation = data.patients.find(p => p.status === 'in-consultation');
  const nextPatient = data.patients.filter(p => p.status === 'waiting').sort((a, b) => new Date(a.joinedAt) - new Date(b.joinedAt))[0];

  // Mark current as completed
  if (inConsultation) {
    inConsultation.status = 'completed';
    inConsultation.completedAt = new Date().toISOString();
  }

  // Move next to in-consultation
  if (nextPatient) {
    nextPatient.status = 'in-consultation';
    nextPatient.calledAt = new Date().toISOString();

    // Send Telegram notification
    sendTelegramNotification(nextPatient);
  }

  saveData(data);
  calculateEstimates();

  res.json({ success: true });
});

// Admin: Delay all estimates
app.post('/api/admin/delay', (req, res) => {
  const { minutes = 5 } = req.body;

  // Add delay to all waiting patients
  data.patients.forEach(p => {
    if (p.status === 'waiting' && p.estimatedMinutes) {
      p.estimatedMinutes += minutes;
    }
  });

  saveData(data);
  res.json({ success: true, delayMinutes: minutes });
});

// Admin: Get stats
app.get('/api/admin/stats', (req, res) => {
  const today = new Date().toISOString().split('T')[0];

  const completed = data.patients.filter(p => p.status === 'completed' && p.joinedAt.startsWith(today)).length;
  const waiting = data.patients.filter(p => p.status === 'waiting').length;
  const inConsultation = data.patients.filter(p => p.status === 'in-consultation').length;

  res.json({
    completedToday: completed,
    waitingCount: waiting,
    inConsultationCount: inConsultation
  });
});

// Admin: Reset queue (for testing/manual reset)
app.post('/api/admin/reset', (req, res) => {
  data.patients = data.patients.filter(p => p.status === 'completed');
  data.settings.ticketCounter = 0;
  data.settings.lastResetDate = new Date().toISOString().split('T')[0];
  saveData(data);

  res.json({ success: true });
});

// Serve the main app
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

app.get('/display', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'display.html'));
});

app.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════════════════╗
║   🌸 Motherland Clinic Queue System                   ║
║                                                       ║
║   Patient:  http://localhost:${PORT}                    ║
║   Admin:    http://localhost:${PORT}/admin              ║
║   Display:  http://localhost:${PORT}/display            ║
║                                                       ║
║   Clinic Hours: 11:00 AM - Until all patients seen   ║
╚═══════════════════════════════════════════════════════╝
  `);
});