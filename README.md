# Home Manual

A standalone, offline household operating manual. Records stay on the device in SQLite.

## Current milestone

- Create one home
- Add and edit items
- Archive and restore items
- Persist data across restarts

## Run on iPhone with Expo Go

```bash
npm install
npm start
```

Keep the computer and iPhone on the same Wi-Fi network, then scan Expo's QR code with the iPhone Camera.

The project intentionally uses Expo SDK 54 while Expo Go's App Store release is in the SDK 57 transition period.

## Checks

```bash
npm run typecheck
npm run lint
```
