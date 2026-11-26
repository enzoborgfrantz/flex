export const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID

// email + profile to identify the user, drive.appdata to store workout data in the app's hidden
// Drive folder, drive.file so the app can write its own files in a *visible* folder (see
// src/sync/aiCoachDrive.ts), and drive.readonly so the app can read files it didn't create
// itself — specifically the daily AI coach reports, which a Claude routine creates under its
// own grant, invisible to our drive.file access no matter which folder they land in.
export const AUTH_SCOPE =
  'email profile https://www.googleapis.com/auth/drive.appdata https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/drive.readonly'
