# Mobile: React Native → Flutter Migration

> Status: **scaffold + auth flow converted** (2026-06-30). Owner: Anusuya (mobile).
> The old Expo/RN app under `mobile/src` is kept as **reference only** until the
> Flutter app is verified, then it will be archived/removed.

## Why

The mobile app was rebuilt in **Flutter (Dart)** instead of Expo/React Native.
The existing RN screens are reference-only, not reusable — the auth flow, auth
gate, theme, and HTTP/refresh logic were ported faithfully to Dart.

## State management

**Riverpod** (recommended default). Only `core/router/app_router.dart`, the
`*_controller.dart` files, and the `flutter_riverpod` dep are state-mgmt-specific
— swapping to Bloc later touches only those.

## Verified backend contract (source of truth)

Extracted directly from `backend/src` on `feature/cloud-infra-migration`. The RN
client was **stale**; the Flutter client targets these instead:

| Flow | Method + path | Request | Response |
|------|---------------|---------|----------|
| Request OTP | `POST /auth/otp/request` | `{ phone }` (E.164 IN) | `{ serviceId }` |
| Verify OTP | `POST /auth/otp/verify` | `{ phone, code, serviceId }` | `{ accessToken, refreshToken, user{ id, role, displayName, isNewUser } }` |
| Refresh | `POST /auth/token/refresh` | `{ refreshToken }` | `{ accessToken, refreshToken }` |
| Logout | `POST /auth/logout` | — (Bearer) | 204 |
| Me | `GET /users/me` | — (Bearer) | User |
| Update profile | `PATCH /users/me` | `{ displayName?, bio? }` | User |
| Update role | `PATCH /users/me/role` | `{ role }` (`UserRole`) | User |
| Push token | `POST /users/me/push-token` | `{ token, platform }` | 204 |

**Critical facts:**
- **No global `/api/v1` prefix.** Base URL is the host only. Local backend listens on **port 3001** (`PORT ?? 3001`).
- **No global ValidationPipe** → the client validates phone/code before sending.
- **`GET /universities` is deleted on this branch (404).** Discovery screens are placeholders until Hari re-implements the controller.
- `UserRole` = `PROSPECTIVE_STUDENT | CURRENT_STUDENT | ALUMNI | MENTOR | ADMIN` (RN omitted `MENTOR`).

## What was built (this pass)

```
mobile/
├── pubspec.yaml, analysis_options.yaml
├── lib/
│   ├── main.dart                       # ProviderScope → UniscopeApp
│   ├── app/{app.dart, main_shell.dart} # MaterialApp.router; 5-tab shell
│   ├── core/
│   │   ├── env.dart                    # API_BASE_URL via --dart-define
│   │   ├── providers.dart              # secureTokenStorageProvider
│   │   ├── network/{api_endpoints, api_exception, dio_client, auth_interceptor}.dart
│   │   ├── storage/secure_token_storage.dart   # flutter_secure_storage (tokens)
│   │   ├── theme/{app_colors, app_spacing, app_theme}.dart   # ported tokens
│   │   └── router/{routes.dart, app_router.dart}             # auth-gate redirect
│   ├── features/
│   │   ├── auth/{domain, application, data, presentation}    # full OTP flow, wired
│   │   ├── profile/data/users_api.dart
│   │   ├── home/presentation/home_screen.dart
│   │   └── admin/presentation/admin_dashboard_screen.dart
│   └── shared/widgets/placeholder_screen.dart
└── test/features/auth/auth_user_test.dart
.github/workflows/mobile-ci.yml          # flutter pub get → format → analyze → test
```

**Wired to live endpoints:** Welcome → Login (`otp/request`) → OTP (`otp/verify`)
→ RoleSelection (`/users/me/role`) → ProfileSetup (`/users/me`) → Home. Auth gate +
secure-storage session restore + single-flight 401 refresh all ported.

**Placeholders (await backend / later sprints):** Colleges, Mentors, Chats,
Profile, Admin queues.

## How to finalize (requires Flutter SDK — not yet installed)

1. Install Flutter: `brew install --cask flutter` (or git-clone the SDK) → `flutter doctor`.
2. In `mobile/`: `flutter create .` — generates `android/`, `ios/`, etc. without
   overwriting `lib/` or `pubspec.yaml`.
3. `flutter pub get`
4. `dart format . && flutter analyze && flutter test` — should be clean/green.
5. Run against local backend (start it first, listens on :3001):
   `flutter run --dart-define=API_BASE_URL=http://localhost:3001`

## Open decisions (owner)

1. **Confirm Riverpod** (vs Bloc).
2. **Old RN code:** archive `mobile/src` → `mobile/_archived_rn/` or delete once Flutter verified.
3. **Remove `mobile` from root `package.json` workspaces** (it's no longer npm) — coordinate-first file.
4. **Min OS versions:** propose iOS 13+, Android API 23+.
5. **Discovery:** ship university screens on mock data, or block until backend re-adds `GET /universities`.
