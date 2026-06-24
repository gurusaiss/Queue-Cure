# Queue Cure — Case Study
### Real-Time Clinic Queue Management · Wooble Hackathon 2026
**Author:** Guru Sai Sumith · sumith.guru@hrud.ai

---

## The Problem

76% of India's 1.5 million clinics run on paper token slips and shouting.

Patients wait 2–3 hours with zero visibility into when they'll be seen. They can't leave, can't track progress, and often miss their token. Receptionists manage everything from memory — no dashboard, no order, no estimates.

The fix doesn't need a hospital IT budget. It needs a browser, a WiFi router, and two screens.

---

## What I Built

A real-time queue management system with two views that stay in perfect sync:

| Screen | Users | Core Job |
|--------|-------|----------|
| Receptionist | Front desk staff | Add patients, call next, manage queue |
| Patient Display | Waiting patients | See current token, track position, get ETA |

Both screens update in **under 20ms** when the receptionist clicks "Call Next" — no polling, no refresh, no delay.

---

## Technical Approach

### Real-Time Sync — Socket.io Rooms

Chose WebSockets over polling. Polling creates stale data windows where a patient misses their call. Socket.io rooms let me send role-specific data shapes:

- `room: receptionist` → full state with internal IDs, all queue actions
- `room: patient` → sanitized state, no internal data exposed
- `token_called` → broadcasts to ALL clients, triggers audio + visual alert

### Smart ETA — Rolling Average with Confidence Blending

The naive approach (`position × 5 minutes`) breaks because doctor speed varies throughout the day.

**My algorithm:**

```
Effective Avg = blend(configuredTime, rollingAvg, confidence)

where:
  confidence = "low"    → < 3 real calls  → use configured time 100%
  confidence = "medium" → 3–5 real calls  → 50/50 blend
  confidence = "high"   → 6+ real calls   → use rolling avg 100%

rollingAvg = mean of gaps between last 10 "Call Next" presses
```

The ETA self-corrects as the clinic day progresses. No manual intervention.

### Concurrency Safety

Node.js runs on a single thread. All state mutations in the `call_next` handler are synchronous — two simultaneous clicks cannot both advance the queue. Tested with parallel socket emits:

```
[r1, r2] = await Promise.all([emit('call_next'), emit('call_next')])
// Result: one token returned, one error: "Queue is empty"
```

### Edge Cases Handled

| Scenario | Handling |
|----------|----------|
| Empty queue on "Call Next" | Server rejects with error ack, button disabled |
| Doctor on break | Break mode disables Call Next, patient banner shown |
| Network drop | Socket.io auto-reconnects, server sends full state on rejoin |
| Two receptionists simultaneously | Node.js atomicity — only one advances |
| No-show patient | Remove from queue, ETAs recalculate instantly |
| Emergency patient | Priority bump — one click moves to front |
| End of day | Full reset — clears queue, resets token counter |

---

## Receptionist UX Design Decisions

The receptionist has 5 seconds per action during a busy morning. Every click costs time.

- **Autofocus** on name field — keyboard entry, no mouse needed
- **Ctrl+Enter** keyboard shortcut → calls next patient
- **Auto-refocus** on name field after each patient add — rapid entry flow
- **Hover-reveal actions** (remove, priority) — prevents accidental clicks
- **Break mode** disables Call Next — eliminates the error class entirely
- **Form validation** server-side: empty names and out-of-range times rejected with clear acks

---

## Patient UX Design Decisions

The patient checks their phone once and expects a number they can trust.

- **Large token display** — visible from 3 meters
- **"Updated Xs ago"** timestamp — proves sync is live without explaining it
- **Data confidence badge** — tells patient how accurate the ETA is
- **Token self-lookup** — enter your token, get your exact position + wait
- **Progress ring** — visual queue position at a glance
- **"You're Next!" card** — urgent visual when 1–2 patients ahead
- **Audio beep** when token is called (Web Audio API, no server sound files)
- **Browser notifications** — patients can lock their screen and still be alerted

---

## Results

| Metric | Result |
|--------|--------|
| Queue sync latency | < 20ms (localhost) |
| Manual refreshes required | 0 |
| Integration test cases | 24 / 24 passing |
| Evaluation criteria | 4 / 4 covered |
| ETA accuracy | Auto-improving (real data after 6 calls) |

---

## What I'd Do Differently

**1. SMS/WhatsApp alerts** — Patients need to leave the clinic. A "you're 3 tokens away" Twilio message solves the real problem I didn't fully solve.

**2. Redis persistence** — In-memory state resets if the server restarts. A clinic can't afford mid-day data loss. Redis would take 30 minutes to add.

**3. Real user testing** — I assumed keyboard-first is fastest for receptionists. One session with an actual front desk worker would have validated or broken that assumption.

**4. Simpler ETA explanation** — The confidence blending is correct but hard to explain in a UI. I'd surface just one number with a simple "based on X real calls" label.

---

## Tech Stack

| Layer | Choice | Why |
|-------|--------|-----|
| Frontend | React + Vite + Tailwind | Fast dev, HMR, utility-first styling |
| Real-time | Socket.io | Battle-tested, rooms, acks, reconnect handling |
| Backend | Node.js + Express | Single-thread atomicity for concurrency safety |
| State | In-memory | Zero ops, perfect for single-session MVP |
| Deployment | Vercel (client) + Railway (server) | WebSockets need persistent connections |

---

## Links

- **GitHub:** https://github.com/gurusaiss/Queue-Cure
- **Receptionist:** `/receptionist`
- **Patient View:** `/patient`
- **Socket Event Diagram:** `docs/socket-event-diagram.md`

---

*Queue Cure '26 · Built by Guru Sai Sumith for Wooble Hackathon*
