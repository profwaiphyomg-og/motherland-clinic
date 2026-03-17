

```javascript
const express = require('express');
const { Telegraf } = require('telegraf');
const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_TOKEN = 'admin_secret_2024';

const bot = new Telegraf(process.env.TELEGRAM_TOKEN || '8771388415:AAG0BkTf7f4wSjchn2QOSLyobXHdRY09ufY');

bot.on('message', async ctx => {
  const text = ctx.message.text;
  if (text === '/queue') {
    const q = global.queue;
    let msg = `📋 Queue Status\n\nNow Serving: ${q.nowServing ? q.nowServing.ticket : 'None'}\n\nWaiting:\n`;
    q.waiting.forEach((p,i) => msg += `${i+1}. ${p.ticket} - ${p.name}\n`);
    ctx.reply(msg || 'Queue is empty');
  }
});
bot.launch().catch(console.error);

global.queue = { nowServing: null, waiting: [], completed: [] };

app.use(express.json());

// API Routes - must come BEFORE static middleware
app.get('/api/queue', (req, res) => res.json(global.queue));

app.post('/api/join', (req, res) => {
  const { name, phone } = req.body;
  if (!name || !phone) return res.status(400).json({error: 'Name and phone required'});
  
  const ticket = 'A-' + String(global.queue.waiting.length + 1).padStart(3, '0');
  const patient = { id: Date.now().toString(), name, phone, ticket };
  global.queue.waiting.push(patient);
  
  res.json({ success: true, ticket: patient.ticket, id: patient.id });
});

app.post('/api/next', (req, res) => {
  const { token } = req.body;
  if (token !== ADMIN_TOKEN) return res.status(401).json({error: 'Unauthorized'});
  
  if (global.queue.waiting.length > 0) {
    global.queue.completed.push(global.queue.nowServing);
    global.queue.nowServing = global.queue.waiting.shift();
  }
  res.json(global.queue);
});

app.post('/api/remove', (req, res) => {
  const { id, token } = req.body;
  if (token !== ADMIN_TOKEN) return res.status(401).json({error: 'Unauthorized'});
  
  const idx = global.queue.waiting.findIndex(p => p.id === id);
  if (idx >= 0) global.queue.waiting.splice(idx, 1);
  res.json(global.queue);
});

app.post('/api/reset', (req, res) => {
  const { token } = req.body;
  if (token !== ADMIN_TOKEN) return res.status(401).json({error: 'Unauthorized'});
  
  global.queue = { nowServing: null, waiting: [], completed: [] };
  res.json(global.queue);
});

// Static files - at the end to catch everything else
app.use(express.static('public'));

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
```
