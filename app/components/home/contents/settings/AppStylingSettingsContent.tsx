import { useEffect, useState, useCallback } from 'react'
import { useAppStylingStore } from '@/app/store/useAppStylingStore'
import { AppStylingRow } from './AppStylingRow'
import { RegisterAppDialog } from './RegisterAppDialog'
import { Button } from '@/app/components/ui/button'
import { Crosshair } from 'lucide-react'

export default function AppStylingSettingsContent() {
  const {
    appTargets,
    tones,
    isLoading,
    detectedContext,
    loadAppTargets,
    loadTones,
    detectCurrentApp,
    clearDetectedContext,
  } = useAppStylingStore()

  const [isDetecting, setIsDetecting] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [status, setStatus] = useState<string | null>(null)

  useEffect(() => {
    loadAppTargets()
    loadTones()
  }, [loadAppTargets, loadTones])

  useEffect(() => {
    if (detectedContext) {
      setDialogOpen(true)
    }
  }, [detectedContext])

  const handleDetectApp = useCallback(async () => {
    setStatus(null)
    setIsDetecting(true)

    try {
      const context = await detectCurrentApp()
      if (!context) {
        setStatus('No app detected - click on target app when window minimizes')
        setTimeout(() => setStatus(null), 5000)
      }
    } catch (error) {
      console.error('Failed to detect app:', error)
      setStatus('Error detecting app')
      setTimeout(() => setStatus(null), 3000)
    } finally {
      setIsDetecting(false)
    }
  }, [detectCurrentApp])

  const handleDialogClose = (open: boolean) => {
    setDialogOpen(open)
    if (!open) {
      clearDetectedContext()
    }
  }

  const sortedApps = Object.values(appTargets).sort((a, b) =>
    a.name.localeCompare(b.name)
  )
  const toneOptions = Object.values(tones).sort((a, b) => a.sortOrder - b.sortOrder)

  const getButtonContent = () => {
    if (isDetecting) {
      return (
        <>
          <span className="animate-pulse">Click target app now...</span>
        </>
      )
    }
    if (status) return status
    return (
      <>
        <Crosshair className="h-4 w-4 mr-2" />
        Detect Current App
      </>
    )
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
            Choose how your transcriptions sound based on which app or website you're
            using.
          </p>
        </div>
        <Button
          onClick={handleDetectApp}
          variant="outline"
          disabled={isDetecting}
        >
          {getButtonContent()}
        </Button>
      </div>

      {sortedApps.length === 0 ? (
        <div className="border rounded-lg p-8 text-center">
          <h3 className="font-medium mb-2">No apps registered yet</h3>
          <ol className="text-sm text-gray-600 text-left max-w-md mx-auto space-y-1">
            <li>1. Open the app or website you want to style</li>
            <li>2. Click "Detect Current App" above</li>
            <li>3. Click on your target app/website when this window minimizes</li>
            <li>4. Choose to match by app or domain (for browsers)</li>
            <li>5. Select a writing style for that target</li>
          </ol>
        </div>
      ) : (
        <div className="border rounded-lg divide-y">
          {sortedApps.map(app => (
            <AppStylingRow key={app.id} app={app} tones={toneOptions} />
          ))}
        </div>
      )}

      <RegisterAppDialog
        open={dialogOpen}
        onOpenChange={handleDialogClose}
        context={detectedContext}
      />
    </div>
  )
}
