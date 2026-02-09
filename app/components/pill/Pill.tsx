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

const springTransition = {
  type: 'spring' as const,
  stiffness: 400,
  damping: 30,
  mass: 0.5,
  restDelta: 0.001,
}

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

  const { width, height, borderBottomRadius } = useMemo(() => {
    if (uiState === UIState.LISTENING || uiState === UIState.THINKING) {
      return { width: 360, height: 46, borderBottomRadius: 20 }
    }
    return { width: 200, height: 46, borderBottomRadius: 20 }
  }, [uiState])

  const shouldShow =
    (onboardingCategory === ONBOARDING_CATEGORIES.TRY_IT ||
      onboardingCompleted) &&
    (isRecording || isProcessing || showItoBarAlways)

  return (
    <>
      <style>{globalStyles}</style>
      <div className="fixed top-0 left-0 w-full flex justify-center z-50 pointer-events-none">
        <motion.div
          layout="preserve-aspect"
          initial={false}
          animate={{
            width,
            height,
            borderBottomLeftRadius: borderBottomRadius,
            borderBottomRightRadius: borderBottomRadius,
            opacity: shouldShow ? 1 : 0,
            scale: shouldShow ? 1 : 0.8,
          }}
          transition={springTransition}
          className="relative flex items-center pointer-events-auto backdrop-blur-[40px] saturate-150 overflow-hidden rounded-t-none border-t-0
            bg-gradient-to-b from-black to-[#141414] 
            shadow-[0_10px_30px_rgba(0,0,0,0.8),inset_0_-1px_0_rgba(255,255,255,0.15),inset_0_-8px_12px_rgba(255,255,255,0.02)] 
            border-x border-b border-white/5 ring-1 ring-white/5"
          style={{
            transform: 'translateZ(0)',
            willChange: 'width, height',
            visibility: shouldShow ? 'visible' : 'hidden',
          }}
        >
          <motion.div className="absolute inset-0 w-full h-full flex items-center justify-between px-5">
            <div className="flex items-center gap-3 shrink-0">
              <ItoLogo className="w-6 h-6" />
              <span className="text-[14px] font-semibold tracking-wide text-white">
                Ito
              </span>
            </div>

            <AnimatePresence mode="wait">
              {uiState === UIState.IDLE && (
                <motion.div
                  key="idle-dot"
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="w-2 h-2 rounded-full bg-white/20"
                />
              )}

              {uiState === UIState.LISTENING && (
                <motion.div
                  key="listening"
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 10 }}
                  transition={{ duration: 0.2 }}
                >
                  <WaveformIcon volumeHistory={volumeHistory} />
                </motion.div>
              )}

              {uiState === UIState.THINKING && (
                <motion.div
                  key="thinking"
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 10 }}
                  transition={{ duration: 0.2 }}
                  className="flex items-center gap-2"
                >
                  <motion.div
                    animate={{ rotate: 360, scale: [1, 1.1, 1] }}
                    transition={{
                      rotate: { repeat: Infinity, duration: 3, ease: 'linear' },
                      scale: { repeat: Infinity, duration: 2 },
                    }}
                  >
                    <Sparkles
                      className="w-4 h-4 text-[#007AFF]"
                      fill="currentColor"
                    />
                  </motion.div>
                  <span className="text-[14px] font-medium text-[#007AFF]">
                    Thinking
                  </span>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </motion.div>
      </div>
    </>
  )
}

export default DynamicNotch
