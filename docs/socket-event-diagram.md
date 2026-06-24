# Queue Cure — Socket Event Diagram

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                        QUEUE CURE SYSTEM                            │
│                                                                     │
│   Receptionist Browser         Server (Socket.io)    Patient Browser│
│   (room: "receptionist")       Node.js + Express     (room: "patient")
└─────────────────────────────────────────────────────────────────────┘
```

---

## Event Flow Diagram

```
RECEPTIONIST                    SERVER                      PATIENT(S)
    │                              │                              │
    │──── connect (role=receptionist) ──►│                       │
    │                              │◄── connect (role=patient) ──│
    │                              │                              │
    │◄── receptionist_state ───────│──── queue_state ───────────►│
    │   (initial state snapshot)   │   (initial state snapshot)  │
    │                              │                              │
    │                              │                              │
    │  ── ── ADD PATIENT FLOW ── ──│── ── ── ── ── ── ── ── ── ─│
    │                              │                              │
    │──── add_patient ────────────►│                              │
    │    { name, phone }           │ • Assigns token (T001, T002…)│
    │                              │ • Appends to queue[]         │
    │◄─── ack { ok, token } ───────│                              │
    │                              │──── receptionist_state ─────►│(to room)
    │◄─── receptionist_state ──────│──── queue_state ────────────►│(to room)
    │                              │                              │
    │                              │                              │
    │  ── ── CALL NEXT FLOW ── ── ─│── ── ── ── ── ── ── ── ── ─│
    │                              │                              │
    │──── call_next ──────────────►│                              │
    │                              │ • Marks prev as "done"       │
    │                              │ • Sets next as "serving"     │
    │                              │ • Pushes timestamp to        │
    │                              │   callHistory[] (for ETA)    │
    │◄─── ack { ok, token } ───────│                              │
    │                              │──── token_called ───────────►│(broadcast ALL)
    │◄─── token_called ────────────│    { token, name, calledAt } │
    │                              │──── receptionist_state ─────►│(to room)
    │◄─── receptionist_state ──────│──── queue_state ────────────►│(to room)
    │                              │                              │
    │                              │                              │
    │  ── ── SET AVG TIME ── ── ── │── ── ── ── ── ── ── ── ── ─│
    │                              │                              │
    │──── set_avg_time ───────────►│                              │
    │    { minutes: 7 }            │ • Validates range 1–120      │
    │◄─── ack { ok } ─────────────│ • Updates configAvgTime      │
    │                              │──── receptionist_state ─────►│(to room)
    │◄─── receptionist_state ──────│──── queue_state ────────────►│(to room)
    │                              │                              │
    │                              │                              │
    │  ── ── TOGGLE BREAK ── ── ── │── ── ── ── ── ── ── ── ── ─│
    │                              │                              │
    │──── toggle_break ───────────►│                              │
    │◄─── ack { status } ─────────│ • Flips 'available'/'break'  │
    │                              │──── receptionist_state ─────►│(to room)
    │◄─── receptionist_state ──────│──── queue_state ────────────►│(to room)
    │                              │    (doctorStatus: 'break')   │
    │                              │                              │
    │  ── ── PRIORITY BUMP ── ── ──│── ── ── ── ── ── ── ── ── ─│
    │                              │                              │
    │──── priority_bump ──────────►│                              │
    │    { id: "uuid" }            │ • Splices patient to front   │
    │◄─── ack { ok } ─────────────│   of waiting list            │
    │                              │──── receptionist_state ─────►│(to room)
    │◄─── receptionist_state ──────│──── queue_state ────────────►│(to room)
    │                              │                              │
    │  ── ── REMOVE PATIENT ── ── ─│── ── ── ── ── ── ── ── ── ─│
    │                              │                              │
    │──── remove_patient ─────────►│                              │
    │    { id: "uuid" }            │ • Splices patient out        │
    │◄─── ack { ok } ─────────────│                              │
    │                              │──── receptionist_state ─────►│(to room)
    │◄─── receptionist_state ──────│──── queue_state ────────────►│(to room)
    │                              │                              │
    │  ── ── RESET QUEUE ── ── ── ─│── ── ── ── ── ── ── ── ── ─│
    │                              │                              │
    │──── reset_queue ────────────►│                              │
    │◄─── ack { ok } ─────────────│ • Clears all state           │
    │                              │ • Resets tokenCounter = 0    │
    │                              │──── receptionist_state ─────►│(to room)
    │◄─── receptionist_state ──────│──── queue_state ────────────►│(to room)
```

---

## Event Catalogue

### Client → Server (Receptionist emits)

| Event | Payload | Description |
|-------|---------|-------------|
| `add_patient` | `{ name: string, phone?: string }` | Register new patient, get token |
| `call_next` | `null` | Advance queue, call next patient |
| `set_avg_time` | `{ minutes: number }` | Override consultation time estimate |
| `toggle_break` | `null` | Flip doctor availability status |
| `priority_bump` | `{ id: string }` | Move patient to front of queue |
| `remove_patient` | `{ id: string }` | Remove a no-show patient |
| `reset_queue` | `null` | Full queue reset (end of day) |

### Server → Client (broadcasts)

| Event | Recipients | Payload | Trigger |
|-------|-----------|---------|---------|
| `receptionist_state` | room: receptionist | Full state + full queue with IDs | Any state change |
| `queue_state` | room: patient | Sanitized state, no internal IDs | Any state change |
| `token_called` | ALL clients | `{ token, name, calledAt }` | call_next only |

---

## ETA Algorithm

```
Rolling Average (last 10 calls):
  gaps = [t₁-t₀, t₂-t₁, ..., tₙ-tₙ₋₁] in minutes
  rollingAvg = mean(gaps)

Blending strategy:
  samples < 3  → use configAvgTime (receptionist-set)
  samples 3–5  → (configAvgTime + rollingAvg) / 2
  samples ≥ 6  → use rollingAvg (high confidence)

Patient ETA:
  estimatedWait = position × effectiveAvgTime
```

---

## State Rooms

```
Socket.io Rooms:
  "receptionist"  ← only receptionist tabs join
  "patient"       ← all patient tabs join

token_called broadcasts to ALL (io.emit) so receptionist
screen also gets the call alert for confirmation.
```
