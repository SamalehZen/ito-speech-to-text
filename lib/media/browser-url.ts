import { exec } from 'child_process'
import { promisify } from 'util'
import { getActiveWindow } from './active-application'

const execAsync = promisify(exec)

export type BrowserUrlInfo = {
  url: string | null
  domain: string | null
  browser: string | null
}

const SUPPORTED_BROWSERS: Record<string, string[]> = {
  darwin: [
    'Google Chrome',
    'Safari',
    'Firefox',
    'Arc',
    'Microsoft Edge',
    'Brave Browser',
  ],
  win32: ['Google Chrome', 'Firefox', 'Microsoft Edge', 'Brave'],
}

const MAC_BROWSER_SCRIPTS: Record<string, string> = {
  'Google Chrome': `
tell application "Google Chrome"
  if (count of windows) > 0 then
    return URL of active tab of front window
  end if
end tell
`,
  Safari: `
tell application "Safari"
  if (count of windows) > 0 then
    return URL of current tab of front window
  end if
end tell
`,
  Firefox: `
tell application "System Events"
  tell process "Firefox"
    set frontmost to true
    set urlBar to text field 1 of toolbar 1 of window 1
    return value of attribute "AXValue" of urlBar
  end tell
end tell
`,
  Arc: `
tell application "Arc"
  if (count of windows) > 0 then
    return URL of active tab of front window
  end if
end tell
`,
  'Microsoft Edge': `
tell application "Microsoft Edge"
  if (count of windows) > 0 then
    return URL of active tab of front window
  end if
end tell
`,
  'Brave Browser': `
tell application "Brave Browser"
  if (count of windows) > 0 then
    return URL of active tab of front window
  end if
end tell
`,
}

const WINDOWS_URL_SCRIPT = `
Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes

function Get-BrowserUrl {
    param([string]$ProcessName)
    
    $process = Get-Process -Name $ProcessName -ErrorAction SilentlyContinue | 
               Where-Object { $_.MainWindowHandle -ne 0 } | 
               Select-Object -First 1
    
    if (-not $process) { return $null }
    
    try {
        $element = [System.Windows.Automation.AutomationElement]::FromHandle($process.MainWindowHandle)
        
        $condition = New-Object System.Windows.Automation.PropertyCondition(
            [System.Windows.Automation.AutomationElement]::ControlTypeProperty,
            [System.Windows.Automation.ControlType]::Edit
        )
        
        $addressBar = $element.FindFirst(
            [System.Windows.Automation.TreeScope]::Descendants,
            $condition
        )
        
        if ($addressBar) {
            $pattern = $addressBar.GetCurrentPattern([System.Windows.Automation.ValuePattern]::Pattern)
            return $pattern.Current.Value
        }
    } catch {
        return $null
    }
    
    return $null
}
`

const WINDOWS_BROWSER_PROCESS_NAMES: Record<string, string> = {
  'Google Chrome': 'chrome',
  Firefox: 'firefox',
  'Microsoft Edge': 'msedge',
  Brave: 'brave',
}

function extractDomain(url: string): string | null {
  try {
    const parsed = new URL(url)
    return parsed.hostname
  } catch {
    return null
  }
}

function normalizeUrl(url: string): string {
  if (!url) return url
  const trimmed = url.trim()
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed
  }
  return `https://${trimmed}`
}

function findMatchingBrowser(appName: string, platform: string): string | null {
  const browsers = SUPPORTED_BROWSERS[platform] || []
  const lowerAppName = appName.toLowerCase()

  for (const browser of browsers) {
    if (lowerAppName.includes(browser.toLowerCase())) {
      return browser
    }
  }
  return null
}

async function extractUrlMacOS(browserName: string): Promise<string | null> {
  const script = MAC_BROWSER_SCRIPTS[browserName]
  if (!script) {
    console.log(
      `[BrowserUrl] No AppleScript defined for browser: ${browserName}`,
    )
    return null
  }

  try {
    const { stdout } = await execAsync(
      `osascript -e '${script.replace(/'/g, "'\\''")}'`,
      {
        timeout: 200,
      },
    )
    return stdout.trim() || null
  } catch (error) {
    console.log(`[BrowserUrl] Failed to get URL from ${browserName}:`, error)
    return null
  }
}

async function extractUrlWindows(browserName: string): Promise<string | null> {
  const processName = WINDOWS_BROWSER_PROCESS_NAMES[browserName]
  if (!processName) {
    console.log(
      `[BrowserUrl] No process name defined for browser: ${browserName}`,
    )
    return null
  }

  const fullScript = `${WINDOWS_URL_SCRIPT}\nGet-BrowserUrl -ProcessName "${processName}"`

  try {
    const { stdout } = await execAsync(
      `powershell -NoProfile -NonInteractive -Command "${fullScript.replace(/"/g, '\\"')}"`,
      { timeout: 200 },
    )
    return stdout.trim() || null
  } catch (error) {
    console.log(`[BrowserUrl] Failed to get URL from ${browserName}:`, error)
    return null
  }
}

export async function getBrowserUrl(): Promise<BrowserUrlInfo> {
  const nullResult: BrowserUrlInfo = { url: null, domain: null, browser: null }

  try {
    const activeWindow = await getActiveWindow()
    if (!activeWindow) {
      return nullResult
    }

    const appName = activeWindow.appName
    const platform = process.platform

    if (platform !== 'darwin' && platform !== 'win32') {
      console.log(`[BrowserUrl] Platform ${platform} not supported`)
      return nullResult
    }

    const matchedBrowser = findMatchingBrowser(appName, platform)
    if (!matchedBrowser) {
      return nullResult
    }

    console.log(`[BrowserUrl] Detected browser: ${matchedBrowser}`)

    let rawUrl: string | null = null
    if (platform === 'darwin') {
      rawUrl = await extractUrlMacOS(matchedBrowser)
    } else if (platform === 'win32') {
      rawUrl = await extractUrlWindows(matchedBrowser)
    }

    if (!rawUrl) {
      return { url: null, domain: null, browser: matchedBrowser }
    }

    const url = normalizeUrl(rawUrl)
    const domain = extractDomain(url)

    console.log(`[BrowserUrl] Extracted URL: ${url}, domain: ${domain}`)

    return { url, domain, browser: matchedBrowser }
  } catch (error) {
    console.error('[BrowserUrl] Error extracting browser URL:', error)
    return nullResult
  }
}
