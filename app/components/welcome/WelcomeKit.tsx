import CreateAccountContent from './contents/CreateAccountContent'
import SignInContent from './contents/SignInContent'
import ReferralContent from './contents/ReferralContent'
import DataControlContent from './contents/DataControlContent'
import PermissionsContent from './contents/PermissionsContent'
import MicrophoneTestContent from './contents/MicrophoneTestContent'
import KeyboardTestContext from './contents/KeyboardTestContext'
import GoodToGoContent from './contents/GoodToGoContent'
import AnyAppContent from './contents/AnyAppContent'
import TryItOutContent from './contents/TryItOutContent'
import { useEffect } from 'react'
import './styles.css'
import { usePermissionsStore } from '../../store/usePermissionsStore'
import { useOnboardingStore } from '@/app/store/useOnboardingStore'
import { useAuthStore } from '@/app/store/useAuthStore'
import IntroducingIntelligentModeContent from './contents/IntroducingIntelligentModeContent'

export default function WelcomeKit() {
  const { onboardingStep, incrementOnboardingStep } = useOnboardingStore()
  const { isAuthenticated, user } = useAuthStore()

  const onboardingStepOrder = [
    CreateAccountContent,
    ReferralContent,
    DataControlContent,
    PermissionsContent,
    MicrophoneTestContent,
    KeyboardTestContext,
    GoodToGoContent,
    IntroducingIntelligentModeContent,
    AnyAppContent,
    TryItOutContent,
  ]

  const { setAccessibilityEnabled, setMicrophoneEnabled } =
    usePermissionsStore()

  useEffect(() => {
    window.api
      .invoke('check-accessibility-permission', false)
      .then((enabled: boolean) => {
        setAccessibilityEnabled(enabled)
      })

    window.api
      .invoke('check-microphone-permission', false)
      .then((enabled: boolean) => {
        setMicrophoneEnabled(enabled)
      })
  }, [setAccessibilityEnabled, setMicrophoneEnabled])

  useEffect(() => {
    if (isAuthenticated && onboardingStep === 0) {
      incrementOnboardingStep()
    }
  }, [isAuthenticated, onboardingStep, incrementOnboardingStep])

  if (!isAuthenticated) {
    if (user) {
      return <SignInContent />
    } else {
      return <CreateAccountContent />
    }
  }

  if (onboardingStep === 0) {
    return null
  }

  const CurrentComponent = onboardingStepOrder[onboardingStep]

  return (
    <div className="w-full h-full bg-background">
      {CurrentComponent ? <CurrentComponent /> : null}
    </div>
  )
}
