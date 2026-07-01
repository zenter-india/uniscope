# Mobile: React Native → Flutter Migration

> Status: **built, tested, and working end-to-end** (2026-07-01).
> The Expo/RN app previously under `mobile/` has been removed. An earlier,
> unbuilt Flutter scaffold attempt (also under `mobile/`, 2026-06-30) has been
> superseded and removed — it never had platform folders generated and was
> never actually run. The current app lives at **`mobile_flutter/`**.

## Why

The mobile app was rebuilt in **Flutter (Dart)** instead of Expo/React Native.
See `docs/decisions/0003-flutter-mobile.md` for the full rationale and
trade-offs.

## Stack

- **State management:** Riverpod (`Notifier`)
- **Navigation:** go_router (`StatefulShellRoute` for the 5-tab shell)
- **HTTP:** Dio, with a JWT-refresh interceptor
- **Token storage:** flutter_secure_storage

## Backend contract

| Flow | Method + path | Request | Response |
|------|---------------|---------|----------|
| Request OTP | `POST /api/v1/auth/otp/request` | `{ phone }` (E.164 IN) | `{ serviceId }` |
| Verify OTP | `POST /api/v1/auth/otp/verify` | `{ phone, code, serviceId }` | `{ accessToken, refreshToken, user{ id, role, displayName, isNewUser } }` |
| Refresh | `POST /api/v1/auth/token/refresh` | `{ refreshToken }` | `{ accessToken, refreshToken }` |
| Logout | `POST /api/v1/auth/logout` | — (Bearer) | 204 |
| Me | `GET /api/v1/users/me` | — (Bearer) | User |
| Update profile | `PATCH /api/v1/users/me` | `{ displayName?, bio? }` | User |
| Update role | `PATCH /api/v1/users/me/role` | `{ role }` (`UserRole`) | User |
| Push token | `POST /api/v1/users/me/push-token` | `{ token, platform }` | 204 |

All routes are served under the `/api/v1` prefix (`app.setGlobalPrefix`), except
`/health` at the root. Local backend listens on port **3001**.

## What's built

```
mobile_flutter/
├── pubspec.yaml, analysis_options.yaml
├── lib/
│   ├── main.dart                         # ProviderScope → UniscopeApp
│   ├── core/
│   │   ├── theme/app_theme.dart          # ported design tokens
│   │   └── network/{dio_client, auth_api, users_api}.dart
│   ├── state/auth_controller.dart        # Riverpod Notifier + secure-storage persistence
│   ├── router/app_router.dart            # auth-gated redirect + 5-tab shell
│   ├── widgets/primary_button.dart
│   └── features/
│       ├── auth/            # welcome, login, otp, role_selection, profile_setup
│       ├── home/
│       ├── universities/    # list, detail (tabbed)
│       ├── messages/        # conversation_list, chat_room
│       ├── profile/
│       ├── verification/
│       ├── admin/
│       ├── shell/           # bottom-tab MainShell
│       └── common/          # placeholder_screen
├── android/, macos/, web/                # platform scaffolding (generated + configured)
└── test/{boot_test, flow_test}.dart      # widget/integration tests
```

**Verified working end-to-end (not just unit-tested):**
- Full auth flow — phone → OTP → role selection → profile setup → Home — tested with **real Twilio SMS delivery** and a **live Supabase Postgres database**.
- Runs on **macOS desktop**, **Flutter Web**, and a **real Android emulator** (Pixel 7 / Android 14), including a full logout/login cycle confirmed on-device.
- 3 passing widget/integration tests: boot → Welcome, Login → OTP navigation with validation, and the complete phone → OTP → authenticated → Home → tab-switch journey.

**Placeholders (real UI, seed/placeholder data):** university list/detail content,
home feed cards, chat messages, admin stats. Screens and navigation are real;
the data behind them is not yet wired to live backend endpoints beyond auth.

## Known environment gotchas (already handled in this repo)

- **Android blocks cleartext HTTP by default** (targetSdk 28+). `usesCleartextTraffic="true"` is set in the debug manifest only; release builds keep the HTTPS-only default.
- **Android emulator can't use `localhost`** for the host machine — use `10.0.2.2` instead (already the default in `--dart-define=API_URL`).
- **Twilio Verify's check endpoint is singular** (`/VerificationCheck`, not `/VerificationChecks`) — easy to get wrong; the wrong path 404s silently and looks like an invalid-code error.

## Running it

```bash
cd mobile_flutter
flutter run -d macos --dart-define=API_URL=http://localhost:3001/api/v1
# or for Android emulator:
flutter run -d <emulator-id> --dart-define=API_URL=http://10.0.2.2:3001/api/v1
```

## Open follow-ups

1. Wire placeholder screens (universities, home feed, chat, admin stats) to real backend endpoints.
2. Push notifications: FCM (`OTP_CHANNEL`-style Expo Push is not available on Flutter).
3. Confirm min OS versions: iOS 13+, Android API 23+ (current defaults).
