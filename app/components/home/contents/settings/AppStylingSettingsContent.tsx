import { useEffect } from 'react'
import {
  useAppStylingStore,
  type AppTarget,
  type Tone,
} from '@/app/store/useAppStylingStore'
import { Button } from '@/app/components/ui/button'
import { Trash2, ChevronDown } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/app/components/ui/dropdown-menu'

type AppStylingRowProps = {
  app: AppTarget
  tones: Tone[]
}

function AppStylingRow({ app, tones }: AppStylingRowProps) {
  const { updateAppTone, deleteAppTarget } = useAppStylingStore()

  const currentTone = tones.find(t => t.id === (app.toneId || 'polished'))

  return (
    <div className="flex items-center gap-4 p-4">
      <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center overflow-hidden">
        {app.iconBase64 ? (
          <img
            src={`data:image/png;base64,${app.iconBase64}`}
            alt={app.name}
            className="w-8 h-8"
          />
        ) : (
          <span className="text-lg font-medium text-slate-600">
            {app.name.charAt(0).toUpperCase()}
          </span>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <p className="font-medium truncate text-sm">{app.name}</p>
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" className="w-36 justify-between">
            <span>{currentTone?.name || 'Polished'}</span>
            <ChevronDown className="h-4 w-4 opacity-50" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-36">
          {tones.map(tone => (
            <DropdownMenuItem
              key={tone.id}
              onClick={() => updateAppTone(app.id, tone.id)}
              className={tone.id === (app.toneId || 'polished') ? 'bg-slate-100' : ''}
            >
              {tone.name}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <Button
        variant="ghost"
        size="icon"
        onClick={() => deleteAppTarget(app.id)}
        className="text-slate-400 hover:text-red-500"
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  )
}

export default function AppStylingSettingsContent() {
  const {
    appTargets,
    tones,
    isLoading,
    loadAppTargets,
    loadTones,
    registerCurrentApp,
  } = useAppStylingStore()

  useEffect(() => {
    loadAppTargets()
    loadTones()
  }, [loadAppTargets, loadTones])

  const sortedApps = Object.values(appTargets).sort((a, b) =>
    a.name.localeCompare(b.name),
  )
  const toneOptions = Object.values(tones).sort((a, b) => a.sortOrder - b.sortOrder)

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <span className="text-sm text-slate-500">Loading...</span>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h3 className="text-md font-medium text-slate-900 mb-1">App Styling</h3>
          <p className="text-xs text-slate-500">
            Choose how your transcriptions sound based on which app you&apos;re
            using.
          </p>
        </div>
        <Button onClick={registerCurrentApp} variant="outline" size="sm">
          Register Current App
        </Button>
      </div>

      {sortedApps.length === 0 ? (
        <div className="border border-slate-200 rounded-lg p-8 text-center bg-slate-50">
          <h4 className="font-medium text-slate-700 mb-2">
            No apps registered yet
          </h4>
          <ol className="text-sm text-slate-500 text-left max-w-sm mx-auto space-y-1">
            <li>1. Open the app you want to style (Slack, Outlook, etc.)</li>
            <li>2. Click &quot;Register Current App&quot; above</li>
            <li>3. Select a writing style for that app</li>
          </ol>
        </div>
      ) : (
        <div className="border border-slate-200 rounded-lg divide-y divide-slate-200">
          {sortedApps.map(app => (
            <AppStylingRow key={app.id} app={app} tones={toneOptions} />
          ))}
        </div>
      )}
    </div>
  )
}
