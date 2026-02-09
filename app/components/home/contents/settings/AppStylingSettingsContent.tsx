import { useEffect, useState, useCallback } from 'react'
import { useAppStylingStore } from '@/app/store/useAppStylingStore'
import { AppStylingRow } from './AppStylingRow'
import { Button } from '@/app/components/ui/button'

export default function AppStylingSettingsContent() {
  const {
    appTargets,
    tones,
    isLoading,
    loadAppTargets,
    loadTones,
    registerCurrentApp,
  } = useAppStylingStore()

  const [isRegistering, setIsRegistering] = useState(false)
  const [status, setStatus] = useState<string | null>(null)

  useEffect(() => {
    loadAppTargets()
    loadTones()
  }, [loadAppTargets, loadTones])

  const handleRegisterApp = useCallback(async () => {
    setStatus(null)
    setIsRegistering(true)

    try {
      const result = await registerCurrentApp()
      if (result) {
        setStatus(`Registered: ${result.name}`)
        setTimeout(() => setStatus(null), 3000)
      } else {
        setStatus('No app detected - click on target app when window minimizes')
        setTimeout(() => setStatus(null), 5000)
      }
    } catch (error) {
      console.error('Failed to register app:', error)
      setStatus('Error detecting app')
      setTimeout(() => setStatus(null), 3000)
    } finally {
      setIsRegistering(false)
    }
  }, [registerCurrentApp])

  const sortedApps = Object.values(appTargets).sort((a, b) =>
    a.name.localeCompare(b.name)
  )
  const toneOptions = Object.values(tones).sort((a, b) => a.sortOrder - b.sortOrder)

  const getButtonText = () => {
    if (isRegistering) return 'Click target app now...'
    if (status) return status
    return 'Register Current App'
  }

  if (isLoading) {
    return <div className="p-6">Loading...</div>
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <div className="text-lg font-medium">App Styling</div>
          <p className="text-sm text-gray-600 mt-1">
            Choose how your transcriptions sound based on which app you're
            using.
          </p>
        </div>
        <Button
          onClick={handleRegisterApp}
          variant="outline"
          disabled={isRegistering}
        >
          {getButtonText()}
        </Button>
      </div>

      {sortedApps.length === 0 ? (
        <div className="border rounded-lg p-8 text-center">
          <h3 className="font-medium mb-2">No apps registered yet</h3>
          <ol className="text-sm text-gray-600 text-left max-w-md mx-auto space-y-1">
            <li>1. Open the app you want to style (Slack, Outlook, etc.)</li>
            <li>2. Click "Register Current App" above</li>
            <li>3. Click on your target app when this window minimizes</li>
            <li>4. Select a writing style for that app</li>
          </ol>
        </div>
      ) : (
        <div className="border rounded-lg divide-y">
          {sortedApps.map(app => (
            <AppStylingRow key={app.id} app={app} tones={toneOptions} />
          ))}
        </div>
      )}
    </div>
  )
}
