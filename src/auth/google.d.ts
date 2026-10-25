export {}

interface GoogleTokenResponse {
  access_token: string
  expires_in: number
  scope: string
  token_type: string
  error?: string
  error_description?: string
}

interface GoogleTokenClientConfig {
  client_id: string
  scope: string
  prompt?: '' | 'none' | 'consent' | 'select_account'
  callback: (response: GoogleTokenResponse) => void
  error_callback?: (error: { type: string }) => void
}

interface GoogleTokenClient {
  requestAccessToken: (overrideConfig?: Partial<GoogleTokenClientConfig>) => void
}

declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient: (config: GoogleTokenClientConfig) => GoogleTokenClient
          revoke: (accessToken: string, done: () => void) => void
        }
      }
    }
  }
}
