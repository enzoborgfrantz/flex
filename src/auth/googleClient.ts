import { AUTH_SCOPE, GOOGLE_CLIENT_ID } from '../config'

const GSI_SRC = 'https://accounts.google.com/gsi/client'

let scriptPromise: Promise<void> | null = null

function loadGsiScript(): Promise<void> {
  if (window.google?.accounts?.oauth2) return Promise.resolve()
  if (!scriptPromise) {
    scriptPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script')
      script.src = GSI_SRC
      script.async = true
      script.defer = true
      script.onload = () => resolve()
      script.onerror = () => reject(new Error('Failed to load Google Identity Services script'))
      document.head.appendChild(script)
    })
  }
  return scriptPromise
}

export interface GoogleTokenResult {
  accessToken: string
  expiresAt: number
}

export async function requestGoogleAccessToken(): Promise<GoogleTokenResult> {
  if (!GOOGLE_CLIENT_ID) {
    throw new Error('Missing VITE_GOOGLE_CLIENT_ID — see README for setup')
  }

  await loadGsiScript()

  return new Promise((resolve, reject) => {
    const tokenClient = window.google!.accounts.oauth2.initTokenClient({
      client_id: GOOGLE_CLIENT_ID,
      scope: AUTH_SCOPE,
      callback: (response) => {
        if (response.error) {
          reject(new Error(response.error_description ?? response.error))
          return
        }
        resolve({
          accessToken: response.access_token,
          expiresAt: Date.now() + response.expires_in * 1000,
        })
      },
      error_callback: (error) => {
        reject(new Error(error.type))
      },
    })
    tokenClient.requestAccessToken()
  })
}

export function revokeGoogleAccessToken(accessToken: string): Promise<void> {
  return new Promise((resolve) => {
    if (!window.google?.accounts?.oauth2) {
      resolve()
      return
    }
    window.google.accounts.oauth2.revoke(accessToken, () => resolve())
  })
}
