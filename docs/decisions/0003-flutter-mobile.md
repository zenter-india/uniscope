# ADR 0003: Flutter (Dart) for the mobile app

- **Status:** Accepted
- **Date:** 2026-07-01
- **Deciders:** Sri Hari, Anusuya, Eesh

## Context

The mobile app was originally built with React Native + Expo (auth flow,
navigation shell, API client, and state were working from Sprint 0–1). An
earlier project estimate argued *for* React Native and *against* Flutter,
primarily to preserve that head start and to share TypeScript end-to-end with
the NestJS backend.

The team subsequently decided to move the mobile app to Flutter. The React
Native app has now been ported 1:1 to Flutter under `mobile_flutter/`, keeping
the agreed delivery plan, team, timeline, and scope unchanged — only the mobile
technology changed.

## Decision

The mobile app is built with **Flutter (Dart)**. The supporting stack is:

| Concern | Choice | Replaces (RN) |
|---------|--------|----------------|
| State management | Riverpod (`Notifier`) | Zustand |
| Navigation | go_router (`StatefulShellRoute`) | React Navigation |
| HTTP client | Dio (JWT refresh interceptor) | axios |
| Token persistence | flutter_secure_storage | AsyncStorage |
| Push notifications | FCM + flutter_local_notifications | Expo Push |

The backend (NestJS + Prisma + Supabase) and admin panel (Next.js) are
unaffected by this decision.

## Consequences

### Positive

- Single Dart codebase for iOS + Android with strong native performance.
- Tokens now persist in the OS keychain/keystore (encrypted) rather than
  AsyncStorage.
- go_router centralises the auth-gated routing that was spread across nested
  React Navigation stacks.

### Negative

- End-to-end TypeScript is lost — the mobile app is Dart while the backend is
  TypeScript, so API types are no longer shared. Mitigate by generating Dart
  models from the backend OpenAPI/Prisma schema.
- Push notifications can no longer use Expo Push; FCM reintroduces a (free,
  push-only) Firebase project that the RN plan had dropped.
- Over-the-air updates (Expo) are no longer built-in; use Shorebird if needed.

### Neutral

- Vendor SDKs stay the same brand (Agora, Razorpay, Socket.io) via their
  Flutter plugins.
- The RN app remains in git history under `mobile/` for reference.

## Alternatives considered

1. **Stay on React Native + Expo** — rejected: the team chose Flutter and the
   port is complete; reverting would discard that work.
2. **Bloc instead of Riverpod** — viable, but Riverpod was chosen for less
   boilerplate and compile-safe providers.
