import React, { useState, useEffect, useMemo, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Sparkles } from 'lucide-react'
import { useSettingsStore } from '../../store/useSettingsStore'
import {
  useOnboardingStore,
  ONBOARDING_CATEGORIES,
} from '../../store/useOnboardingStore'
import { analytics, ANALYTICS_EVENTS } from '../analytics'
import type {
  RecordingStatePayload,
  ProcessingStatePayload,
} from '@/lib/types/ipc'
import { UIState } from './types'
import { ItoLogo, WaveformIcon } from './Icons'

const globalStyles = `
  html, body, #app {
    height: 100%;
    margin: 0;
    overflow: hidden;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;

    display: flex;
    align-items: flex-start;
    justify-content: center;

    pointer-events: none;
    background: transparent;

    font-family:
      'Inter',
      system-ui,
      -apple-system,
      BlinkMacSystemFont,
      'Segoe UI',
      Roboto,
      sans-serif;
  }
`

const BAR_UPDATE_INTERVAL = 64

const DynamicNotch: React.FC = () => {
  const initialShowItoBarAlways = useSettingsStore(
    state => state.showItoBarAlways,
  )
  const initialOnboardingCategory = useOnboardingStore(
    state => state.onboardingCategory,
  )
  const initialOnboardingCompleted = useOnboardingStore(
    state => state.onboardingCompleted,
  )

  const [isRecording, setIsRecording] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [showItoBarAlways, setShowItoBarAlways] = useState(
    initialShowItoBarAlways,
  )
  const [onboardingCategory, setOnboardingCategory] = useState(
    initialOnboardingCategory,
  )
  const [onboardingCompleted, setOnboardingCompleted] = useState(
    initialOnboardingCompleted,
  )
  const [volumeHistory, setVolumeHistory] = useState<number[]>([])
  const lastVolumeUpdateRef = useRef(0)

  useEffect(() => {
    const unsubRecording = window.api.on(
      'recording-state-update',
      (state: RecordingStatePayload) => {
        setIsRecording(state.isRecording)

        const analyticsEvent = state.isRecording
          ? ANALYTICS_EVENTS.RECORDING_STARTED
          : ANALYTICS_EVENTS.RECORDING_COMPLETED
        analytics.track(analyticsEvent, {
          is_recording: state.isRecording,
          mode: state.mode,
        })

        if (!state.isRecording) {
          setVolumeHistory([])
        }
      },
    )

    const unsubProcessing = window.api.on(
      'processing-state-update',
      (state: ProcessingStatePayload) => {
        setIsProcessing(state.isProcessing)
      },
    )

    const unsubVolume = window.api.on('volume-update', (vol: number) => {
      const now = Date.now()
      if (now - lastVolumeUpdateRef.current < BAR_UPDATE_INTERVAL) {
        return
      }
      setVolumeHistory(prev => {
        const newHistory = [...prev, vol]
        if (newHistory.length > 42) {
          newHistory.shift()
        }
        return newHistory
      })
      lastVolumeUpdateRef.current = now
    })

    const unsubSettings = window.api.on('settings-update', (settings: any) => {
      setShowItoBarAlways(settings.showItoBarAlways)
    })

    const unsubOnboarding = window.api.on(
      'onboarding-update',
      (onboarding: any) => {
        setOnboardingCategory(onboarding.onboardingCategory)
        setOnboardingCompleted(onboarding.onboardingCompleted)
      },
    )

    const unsubUserAuth = window.api.on('user-auth-update', (authUser: any) => {
      if (authUser) {
        analytics.identifyUser(
          authUser.id,
          {
            user_id: authUser.id,
            email: authUser.email,
            name: authUser.name,
            provider: authUser.provider,
          },
          authUser.provider,
        )
      } else {
        analytics.resetUser()
      }
    })

    return () => {
      unsubRecording()
      unsubProcessing()
      unsubVolume()
      unsubSettings()
      unsubOnboarding()
      unsubUserAuth()
    }
  }, [])

  const uiState = isProcessing
    ? UIState.THINKING
    : isRecording
      ? UIState.LISTENING
      : UIState.IDLE

  const { width, height } = useMemo(() => {
    if (uiState === UIState.LISTENING || uiState === UIState.THINKING) {
      return { width: 360, height: 46 }
    }
    return { width: 200, height: 46 }
  }, [uiState])

  const isOnboarded =
    onboardingCategory === ONBOARDING_CATEGORIES.TRY_IT || onboardingCompleted

  const shouldShow =
    isOnboarded && (isRecording || isProcessing || showItoBarAlways)

  const pillStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    width: `${width}px`,
    height: `${height}px`,
    background: 'linear-gradient(to bottom, #000000, #141414)',
    boxShadow:
      '0 10px 30px rgba(0,0,0,0.8), inset 0 -1px 0 rgba(255,255,255,0.15), inset 0 -8px 12px rgba(255,255,255,0.02)',
    border: '1px solid rgba(255,255,255,0.05)',
    borderTop: 'none',
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
    borderBottomLeftRadius: '20px',
    borderBottomRightRadius: '20px',
    overflow: 'hidden',
    backdropFilter: 'blur(40px) saturate(1.5)',
    WebkitBackdropFilter: 'blur(40px) saturate(1.5)',
    pointerEvents: shouldShow ? 'auto' : 'none',
    opacity: shouldShow ? 1 : 0,
    transform: shouldShow ? 'scale(1) translateY(0)' : 'scale(0.9) translateY(-10px)',
    transition: 'width 0.3s ease, height 0.3s ease, opacity 0.3s ease, transform 0.3s ease',
  }

  const renderStateIndicator = () => {
    if (uiState === UIState.IDLE) {
      return (
        <div
          style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            backgroundColor: 'rgba(255,255,255,0.2)',
          }}
        />
      )
    }

    if (uiState === UIState.LISTENING) {
      return <WaveformIcon volumeHistory={volumeHistory} />
    }

    if (uiState === UIState.THINKING) {
      return (
        <motion.div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <motion.div
            animate={{ rotate: 360, scale: [1, 1.1, 1] }}
            transition={{
              rotate: { repeat: Infinity, duration: 3, ease: 'linear' },
              scale: { repeat: Infinity, duration: 2 },
            }}
          >
            <Sparkles
              style={{ width: '16px', height: '16px', color: '#007AFF' }}
              fill="currentColor"
            />
          </motion.div>
          <span
            style={{
              fontSize: '14px',
              fontWeight: 500,
              color: '#007AFF',
            }}
          >
            Thinking
          </span>
        </motion.div>
      )
    }

    return null
  }

  return (
    <>
      <style>{globalStyles}</style>
      <div style={pillStyle}>
        <div
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 20px',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              flexShrink: 0,
            }}
          >
            <ItoLogo className="w-6 h-6" />
            <span
              style={{
                fontSize: '14px',
                fontWeight: 600,
                letterSpacing: '0.025em',
                color: 'white',
              }}
            >
              Ito
            </span>
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={uiState}
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.2 }}
            >
              {renderStateIndicator()}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </>
  )
}

export default DynamicNotch
