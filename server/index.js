const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
});

// ─── In-memory state ───────────────────────────────────────────────────────────
let state = {
  queue: [],           // { id, token, name, phone, joinedAt, status: 'waiting'|'serving'|'done' }
  currentToken: null,  // token string currently being served
  currentPatient: null,
  configAvgTime: 5,    // minutes — set by receptionist
  callHistory: [],     // timestamps of each "call next" press
  tokenCounter: 0,
  doctorStatus: 'available', // 'available' | 'break'
  breakStartedAt: null,
  stats: {
    servedToday: 0,
    totalActualMinutes: 0,
  },
};

// ─── Helpers ───────────────────────────────────────────────────────────────────
function padToken(n) {
  return 'T' + String(n).padStart(3, '0');
}

function computeRollingAvg() {
  const recent = state.callHistory.slice(-10);
  if (recent.length < 2) return state.configAvgTime;
  const gaps = [];
  for (let i = 1; i < recent.length; i++) {
    gaps.push((recent[i] - recent[i - 1]) / 60000); // ms → minutes
  }
  const avg = gaps.reduce((a, b) => a + b, 0) / gaps.length;
  return parseFloat(avg.toFixed(1));
}

function getEffectiveAvgTime() {
  const rolling = computeRollingAvg();
  // Blend config and actual: if we have enough data, weight actual more
  const samples = state.callHistory.length;
  if (samples < 3) return state.configAvgTime;
  if (samples < 6) return parseFloat(((state.configAvgTime + rolling) / 2).toFixed(1));
  return rolling;
}

function buildPublicState() {
  const waiting = state.queue.filter(p => p.status === 'waiting');
  const avgTime = getEffectiveAvgTime();
  const callCount = state.callHistory.length;
  const dataConfidence = callCount >= 6 ? 'high' : callCount >= 3 ? 'medium' : 'low';
  return {
    currentToken: state.currentToken,
    currentPatient: state.currentPatient,
    waitingCount: waiting.length,
    queue: waiting.map((p, idx) => ({
      token: p.token,
      name: p.name,
      position: idx + 1,
      estimatedWaitMinutes: parseFloat(((idx + 1) * avgTime).toFixed(1)),
    })),
    avgConsultMinutes: avgTime,
    configAvgTime: state.configAvgTime,
    doctorStatus: state.doctorStatus,
    stats: state.stats,
    dataConfidence,
    callCount,
    updatedAt: Date.now(),
  };
}

function buildReceptionistState() {
  const pub = buildPublicState();
  return {
    ...pub,
    fullQueue: state.queue.filter(p => p.status !== 'done').map((p, idx) => ({
      ...p,
      position: p.status === 'waiting' ? state.queue.filter(q => q.status === 'waiting').indexOf(p) + 1 : 0,
    })),
    servedToday: state.stats.servedToday,
    callHistoryCount: state.callHistory.length,
  };
}

function broadcast() {
  const recState = buildReceptionistState();
  const patState = buildPublicState();
  io.to('receptionist').emit('receptionist_state', recState);
  io.to('patient').emit('queue_state', patState);
}

// ─── REST API (health check + QR-scannable entry) ──────────────────────────────
app.get('/api/health', (_, res) => res.json({ ok: true, time: new Date().toISOString() }));

app.get('/api/state', (_, res) => res.json(buildPublicState()));

// ─── Socket.io ─────────────────────────────────────────────────────────────────
io.on('connection', (socket) => {
  const role = socket.handshake.query.role || 'patient';
  socket.join(role);
  console.log(`[+] ${role} connected: ${socket.id}`);

  // Send initial state immediately
  if (role === 'receptionist') {
    socket.emit('receptionist_state', buildReceptionistState());
  } else {
    socket.emit('queue_state', buildPublicState());
  }

  // ── RECEPTIONIST EVENTS ──────────────────────────────────────────────────────

  /** Add a new patient to the queue */
  socket.on('add_patient', ({ name, phone }, ack) => {
    if (!name || !name.trim()) {
      if (ack) ack({ error: 'Name is required' });
      return;
    }
    state.tokenCounter++;
    const patient = {
      id: uuidv4(),
      token: padToken(state.tokenCounter),
      name: name.trim(),
      phone: (phone || '').trim(),
      joinedAt: Date.now(),
      status: 'waiting',
    };
    state.queue.push(patient);
    console.log(`[+] Patient added: ${patient.token} — ${patient.name}`);
    if (ack) ack({ ok: true, token: patient.token, id: patient.id });
    broadcast();
  });

  /** Call the next patient — core action */
  socket.on('call_next', (_, ack) => {
    const nextPatient = state.queue.find(p => p.status === 'waiting');
    if (!nextPatient) {
      if (ack) ack({ error: 'Queue is empty' });
      return;
    }

    // Mark previous as done
    if (state.currentToken) {
      const prev = state.queue.find(p => p.token === state.currentToken);
      if (prev) {
        prev.status = 'done';
        state.stats.servedToday++;
      }
    }

    // Track call timestamp for rolling avg
    const now = Date.now();
    state.callHistory.push(now);

    nextPatient.status = 'serving';
    state.currentToken = nextPatient.token;
    state.currentPatient = { token: nextPatient.token, name: nextPatient.name };

    console.log(`[>] Calling token: ${nextPatient.token} — ${nextPatient.name}`);
    if (ack) ack({ ok: true, token: nextPatient.token });

    // Emit a dedicated event for prominent alert on patient screens
    io.emit('token_called', {
      token: nextPatient.token,
      name: nextPatient.name,
      calledAt: now,
    });

    broadcast();
  });

  /** Set average consultation time */
  socket.on('set_avg_time', ({ minutes }, ack) => {
    const mins = parseFloat(minutes);
    if (isNaN(mins) || mins < 1 || mins > 120) {
      if (ack) ack({ error: 'Must be 1–120 minutes' });
      return;
    }
    state.configAvgTime = mins;
    console.log(`[~] Avg time set to ${mins} min`);
    if (ack) ack({ ok: true });
    broadcast();
  });

  /** Toggle doctor break status */
  socket.on('toggle_break', (_, ack) => {
    if (state.doctorStatus === 'available') {
      state.doctorStatus = 'break';
      state.breakStartedAt = Date.now();
    } else {
      state.doctorStatus = 'available';
      state.breakStartedAt = null;
    }
    console.log(`[~] Doctor status: ${state.doctorStatus}`);
    if (ack) ack({ ok: true, status: state.doctorStatus });
    broadcast();
  });

  /** Emergency / priority bump — move patient to front */
  socket.on('priority_bump', ({ id }, ack) => {
    const idx = state.queue.findIndex(p => p.id === id && p.status === 'waiting');
    if (idx === -1) {
      if (ack) ack({ error: 'Patient not found in waiting queue' });
      return;
    }
    const [patient] = state.queue.splice(idx, 1);
    // Insert right after any currently-serving patient (at start of waiting list)
    const firstWaitingIdx = state.queue.findIndex(p => p.status === 'waiting');
    if (firstWaitingIdx === -1) state.queue.push(patient);
    else state.queue.splice(firstWaitingIdx, 0, patient);

    console.log(`[!] Priority bump: ${patient.token} — ${patient.name}`);
    if (ack) ack({ ok: true });
    broadcast();
  });

  /** Remove a patient from queue (no-show) */
  socket.on('remove_patient', ({ id }, ack) => {
    const idx = state.queue.findIndex(p => p.id === id);
    if (idx === -1) {
      if (ack) ack({ error: 'Patient not found' });
      return;
    }
    const removed = state.queue.splice(idx, 1)[0];
    if (state.currentToken === removed.token) {
      state.currentToken = null;
      state.currentPatient = null;
    }
    console.log(`[-] Removed: ${removed.token} — ${removed.name}`);
    if (ack) ack({ ok: true });
    broadcast();
  });

  /** Reset entire queue (end of day) */
  socket.on('reset_queue', (_, ack) => {
    state.queue = [];
    state.currentToken = null;
    state.currentPatient = null;
    state.callHistory = [];
    state.tokenCounter = 0;
    state.stats = { servedToday: 0, totalActualMinutes: 0 };
    state.doctorStatus = 'available';
    console.log('[!] Queue reset');
    if (ack) ack({ ok: true });
    broadcast();
  });

  socket.on('disconnect', () => {
    console.log(`[-] ${role} disconnected: ${socket.id}`);
  });
});

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`\n🏥 Queue Cure server running on http://localhost:${PORT}`);
  console.log(`   Receptionist: http://localhost:5173/receptionist`);
  console.log(`   Patient view: http://localhost:5173/patient\n`);
});
