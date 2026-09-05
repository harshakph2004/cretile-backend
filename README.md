# Cretile

An Expo React Native field-record app for capturing kit photos and indexing them by kit name, client, and serial number.

## Run it

1. Install Node.js 18 or newer.
2. Run `npm install`.
3. Run `npx expo start` and scan the QR code in Expo Go.

The app saves records locally during the demo session unless `EXPO_PUBLIC_API_URL` is set. Photo selection/capture is real on a device.

## Google Drive architecture

This project includes that backend in `server/index.js`. It keeps Google credentials out of the downloadable application and makes searches reliable.

```
Expo app -> POST /kits -> backend -> Google Drive folder + images
                          -> database index (metadata + Drive folder link)
Expo app -> GET /kits?q= -> backend -> database index -> matching records
```

For each record, it creates a Drive folder named `SERIAL_NUMBER — KIT_NAME`, uploads every selected photo into it, and saves the metadata in `server/kits.json`. That file is a simple working index for the project demo. For a multi-user production release, swap it for Supabase/Firebase/Postgres: `kitName`, `client`, `serialNumber`, `driveFolderId`, `driveFolderUrl`, `imageFileIds`, `createdAt`.

Searching Drive filenames alone is brittle; the metadata index enables fast search across all three fields. The `services/drive.js` module is the app-side boundary for the backend.

## Required Google setup

1. Create a Google Cloud project and enable the Google Drive API.
2. Create a Google OAuth **Desktop app** client and download its JSON file to `server/oauth-client.json`.
3. Give the backend the parent folder ID; it creates child folders and uploads the files.

This setup uses your own Google Drive account, so photos use your Drive storage quota.

## Connect and test Google Drive

1. Copy `.env.example` to `.env` and fill in its values. Keep `.env` out of Git.
2. Place the OAuth client JSON downloaded from Google Cloud at `server/oauth-client.json`. It is ignored by Git; never share or commit it.
3. Run `npm run authorize-drive`, open the link it prints, and allow access with the Google account that owns the Drive folder.
4. Start the API with `npm run server`.
5. Start Expo with `npx expo start --clear`. On a phone, set `EXPO_PUBLIC_API_URL` to your computer's local network address (for example `http://192.168.1.10:3000`).
6. Tap **+**, add a kit and photos, then Save. You should see a new child folder and images in the shared Drive folder.
