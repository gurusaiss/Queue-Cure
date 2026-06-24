# 🏥 Queue Cure '26

> Real-time clinic queue management — eliminating 2–3 hour waits across India's 1.5M clinics.

**Built for Wooble Hackathon · Queue Cure '26**

---

## What It Does

| Role | View | Key Features |
|------|------|-------------|
| Receptionist | `/receptionist` | Add patients, call next token, set avg time, priority bump, break mode |
| Patient | `/patient` | Live current token, position tracking, smart ETA, audio alert, QR scan |

Both screens update **instantly** the moment "Call Next" is clicked — no polling, no refresh.

---

## Tech Stack

- **Frontend**: React 18 + Vite + Tailwind CSS
- **Backend**: Node.js + Express + Socket.io
- **Real-time**: WebSocket rooms (`receptionist` / `patient`)
- **State**: In-memory (stateless restart, perfect for daily clinic sessions)

---

## Getting Started

### Prerequisites
- Node.js 18+
- npm 9+

### Installation

```bash
# Clone the repo
git clone https://github.com/YOUR_USERNAME/queue-cure.git
cd queue-cure

# Install server dependencies
cd server && npm install && cd ..

# Install client dependencies
cd client && npm install && cd ..
```

### Running Locally

Open **two terminals**:

```bash
# Terminal 1 — Backend (port 4000)
cd server
npm run dev

# Terminal 2 — Frontend (port 5173)
cd client
npm run dev
```

Then open:
- **Receptionist**: http://localhost:5173/receptionist
- **Patient**: http://localhost:5173/patient

---

## Architecture

```
client/
├── src/
│   ├── views/
│   │   ├── Home.jsx           # Landing page with role picker
│   │   ├── Receptionist.jsx   # Admin dashboard
│   │   └── PatientDisplay.jsx # Patient waiting room
│   ├── components/
│   │   ├── ConnectionBadge.jsx
│   │   ├── TokenCard.jsx      # Animated flip token display
│   │   ├── TokenAlert.jsx     # Audio + visual call alert
│   │   └── StatCard.jsx
│   └── hooks/
│       └── useSocket.js       # Socket.io hook with role-based rooms

server/
└── index.js                   # Express + Socket.io server with full state machine
```

---

## Socket Events

See [`docs/socket-event-diagram.md`](docs/socket-event-diagram.md) for the full event flow diagram.

| Event (→ Server) | Description |
|-----------------|-------------|
| `add_patient` | Register patient, receive token |
| `call_next` | Advance queue to next patient |
| `set_avg_time` | Set consultation duration estimate |
| `toggle_break` | Doctor availability toggle |
| `priority_bump` | Move patient to front (emergency) |
| `remove_patient` | Remove no-show patient |
| `reset_queue` | End-of-day full reset |

| Event (← Server) | Recipients |
|-----------------|-----------|
| `receptionist_state` | Receptionist room |
| `queue_state` | Patient room |
| `token_called` | All clients (triggers audio alert) |

---

## Smart ETA Algorithm

Wait time is **never hardcoded**. The system learns from real call intervals:

```
< 3 calls  → use receptionist-configured time
3–5 calls  → blend 50/50 (config + real)
6+ calls   → pure rolling average of last 10 calls
```

ETA confidence level is shown to patients so they know how accurate the estimate is.

---

## Edge Cases Handled

- ✅ Empty queue — Call Next button disabled, error ack returned
- ✅ Doctor break — Call Next disabled, patient banner shown, ETAs pause
- ✅ Simultaneous clicks — Node.js single-thread atomicity prevents race
- ✅ Network drops — Auto-reconnect with immediate state sync on rejoin
- ✅ Priority emergency — One-click patient bump to front
- ✅ No-show removal — Patient spliced from queue, ETAs recalculate instantly
- ✅ End of day — Full reset preserves token counter integrity

---

## Submission Checklist

- [x] Working prototype (run locally or deployed link)
- [x] GitHub repository with README
- [x] Socket event diagram → [`docs/socket-event-diagram.md`](docs/socket-event-diagram.md)
- [x] Thought process sheet → [`docs/thought-process.md`](docs/thought-process.md)

---

## License

MIT
