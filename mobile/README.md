# Uniscope Mobile

React Native app built with Expo and TypeScript.

## Scripts

```bash
npm run start     # Expo dev server
npm run ios       # iOS simulator
npm run android   # Android emulator
npm run web       # Web preview
```

## Structure

```
src/
├── components/   # Reusable UI
├── constants/    # App constants
├── hooks/        # Custom hooks
├── navigation/   # Navigation config (future)
├── screens/      # Screen components
├── services/     # API clients (future)
├── types/        # Shared types
└── utils/        # Helpers
```

## Environment

Copy `.env.example` to `.env`. `EXPO_PUBLIC_*` vars are exposed to the client.
