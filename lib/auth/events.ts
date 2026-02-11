import store from '../main/store'
import { STORE_KEYS } from '../constants/store-keys'
import { grpcClient } from '../clients/grpcClient'
import { syncService } from '../main/syncService'
import { mainWindow } from '../main/app'
import { jwtDecode } from 'jwt-decode'

// Define TypeScript interfaces for JWT payloads
interface JwtPayload {
  exp?: number
  iat?: number
  sub?: string
  email?: string
  name?: string
  picture?: string
  iss?: string
  aud?: string | string[]
  [key: string]: any
}

// Utility function to check if a JWT token is expired
export const isTokenExpired = (token: string): boolean => {
  try {
    const payload = jwtDecode<JwtPayload>(token)

    // Check if token has expired
    const currentTime = Math.floor(Date.now() / 1000)
    return payload.exp ? payload.exp < currentTime : true
  } catch (error) {
    console.warn('Failed to decode token for expiration check:', error)
    // If we can't decode the token, assume it's expired to be safe
    return true
  }
}

// Check and validate stored tokens on startup
export const validateStoredTokens = async () => {
  try {
    const storedAuth = store.get(STORE_KEYS.AUTH)
    const storedTokens = storedAuth?.tokens
    const storeAccessToken = store.get(STORE_KEYS.ACCESS_TOKEN) as
      | string
      | undefined

    const hasTokens = storedTokens?.access_token || storeAccessToken

    if (hasTokens) {
      console.log('Checking stored access tokens for expiration...')

      const authStoreTokenExpired = storedTokens?.access_token
        ? isTokenExpired(storedTokens.access_token)
        : false
      const storeTokenExpired = storeAccessToken
        ? isTokenExpired(storeAccessToken)
        : false

      if (authStoreTokenExpired || storeTokenExpired) {
        console.log('Stored access tokens are expired, clearing auth data')

        if (storedAuth) {
          store.set(STORE_KEYS.AUTH, {
            ...storedAuth,
            tokens: null,
          })
        }

        grpcClient.setAuthToken(null)
        syncService.stop()

        store.delete(STORE_KEYS.USER_PROFILE)
        store.delete(STORE_KEYS.ID_TOKEN)
        store.delete(STORE_KEYS.ACCESS_TOKEN)

        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('auth-token-expired')
        }

        return false
      } else {
        console.log('Stored access tokens are valid')

        if (storedTokens?.access_token && !storeAccessToken) {
          store.set(STORE_KEYS.ACCESS_TOKEN, storedTokens.access_token)
        } else if (storeAccessToken && !storedTokens?.access_token) {
          if (storedAuth) {
            store.set(STORE_KEYS.AUTH, {
              ...storedAuth,
              tokens: {
                ...storedAuth.tokens,
                access_token: storeAccessToken,
              },
            })
          }
        }

        return true
      }
    }

    return true
  } catch (error) {
    console.error('Error validating stored tokens:', error)
    return false
  }
}

export const handleLogin = (
  profile: any,
  idToken: string | null,
  accessToken: string | null,
) => {
  console.log('[DEBUG][auth/events] handleLogin called with profile:', profile)
  store.set(STORE_KEYS.USER_PROFILE, profile)
  console.log('[DEBUG][auth/events] USER_PROFILE set, verifying:', store.get(STORE_KEYS.USER_PROFILE))

  if (idToken) {
    store.set(STORE_KEYS.ID_TOKEN, idToken)
  }

  if (accessToken) {
    store.set(STORE_KEYS.ACCESS_TOKEN, accessToken)
    grpcClient.setAuthToken(accessToken)
    syncService.start()
  }

  // For self-hosted users, we don't start sync service since they don't have tokens
}

export const handleLogout = () => {
  console.log('[DEBUG][auth/events] handleLogout called')
  store.delete(STORE_KEYS.USER_PROFILE)
  store.delete(STORE_KEYS.ID_TOKEN)
  store.delete(STORE_KEYS.ACCESS_TOKEN)
  console.log('[DEBUG][auth/events] USER_PROFILE after delete:', store.get(STORE_KEYS.USER_PROFILE))
  grpcClient.setAuthToken(null)
  syncService.stop()
}

// Check if token needs refresh (5 minutes before expiry)
export const shouldRefreshToken = (expiresAt: number): boolean => {
  const fiveMinutes = 5 * 60 * 1000
  return Date.now() >= expiresAt - fiveMinutes
}

// Check token validity (Supabase handles actual refresh)
export const ensureValidTokens = async () => {
  const storedAuth = store.get(STORE_KEYS.AUTH)
  const tokens = storedAuth?.tokens

  if (!tokens || !tokens.access_token) {
    return { success: false, error: 'No access token available' }
  }

  if (tokens.expires_at && shouldRefreshToken(tokens.expires_at)) {
    console.log('Access token needs refresh')
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('auth-token-expired')
    }
    return { success: false, error: 'Token expired, requires re-authentication' }
  }

  return { success: true, tokens }
}
