# Motherland Clinic - Same-Day Queue System

## Project Overview
- **Project Name:** Motherland Clinic Queue System
- **Type:** Full-stack web application
- **Core Functionality:** Real-time queue management for a luxury fertility clinic with Telegram notifications
- **Target Users:** Clinic patients (queue joiners), Doctors/Staff (queue managers), Waiting room displays

## Visual & Rendering Specification

### Design Aesthetic
- **Theme:** Luxury minimalist fertility clinic
- **Color Palette:**
  - Primary: `#1a1a2e` (Deep midnight blue)
  - Secondary: `#c9a962` (Champagne gold)
  - Accent: `#e8d5b7` (Warm cream)
  - Background: `#0f0f1a` (Rich black)
  - Surface: `#252538` (Elevated dark)
  - Success: `#4ade80` (Soft green)
  - Warning: `#fbbf24` (Amber)
- **Typography:**
  - Headings: 'Cormorant Garamond', serif (elegant, medical luxury)
  - Body: 'DM Sans', sans-serif (clean, readable)
  - Queue Numbers: 'Space Mono', monospace (clear, clinical)

### Layouts
1. **Patient Join Page** - Single card centered, elegant form
2. **Admin Dashboard** - Split view: patient list + controls
3. **Waiting Room Display** - Large typography, minimal, auto-refreshing

## Functionality Specification

### Patient Flow
- Form fields: Name (required), Phone (required), Telegram Username (optional)
- "Join Queue" validates and generates ticket: A-001, A-002, etc.
- Shows: Ticket Number, Estimated Wait Time (7 min/patient), Position in queue
- Live "Now Serving" display updates in real-time
- Queue resets daily (A-001 each morning)

### Admin Flow
- List of waiting patients with status badges (waiting, in-consultation, completed)
- "Next Patient" button:
  1. Current in-consultation → completed
  2. First waiting → in-consultation
  3. Send Telegram notification to next patient
- "Delay +5 mins" adjusts all pending estimates
- Statistics: Total served, Average wait time, Current wait list size

### Waiting Room Display
- Shows current ticket being served (large)
- Shows next 3 patients in queue
- Auto-refreshes every 10 seconds
- Clean, scannable from distance

### Telegram Integration
- Bot sends: "Motherland Clinic: Dr. is ready for you now. Please proceed to consultation room."
- Uses Telegram Bot API with chat_id (collected via username or phone)

### Data Model
```
Patient {
  id: uuid,
  name: string,
  phone: string,
  telegramUsername: string,
  ticketNumber: string, // A-001
  status: 'waiting' | 'in-consultation' | 'completed',
  joinedAt: timestamp,
  calledAt: timestamp | null,
  completedAt: timestamp | null
}
```

## Technical Stack
- **Frontend:** Vanilla HTML/CSS/JS (no frameworks)
- **Backend:** Node.js + Express
- **Database:** SQLite (better-sqlite3)
- **Notifications:** Telegram Bot API

## Acceptance Criteria
1. Patient can join queue and receive ticket number
2. Estimated time updates based on queue position
3. Admin can advance queue with single click
4. Telegram notification fires on patient call
5. Delay button recalculates all estimates
6. Waiting room display shows real-time status
7. Queue resets at 11am daily
8. All data persists across server restarts