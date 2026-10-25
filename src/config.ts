export const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID

// email + profile to identify the user, drive.appdata to store workout data
// in the app's hidden Drive folder.
export const AUTH_SCOPE = 'email profile https://www.googleapis.com/auth/drive.appdata'
