# CALL TEST — UniScope two-device audio call

The manual protocol for verifying an end-to-end audio call between two real
physical devices.

**This test has never been executed to completion.** Nothing in this document
should be read as a claim that calling works. Its purpose is to make the test
repeatable and its failures diagnosable.

**This test is MANUAL and stays manual for now.** Do not build a device farm,
emulator infrastructure, or a device-automation platform to run it.

| | |
|---|---|
| **Device A** | **Caller** — signed in as an **ASPIRANT** |
| **Device B** | **Receiver** — signed in as a **MENTOR** |

---

## Architecture facts the tester must know first

These are not incidental; several "failures" are actually the designed
behaviour, and mistaking one for the other wastes a two-device session.

1. **This is a request/accept flow, not a ringing flow.** There is no incoming
   call screen, no CallKit/ConnectionService, and no VoIP push.
2. **The mentor must already be in the app** to accept. The `SESSION_REQUEST`
   push is an ordinary tray notification; tapping it does **not** open the
   call — `push_service.dart` deep-links only on
   `SESSION_ACCEPTED` + `sessionType == AUDIO_CALL`, which goes to the
   *aspirant*.
3. **Billing settles only when both sides confirm join** — neither device
   alone can cause a charge.
4. **The caller gives up after 45 seconds** (`_noAnswerTimer` → `NO_ANSWER`).
5. **The mentor must have "Accepting call bookings" ON**, and it
   **auto-expires after 24 hours** — a mentor who enabled it yesterday will
   reject the booking with a 409.
6. **The app must be built with the right backend URL.** `API_URL` is a
   compile-time `--dart-define`; without it the build targets `localhost`,
   which is meaningless on a device.

---

## Preconditions

| # | Precondition | How to satisfy / verify |
|---|---|---|
| P1 | Both accounts authenticated | Complete OTP login on each device; reach Home |
| P2 | Roles correct | A = ASPIRANT, B = MENTOR (distinct accounts, distinct phone numbers) |
| P3 | Mentor is eligible | B is verified, active, not banned — otherwise booking 404s |
| P4 | **Mentor availability ON** | On B: Profile → "Accepting call bookings" enabled **today** (24h expiry) |
| P5 | Network on both | Both online; note connection type (WiFi/cellular) per device |
| P6 | Microphone permission available | Grant when prompted (a denial case is tested separately in N6) |
| P7 | Notification permission granted | Needed for the accept deep-link on A; Android 13+ prompts at runtime |
| P8 | Correct build config | Built with `--dart-define=API_URL=<backend>/api/v1` pointing at the intended backend |
| P9 | Wallet/free-tier sufficient | A has ≥ 10 free call minutes, **or** enough Uniminutes for the chosen slot |
| P10 | Not blocked | Neither account has blocked the other |
| P11 | No existing active call session | Between this exact pair — a duplicate returns 409 |
| P12 | Backend reachable and healthy | `GET /health` returns 200 |
| P13 | Agora configured | `AGORA_APP_ID` / `AGORA_APP_CERTIFICATE` set in the target environment |

Record before starting: both device models, OS versions, app version, build
commit, network type, backend environment.

---

## Test procedure (happy path) — CALL-001

| Step | Action | Expected result | Evidence |
|---|---|---|---|
| 1 | Log in on **Device A** (aspirant) | Reaches Home | Screenshot |
| 2 | Log in on **Device B** (mentor) | Reaches Home; availability ON | Screenshot |
| 3 | On A: locate the target mentor | Mentor B appears in list/detail as bookable | Screenshot |
| 4 | On A: initiate audio call, pick a slot (5/10/20 min) | Session created `PENDING`; wallet hold placed (or free tier applies); A lands on a waiting state | Screenshot; backend session row |
| 5 | On B: verify the request is received | `SESSION_REQUEST` notification and/or the request visible in Sessions | Screenshot of notification **and** of the list |
| 6 | On B: accept | B navigates to the call screen automatically; session → `ACCEPTED` | Screen recording |
| 7 | Verify A reaches the call screen | Via `SESSION_ACCEPTED` deep-link, **or** manually from Sessions if push did not arrive — **record which** | Screen recording |
| 8 | Both: allow mic if prompted | Call screen proceeds past permission | — |
| 9 | Verify connection | Both reach the active state; session → `IN_PROGRESS`; `startedAt` set; timer runs | Screen recording both devices |
| 10 | Speak on B → listen on A | A hears B clearly | Screen recording with audio |
| 11 | Speak on A → listen on B | B hears A clearly | Screen recording with audio |
| 12 | Mute on A; speak; unmute | While muted B hears nothing; audio resumes on unmute | Recording |
| 13 | Mute on B; speak; unmute | Same, mirrored | Recording |
| 14 | Toggle speaker on each | Audio route changes audibly | Note |
| 15 | Observe duration | Elapsed timer advances ~1s/s and matches wall clock | Screenshot at ≥60s |
| 16 | End the call from A | Both return to a terminal state; session → `COMPLETED`, `endReason: NORMAL` | Recording; session row |
| 17 | Verify session state | `COMPLETED`, `startedAt`/`endedAt` set, `billedMinutes` = slot | Backend query |
| 18 | Verify wallet/billing | Paid: A debited exactly slot × rate, B credited the **same** amount, hold `CONSUMED`. Free: `freeCallSecondsRemaining` reduced, no ledger entries | Ledger + wallet rows |
| 19 | Verify call history | Session appears in history on both devices with correct duration and cost | Screenshots |

**Overall expected result:** clear two-way audio; exactly one billing event;
mentor credit equals aspirant debit; both sessions end cleanly.

---

## Overrun and extension — CALL-002

| Step | Action | Expected result |
|---|---|---|
| 1 | Book the shortest slot (5 min) and connect | As CALL-001 steps 1–9 |
| 2 | Let the slot run to expiry | At elapsed ≥ slot, A sees the "Time's up" dialog offering +5 minutes |
| 3a | A taps **Continue** | `extendCall` succeeds; `billedMinutes` +5; A debited and B credited the extension; call continues |
| 3b | A taps **End Call** | Call ends with `endReason: SLOT_EXPIRED` |
| 3c | A does nothing for >20s | Client auto-ends with `SLOT_EXPIRED` |

Evidence: recording of the dialog, plus ledger rows for the extension.

---

## Negative tests

Each defines expected behaviour, required evidence, and what to capture if it
fails. Several of these are the **most valuable** tests here, because they
probe the parts of the design most likely to surprise a user.

### N1 — Reject call (CALL-003)
A books; B taps Reject.
**Expected:** session `REJECTED`; hold **released** (not consumed); A notified
"Request declined"; **no ledger entries**.
**Evidence:** session row, `WalletHold.status = RELEASED`, empty ledger delta.

### N2 — Missed call / no answer (CALL-004)
A books; B does nothing.
**Expected:** after ~45s the caller ends with `NO_ANSWER`; hold released; no
billing. Note whether the session is left `PENDING`/`ACCEPTED` server-side.
**Evidence:** timestamped recording of A; session and hold rows.

### N3 — Receiver offline / app not running (CALL-005)
B force-closes the app (or is offline); A books.
**Expected — by current design:** B receives at most a tray notification.
**Tapping it does not open a call.** A times out with `NO_ANSWER`.
**This is expected behaviour, not a defect** — the product has no ringing
model. Record it as an architectural limitation.
**Evidence:** what appeared on B (screenshot or "nothing appeared"), and A's
timeout.

### N4 — Caller offline mid-call (CALL-006)
Connected, then A loses network (airplane mode).
**Expected:** Agora media drops; B sees the remote party leave; poll failures
on A are silently retried. Record whether either side auto-ends, and whether
billing is affected (it should not be — settlement already happened).
**Evidence:** both recordings, session row after the fact.

### N5 — Delayed notification (CALL-007)
Introduce delay (B backgrounded, battery saver, Doze).
**Expected:** either B gets the request late and can still accept while A is
within its 45s window, or A has already timed out. Record which, and the
observed delay.
**Evidence:** timestamps on both devices; delay measured.

### N6 — Microphone permission denied (CALL-008)
Deny mic on B (or A), then attempt the call.
**Expected:** call screen shows the permission-denied state with a route to app
settings; **no Agora join**; no `IN_PROGRESS`; no billing.
**Evidence:** screenshot; confirm session did not reach `IN_PROGRESS`.

### N7 — Notification permission denied (CALL-009)
Deny notifications on B; A books.
**Expected:** no push on B. If B is in the app they can still find the request
in Sessions. If not, A times out.
**Evidence:** screenshots; note whether the in-app path still worked.

### N8 — App backgrounded during call (CALL-010)
Connected, then background the app on one device for ~30s and return.
**Expected — unverified:** there is **no foreground service (Android)** and
**no `voip`/`audio` background mode (iOS)**, so sustained background audio is
not configured. Determine empirically whether audio survives, and for how long.
**Evidence:** recording, audible result, exact background duration.
**This is a known architectural gap — capture the real behaviour carefully.**

### N9 — Network interruption mid-call (CALL-011)
Connected, then toggle WiFi→cellular on one device.
**Expected:** Agora attempts media recovery. Record whether audio resumes, how
long it took, and whether the UI reflected anything.
**Evidence:** recording with timestamps.

### N10 — App killed and reopened mid-call (CALL-012)
Connected, then force-kill one app and reopen it.
**Expected:** no recovery path exists — the session likely remains
`IN_PROGRESS` server-side until someone ends it. Billing already settled.
Record exactly what the reopened app shows.
**Evidence:** session row after kill; screenshot of reopened state.

### N11 — Insufficient balance (CALL-013)
A has fewer Uniminutes than the slot costs and no free minutes.
**Expected:** booking rejected with an insufficient-balance error; **no
session row is left behind** (the service deletes it if the hold fails).
**Evidence:** error screenshot; confirm no orphaned session.

### N12 — Mentor unavailable / stale availability (CALL-014)
B's availability is off, or was enabled >24h ago.
**Expected:** booking rejected with "not accepting call bookings right now —
you can still start a chat"; mentor still visible and chat-reachable.
**Evidence:** screenshot; confirm mentor still appears in discovery.

---

## Failure information to capture (every failure, without exception)

Because there is **no crash reporting and no client-side call logging**, a
failure with poor evidence is likely unfixable. Capture all of:

1. **Which step failed**, by number.
2. **Exact on-screen state of both devices**, ideally screen recordings with
   audio, timestamped.
3. **Wall-clock timestamps** for: booking, accept, each join attempt, and the
   failure. These are the only way to line up the three log sources.
4. **Session row** at failure time: `id, status, aspirantJoinedAt,
   mentorJoinedAt, startedAt, endedAt, endReason, callSlotMinutes,
   billedMinutes, totalCostMinor, agoraChannelName`.
5. **Wallet state**: hold status, and any ledger entries for the session.
6. **Backend logs** around the timestamps (Railway).
7. **Device logs** — Android: `adb logcat`; iOS: Xcode device console or
   `flutter run` console. Filter on `flutter`, `agora`, `Iris`, `[push]`.
8. **Agora Console** — check whether a channel was created and whether either
   uid joined. This is the only independent evidence of media-layer reality.
9. **Which navigation path each device took** to the call screen (push
   deep-link vs manual from Sessions). This distinguishes a push failure from
   a call failure and is routinely the decisive detail.
10. **Whether `POST /call/joined` was sent by each side** — visible in backend
    logs, and inferable from `aspirantJoinedAt` / `mentorJoinedAt`.

---

## Recording results

Copy `test-results/TEMPLATE.md` to
`test-results/YYYY-MM-DD-CALL-00X-<platform>.md` and fill it in completely.

**Do not** mark PASS unless every expected result in the executed test was
observed. **BLOCKED** is correct and useful when a precondition could not be
met (e.g. only one device available).
