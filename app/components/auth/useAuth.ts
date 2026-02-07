import { useCallback, useEffect, useMemo } from 'react'
import { useAuthStore } from '../../store/useAuthStore'
import { type AuthUser, type AuthTokens } from '../../../lib/main/store'
import { useMainStore } from '@/app/store/useMainStore'
import { analytics, ANALYTICS_EVENTS } from '../analytics'
import { STORE_KEYS } from '../../../lib/constants/store-keys'
import { useOnboardingStore } from '@/app/store/useOnboardingStore'
import { supabase, AUTH_DISABLED } from './supabaseClient'
import { useSupabaseContext } from './SupabaseProvider'

const noopAsync = async () => {}
const noopAsyncSuccess = async () => ({ success: true as const })

const localUser: AuthUser = {
  id: 'local-user',
  email: 'local@ito.app',
  name: 'Local User',
  picture: undefined,
  provider: 'local',
}

const localTokens: AuthTokens = {
  accessToken: 'local-token',
  idToken: 'local-id-token',
  refreshToken: 'local-refresh-token',
  expiresAt: Date.now() + 365 * 24 * 60 * 60 * 1000,
}

export function useAuth() {
  const { session, user: supabaseUser, isLoading: supabaseLoading } = useSupabaseContext()
  const {
    user: storedUser,
    tokens,
    setAuthData,
    clearAuth,
    isAuthenticated: storeIsAuthenticated,
    setName,
    setSelfHostedMode,
  } = useAuthStore()

  const { resetState: resetMainState } = useMainStore()
  const { resetOnboarding } = useOnboardingStore()

  const authUser = useMemo<AuthUser | null>(() => {
    if (AUTH_DISABLED) return localUser
    if (!session || !supabaseUser) return storedUser
    return {
      id: supabaseUser.id,
      email: supabaseUser.email || '',
      name: supabaseUser.user_metadata?.full_name || supabaseUser.email?.split('@')[0] || 'User',
      picture: supabaseUser.user_metadata?.avatar_url,
      provider: 'email',
    }
  }, [session, supabaseUser, storedUser])

  const isAuthenticated = useMemo(() => {
    if (AUTH_DISABLED) return true
    return !!session && !!supabaseUser
  }, [session, supabaseUser])

  const isLoading = useMemo(() => {
    if (AUTH_DISABLED) return false
    return supabaseLoading
  }, [supabaseLoading])

  useEffect(() => {
    if (AUTH_DISABLED) {
      if (!storeIsAuthenticated) {
        setSelfHostedMode()
      }
      return
    }

    if (session && supabaseUser && authUser) {
      const authTokens: AuthTokens = {
        access_token: session.access_token,
        id_token: session.access_token,
        refresh_token: session.refresh_token || '',
        expires_at: session.expires_at ? session.expires_at * 1000 : Date.now() + 3600 * 1000,
      }
      setAuthData(authTokens, authUser, 'email')
    }
  }, [session, supabaseUser, authUser, setAuthData, storeIsAuthenticated, setSelfHostedMode])

  const signupWithEmail = useCallback(
    async (email: string, password: string, fullName?: string) => {
      if (AUTH_DISABLED || !supabase) {
        return { success: true as const, userId: 'local-user' }
      }

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
          },
        },
      })

      if (error) {
        throw new Error(error.message)
      }

      if (data.user) {
        analytics.track(ANALYTICS_EVENTS.SIGNUP_COMPLETED, {
          provider: 'email',
          email,
        })
      }

      return { success: true as const, userId: data.user?.id }
    },
    [],
  )

  const loginWithEmailPassword = useCallback(
    async (
      email: string,
      password: string,
      options?: { skipNavigate?: boolean },
    ) => {
      if (AUTH_DISABLED || !supabase) {
        return { success: true as const }
      }

      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) {
        throw new Error(error.message)
      }

      if (data.user) {
        analytics.track(ANALYTICS_EVENTS.LOGIN_COMPLETED, {
          provider: 'email',
          email,
        })
      }

      return { success: true as const }
    },
    [],
  )

  const logoutUser = useCallback(async () => {
    if (AUTH_DISABLED || !supabase) {
      return
    }

    try {
      await supabase.auth.signOut()
    } catch (error) {
      console.error('Logout error:', error)
    }

    clearAuth()
    resetMainState()
    resetOnboarding()

    analytics.track(ANALYTICS_EVENTS.LOGOUT_COMPLETED)
  }, [clearAuth, resetMainState, resetOnboarding])

  const getAccessToken = useCallback(async (): Promise<string> => {
    if (AUTH_DISABLED) return 'local-token'
    return session?.access_token || ''
  }, [session])

  const refreshTokens = useCallback(async () => {
    if (AUTH_DISABLED || !supabase) return

    const { data, error } = await supabase.auth.refreshSession()
    if (error) {
      console.error('Token refresh error:', error)
    }
  }, [])

  const getIdTokenClaims = useCallback(async () => {
    if (AUTH_DISABLED) {
      return {
        email: localUser.email,
        name: localUser.name,
        sub: localUser.id,
      }
    }
    return {
      email: supabaseUser?.email,
      name: supabaseUser?.user_metadata?.full_name,
      sub: supabaseUser?.id,
    }
  }, [supabaseUser])

  const createDatabaseUser = useCallback(
    async (email: string, password: string, fullName: string) => {
      const result = await signupWithEmail(email, password, fullName)
      return { _id: result.userId || 'local' }
    },
    [signupWithEmail],
  )

  const loginWithGoogle = useCallback(async () => {
    console.warn('Google login not available - use email/password')
  }, [])

  const loginWithMicrosoft = useCallback(async () => {
    console.warn('Microsoft login not available - use email/password')
  }, [])

  const loginWithApple = useCallback(async () => {
    console.warn('Apple login not available - use email/password')
  }, [])

  const loginWithGitHub = useCallback(async () => {
    console.warn('GitHub login not available - use email/password')
  }, [])

  const loginWithEmail = useCallback(async () => {
    console.warn('Magic link login not available - use email/password')
  }, [])

  const loginWithSelfHosted = useCallback(async () => {
    if (!supabase) {
      setSelfHostedMode()
    }
  }, [setSelfHostedMode])

  if (AUTH_DISABLED) {
    return {
      user: localUser,
      isAuthenticated: true,
      isLoading: false,
      error: undefined,
      loginWithGoogle: noopAsync,
      loginWithMicrosoft: noopAsync,
      loginWithApple: noopAsync,
      loginWithGitHub: noopAsync,
      loginWithEmail: noopAsync,
      loginWithEmailPassword: noopAsyncSuccess,
      signupWithEmail: noopAsyncSuccess,
      createDatabaseUser: async () => ({ _id: 'local' }),
      loginWithSelfHosted: noopAsync,
      logoutUser: noopAsync,
      getAccessToken: async () => 'local-token',
      getIdTokenClaims,
      refreshTokens: noopAsync,
    }
  }

  return {
    user: authUser,
    isAuthenticated,
    isLoading,
    error: undefined,
    loginWithGoogle,
    loginWithMicrosoft,
    loginWithApple,
    loginWithGitHub,
    loginWithEmail,
    loginWithEmailPassword,
    signupWithEmail,
    createDatabaseUser,
    loginWithSelfHosted,
    logoutUser,
    getAccessToken,
    getIdTokenClaims,
    refreshTokens,
  }
}
