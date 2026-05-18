export type AuthState = {
  baseUrl: string | null
  token: string | null
}

export type AuthService = {
  get: () => Promise<AuthState>
  set: (state: AuthState) => Promise<AuthState>
  clear: () => Promise<AuthState>
}

export const authService: AuthService = { ...(window as any).authService }
