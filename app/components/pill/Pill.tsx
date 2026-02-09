import React, { useEffect, useMemo, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, StopSquare } from '@mynaui/icons-react'
import { Sparkles } from 'lucide-react'
import { useSettingsStore } from '../../store/useSettingsStore'
import {
  useOnboardingStore,
  ONBOARDING_CATEGORIES,
} from '../../store/useOnboardingStore'
import { Tooltip, TooltipTrigger, TooltipContent } from '../ui/tooltip'
import { AudioBars } from './contents/AudioBars'
import { useAudioStore } from '@/app/store/useAudioStore'
import { TooltipButton } from './contents/TooltipButton'
import { analytics, ANALYTICS_EVENTS } from '../analytics'
import type {
  RecordingStatePayload,
  ProcessingStatePayload,
} from '@/lib/types/ipc'
import { ItoMode } from '@/app/generated/ito_pb'
import { ItoIcon } from '../icons/ItoIcon'

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

const getAudioBarColor = (mode: ItoMode | undefined): string => {
  switch (mode) {
    case ItoMode.TRANSCRIBE:
      return 'white'
    case ItoMode.EDIT:
      return '#FFCF40'
    default:
      return 'white'
  }
}

enum UIState {
  IDLE = 'idle',
  LISTENING = 'listening',
  THINKING = 'thinking',
}

const springTransition = {
  type: 'spring' as const,
  stiffness: 400,
  damping: 30,
  mass: 0.5,
  restDelta: 0.001,
}

const Pill = () => {
  const initialShowItoBarAlways = useSettingsStore(
    state => state.showItoBarAlways,
  )
  const initialOnboardingCategory = useOnboardingStore(
    state => state.onboardingCategory,
  )
  const initialOnboardingCompleted = useOnboardingStore(
    state => state.onboardingCompleted,
  )
  const { startRecording, stopRecording } = useAudioStore()

  const [isRecording, setIsRecording] = useState(false)
  const [isManualRecording, setIsManualRecording] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [isHovered, setIsHovered] = useState(false)
  const [recordingMode, setRecordingMode] = useState<ItoMode | undefined>()
  const isManualRecordingRef = useRef(false)
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
  const [lastVolumeUpdate, setLastVolumeUpdate] = useState(0)

  useEffect(() => {
    const unsubRecording = window.api.on(
      'recording-state-update',
      (state: RecordingStatePayload) => {
        setIsRecording(state.isRecording)
        setRecordingMode(state.mode ?? recordingMode)

        if (!isManualRecordingRef.current) {
          const analyticsEvent = state.isRecording
            ? ANALYTICS_EVENTS.RECORDING_STARTED
            : ANALYTICS_EVENTS.RECORDING_COMPLETED
          analytics.track(analyticsEvent, {
            is_recording: state.isRecording,
            mode: state.mode,
          })
        }

        if (!state.isRecording) {
          setIsManualRecording(false)
          isManualRecordingRef.current = false
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
      if (now - lastVolumeUpdate < BAR_UPDATE_INTERVAL) {
        return
      }
      const newVolumeHistory = [...volumeHistory, vol]
      if (newVolumeHistory.length > 42) {
        newVolumeHistory.shift()
      }
      setVolumeHistory(newVolumeHistory)
      setLastVolumeUpdate(now)
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
  }, [volumeHistory, lastVolumeUpdate, recordingMode])

  const anyRecording = isRecording || isManualRecording
  const shouldShow =
    (onboardingCategory === ONBOARDING_CATEGORIES.TRY_IT ||
      onboardingCompleted) &&
    (anyRecording || isProcessing || showItoBarAlways || isHovered)

  const uiState = isProcessing
    ? UIState.THINKING
    : anyRecording
      ? UIState.LISTENING
      : UIState.IDLE

  const { width, height, borderBottomRadius } = useMemo(() => {
    if (uiState === UIState.IDLE) {
      return { width: 200, height: 46, borderBottomRadius: 20 }
    }
    return { width: 360, height: 46, borderBottomRadius: 20 }
  }, [uiState])

  const barColor = getAudioBarColor(recordingMode)

  const handleMouseEnter = () => {
    setIsHovered(true)
    if (window.api?.setPillMouseEvents) {
      window.api.setPillMouseEvents(false)
    }
  }

  const handleMouseLeave = () => {
    setIsHovered(false)
    if (window.api?.setPillMouseEvents) {
      window.api.setPillMouseEvents(true, { forward: true })
    }
  }

  const handleClick = () => {
    if (isHovered && !anyRecording) {
      setIsManualRecording(true)
      isManualRecordingRef.current = true
      startRecording()

      analytics.track(ANALYTICS_EVENTS.MANUAL_RECORDING_STARTED, {
        is_recording: true,
      })
    }
  }

  const handleCancel = (e: React.MouseEvent) => {
    e.stopPropagation()
    setIsManualRecording(false)
    stopRecording()

    analytics.track(ANALYTICS_EVENTS.MANUAL_RECORDING_ABANDONED, {
      is_recording: false,
    })
  }

  const handleStop = (e: React.MouseEvent) => {
    e.stopPropagation()
    setIsManualRecording(false)
    stopRecording()

    analytics.track(ANALYTICS_EVENTS.MANUAL_RECORDING_COMPLETED, {
      is_recording: false,
    })
  }

  return (
    <>
      <style>{globalStyles}</style>
      <Tooltip>
        <div className="fixed top-0 left-0 w-full flex justify-center z-50 pointer-events-none">
          <TooltipTrigger asChild>
            <motion.div
              layout="preserve-aspect"
              initial={false}
              animate={{
                width,
                height,
                borderBottomLeftRadius: borderBottomRadius,
                borderBottomRightRadius: borderBottomRadius,
                opacity: shouldShow ? 1 : 0,
                scale: shouldShow ? 1 : 0.96,
              }}
              transition={springTransition}
              className="relative flex flex-col items-center pointer-events-auto backdrop-blur-[40px] saturate-150 overflow-hidden transition-all duration-500 rounded-t-none border-t-0 bg-gradient-to-b from-black to-[#141414] shadow-[0_10px_30px_rgba(0,0,0,0.8),inset_0_-1px_0_rgba(255,255,255,0.15),inset_0_-8px_12px_rgba(255,255,255,0.02)] border-x border-b border-white/5 ring-1 ring-white/5"
              style={{
                transform: 'translateZ(0)',
                willChange: 'width, height',
                backfaceVisibility: 'hidden',
                visibility: shouldShow ? 'visible' : 'hidden',
                pointerEvents: shouldShow ? 'auto' : 'none',
                transformOrigin: 'top center',
              }}
              onMouseEnter={handleMouseEnter}
              onMouseLeave={handleMouseLeave}
              onClick={handleClick}
            >
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={uiState}
                  className="absolute inset-0 w-full h-full flex items-center justify-between px-5"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0, transition: { duration: 0.1 } }}
                  transition={{ duration: 0.2 }}
                >
                  <div className="flex items-center gap-3 shrink-0">
                    <motion.div
                      key="ito-logo"
                      initial={{ scale: 0.5, opacity: 0, rotate: -20 }}
                      animate={{ scale: 1, opacity: 1, rotate: 0 }}
                      exit={{ scale: 0.5, opacity: 0, rotate: 20 }}
                      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                      className="relative z-10 flex items-center justify-center w-6 h-6"
                    >
                      <ItoIcon className="w-5 h-5 text-white" />
                    </motion.div>

                    <motion.span
                      layout
                      className="text-[14px] font-semibold tracking-wide whitespace-nowrap overflow-hidden text-white"
                    >
                      Ito
                    </motion.span>
                  </div>

                  <div className="flex items-center justify-end h-full">
                    <AnimatePresence mode="wait">
                      {uiState === UIState.IDLE && (
                        <motion.div
                          key="idle-dot"
                          initial={{ scale: 0, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          exit={{ scale: 0, opacity: 0 }}
                          className="relative w-2 h-2 mr-1"
                        >
                          <div className="w-full h-full rounded-full bg-white/20" />
                        </motion.div>
                      )}

                      {uiState === UIState.LISTENING && (
                        <motion.div
                          key="listening"
                          initial={{ opacity: 0, x: 10 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: 10 }}
                          className="flex items-center gap-2"
                        >
                          {isManualRecording && (
                            <TooltipButton
                              onClick={handleCancel}
                              icon={<X width={14} height={14} color="white" />}
                              tooltip="Cancel"
                            />
                          )}
                          <div className="h-full flex items-center">
                            <AudioBars
                              volumeHistory={volumeHistory}
                              barColor={barColor}
                            />
                          </div>
                          {isManualRecording && (
                            <TooltipButton
                              onClick={handleStop}
                              icon={
                                <StopSquare
                                  width={14}
                                  height={14}
                                  color="#ef4444"
                                />
                              }
                              tooltip="Stop and paste"
                            />
                          )}
                        </motion.div>
                      )}

                      {uiState === UIState.THINKING && (
                        <motion.div
                          key="thinking"
                          initial={{ opacity: 0, x: 10 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: 10 }}
                          className="flex items-center gap-2"
                        >
                          <motion.div
                            animate={{ rotate: 360, scale: [1, 1.1, 1] }}
                            transition={{
                              rotate: {
                                repeat: Infinity,
                                duration: 3,
                                ease: 'linear',
                              },
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
                  </div>
                </motion.div>
              </AnimatePresence>
            </motion.div>
          </TooltipTrigger>
        </div>
        {isHovered && !anyRecording && (
          <TooltipContent
            side="top"
            style={{
              backgroundColor: 'rgba(0, 0, 0, 0.8)',
              color: 'white',
              padding: '6px 8px',
              fontSize: '14px',
              marginBottom: '6px',
              borderRadius: '8px',
            }}
            className="border-none rounded-md"
          >
            Click and start speaking
          </TooltipContent>
        )}
      </Tooltip>
    </>
  )
}

export default Pill
