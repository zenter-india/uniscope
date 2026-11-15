# Test Result Record

Copy this file to `ai/test-results/YYYY-MM-DD-<TEST-ID>-<platform>.md` and
fill it in completely.

An incomplete record is not evidence. If a field does not apply, write `N/A`
and say why — do not delete the field, because a downstream AI diagnostic
workflow expects a stable shape.

**Never paste a secret into this record** — no tokens, keys, passwords, raw
phone numbers, or decrypted real names. Redact as `<redacted>`.

---

## Identification

| Field | Value |
|---|---|
| **Test ID** | *(e.g. CALL-001 — see `TEST_MATRIX.md`)* |
| **Test name** | |
| **Build** | *(e.g. 1.0.0+7 debug / release)* |
| **Git commit** | *(full SHA — `git rev-parse HEAD`)* |
| **Branch** | |
| **Backend environment** | *(local / Railway production / other)* |
| **Backend commit or deploy id** | |
| **Date** | *(YYYY-MM-DD)* |
| **Start time** | *(include timezone)* |
| **End time** | |
| **Tester** | *(name — a human, for device tests)* |

---

## Device A — Caller

| Field | Value |
|---|---|
| Model | |
| OS version | |
| App version / build | |
| Install type | *(fresh install / upgrade / hot reload)* |
| Network | *(WiFi / 4G / 5G; carrier if cellular)* |
| `API_URL` baked in | |
| Account role | *(ASPIRANT / MENTOR)* |
| Account identifier | *(user id — **not** the phone number)* |
| Permissions granted | *(microphone: y/n; notifications: y/n)* |
| Wallet / free-tier state before | *(Uniminutes balance; free call seconds)* |

## Device B — Receiver

| Field | Value |
|---|---|
| Model | |
| OS version | |
| App version / build | |
| Install type | |
| Network | |
| `API_URL` baked in | |
| Account role | |
| Account identifier | |
| Permissions granted | |
| Mentor availability ON? | *(and when it was last toggled — 24h expiry)* |

*(For single-device tests, mark Device B `N/A — single-device test`.)*

---

## Result

> **PASS / FAIL / BLOCKED**

**PASS** — every expected result in the executed test was observed.
**FAIL** — an expected result was not observed.
**BLOCKED** — could not execute (precondition unmet, no second device,
environment unavailable). State the blocker.

| Field | Value |
|---|---|
| **Result** | |
| **Steps executed** | *(e.g. 1–12 of 19)* |
| **Step where it failed** | *(if FAIL)* |
| **Blocker** | *(if BLOCKED)* |

---

## Expected behaviour

*What should have happened, per `TEST_MATRIX.md` / `CALL_TEST.md`.*

## Observed behaviour

*What actually happened. Be specific and literal — "Device B's screen stayed
on the sessions list and no notification appeared" is useful; "it didn't work"
is not.*

---

## Timeline

Wall-clock timestamps. These are the only way to correlate device logs,
backend logs, and Agora Console after the fact — **do not skip this**.

| Time (HH:MM:SS) | Device | Event |
|---|---|---|
| | A | Booking initiated |
| | B | Notification received *(or: none received)* |
| | B | Accept tapped |
| | A | Call screen reached — **via push deep-link or manually?** |
| | B | Call screen reached |
| | A | Agora join attempted / completed |
| | B | Agora join attempted / completed |
| | A | `POST /call/joined` sent |
| | B | `POST /call/joined` sent |
| | — | Session became `IN_PROGRESS` |
| | | Failure occurred |
| | | Call ended |

---

## Evidence attached

Store artefacts alongside this record, or link them. Tick what is attached.

- [ ] Screenshots — Device A
- [ ] Screenshots — Device B
- [ ] Screen recording — Device A *(with audio, for call tests)*
- [ ] Screen recording — Device B *(with audio)*
- [ ] Device A logs *(`adb logcat` / Xcode console / `flutter run` output)*
- [ ] Device B logs
- [ ] Backend logs *(Railway, around the timeline window)*
- [ ] Calling-provider logs *(Agora Console: channel created? which uids joined?)*
- [ ] Database state *(see below)*

**File references:**

```
(paths or links)
```

---

## Database state

For session/billing tests, record the actual rows (redact nothing here except
secrets — the data itself is the evidence).

**Session row**

```
id:                 
status:             
type:               
callSlotMinutes:    
aspirantJoinedAt:   
mentorJoinedAt:     
startedAt:          
endedAt:            
endReason:          
billedMinutes:      
totalCostMinor:     
agoraChannelName:   
```

**Wallet / ledger**

```
WalletHold status:              (ACTIVE / CONSUMED / RELEASED)
Aspirant balanceMinor before:   
Aspirant balanceMinor after:    
Mentor balanceMinor before:     
Mentor balanceMinor after:      
LedgerEntry rows for session:   (type, amountMinor, idempotencyKey)
freeCallSecondsRemaining before/after: 
```

**Invariant check** — for a paid call, aspirant debit and mentor credit must be
equal and opposite, and the hold must be consumed exactly once.

| Check | Result |
|---|---|
| `abs(debit) == credit` | |
| Exactly one debit / one credit | |
| Hold consumed exactly once | |

---

## Errors observed

*Exact error text, error codes, HTTP statuses, stack traces. Copy verbatim —
do not paraphrase.*

```
```

---

## Additional notes

*Anything that might matter: device was hot, VPN active, battery saver on,
first launch after install, backgrounded briefly, etc. Unusual conditions are
often the actual cause.*

---

## Follow-up

| Field | Value |
|---|---|
| Retest required? | |
| Suspected cause | *(explicitly mark as a hypothesis, not a conclusion)* |
| Related issue / PR | |
| Reported to | |

---

### Reminder

Do not mark **PASS** unless every expected result was observed. **BLOCKED**
and **FAIL** with good evidence are far more valuable than an optimistic PASS
— an incorrect PASS on a billing or calling test is actively harmful, because
it removes the signal that something needs attention.
