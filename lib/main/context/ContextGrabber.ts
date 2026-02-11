import { ItoMode } from '@/app/generated/ito_pb'
import { DictionaryTable } from '../sqlite/repo'
import { AppTargetTable, ToneTable, type Tone, type AppTarget } from '../sqlite/appTargetRepo'
import { getCurrentUserId, getAdvancedSettings } from '../store'
import { getActiveWindow } from '../../media/active-application'
import {
  getSelectedTextString,
  getCursorContext,
} from '../../media/selected-text-reader'
import { getBrowserUrl } from '../../media/browser-url'
import { canGetContextFromCurrentApp } from '../../utils/applicationDetection'
import { normalizeAppTargetId, DEFAULT_TONE_ID } from '../../utils/appTargetUtils'
import log from 'electron-log'

const DEFAULT_LOCAL_USER_ID = 'local-user'
import { timingCollector, TimingEventName } from '../timing/TimingCollector'
import { macOSAccessibilityContextProvider } from '../../media/macOSAccessibilityContextProvider'

export interface ContextData {
  vocabularyWords: string[]
  windowTitle: string
  appName: string
  contextText: string
  browserUrl: string | null
  browserDomain: string | null
  advancedSettings: ReturnType<typeof getAdvancedSettings>
  tone: Tone | null
}

/**
 * ContextGrabber centralizes all context gathering logic for transcription streams.
 * It collects vocabulary, window info, selected text, and settings.
 */
export class ContextGrabber {
  /**
   * Gather all context data needed for a transcription stream
   */
  public async gatherContext(mode: ItoMode): Promise<ContextData> {
    console.log('[ContextGrabber] Gathering context for mode:', mode)

    // Get vocabulary words from dictionary
    const vocabularyWords = await this.getVocabulary()

    // Get active window context
    const windowContext = await timingCollector.timeAsync(
      TimingEventName.WINDOW_CONTEXT_GATHER,
      async () => await this.getWindowContext(),
    )

    // Get browser URL if in a browser
    const { url: browserUrl, domain: browserDomain } =
      await timingCollector.timeAsync(
        TimingEventName.BROWSER_URL_GATHER,
        async () => await getBrowserUrl(windowContext),
      )

    // Get selected text if in EDIT mode
    const contextText = await this.getContextText(mode)

    // Get advanced settings
    const advancedSettings = getAdvancedSettings()

    // Get tone for current app (check domain first, then app)
    const tone = await this.getToneForCurrentApp(windowContext?.appName, browserDomain)

    console.log('[ContextGrabber] App name:', windowContext?.appName)
    console.log('[ContextGrabber] Tone found:', tone?.name, '| Template:', tone?.promptTemplate?.substring(0, 50))
    console.log('[ContextGrabber] Context gathered successfully')

    return {
      vocabularyWords,
      windowTitle: windowContext?.title || '',
      appName: windowContext?.appName || '',
      contextText,
      browserUrl,
      browserDomain,
      advancedSettings,
      tone,
    }
  }

  private async getVocabulary(): Promise<string[]> {
    try {
      const userId = getCurrentUserId() || DEFAULT_LOCAL_USER_ID
      const dictionaryItems = await DictionaryTable.findAll(userId)
      return dictionaryItems
        .filter(item => item.deleted_at === null)
        .map(item => item.word)
    } catch (error) {
      log.error('[ContextGrabber] Error getting vocabulary:', error)
      return []
    }
  }

  private async getWindowContext(): Promise<{
    title: string
    appName: string
  } | null> {
    try {
      const windowContext = await getActiveWindow()
      if (!windowContext) return null
      return {
        title: windowContext.title || '',
        appName: windowContext.appName || '',
      }
    } catch (error) {
      log.error('[ContextGrabber] Error getting window context:', error)
      return null
    }
  }

  private async getToneForCurrentApp(appName?: string, browserDomain?: string | null): Promise<Tone | null> {
    try {
      const userId = getCurrentUserId() || DEFAULT_LOCAL_USER_ID
      if (!appName) return null

      console.log('[ContextGrabber] Looking for tone - userId:', userId, '| appName:', appName, '| browserDomain:', browserDomain)

      let appTarget: AppTarget | null = null

      if (browserDomain) {
        appTarget = await AppTargetTable.findByDomain(browserDomain, userId)
        console.log('[ContextGrabber] Domain match result:', appTarget?.name)
      }

      if (!appTarget) {
        const appId = normalizeAppTargetId(appName)
        appTarget = await AppTargetTable.findById(appId, userId)
        console.log('[ContextGrabber] App match result:', appTarget?.name)
      }

      console.log('[ContextGrabber] Final AppTarget found:', appTarget?.name, '| toneId:', appTarget?.toneId)

      const toneId = appTarget?.toneId || DEFAULT_TONE_ID
      const tone = await ToneTable.findById(toneId)
      console.log('[ContextGrabber] Tone loaded:', tone?.name)
      
      return tone
    } catch (error) {
      log.error('[ContextGrabber] Error getting tone:', error)
      return null
    }
  }

  private async getContextText(mode: ItoMode): Promise<string> {
    if (mode !== ItoMode.EDIT) {
      return ''
    }

    const { macosAccessibilityContextEnabled } = getAdvancedSettings()

    // Try accessibility API first if enabled
    if (
      process.platform === 'darwin' &&
      macosAccessibilityContextEnabled &&
      macOSAccessibilityContextProvider.isRunning()
    ) {
      try {
        const result = await timingCollector.timeAsync(
          TimingEventName.CURSOR_CONTEXT_GATHER,
          async () =>
            await macOSAccessibilityContextProvider.getCursorContext({
              maxCharsBefore: 1000,
              maxCharsAfter: 1000,
              timeout: 500,
              debug: false,
            }),
        )

        if (result.success && result.context?.selectedText) {
          console.log(
            '[ContextGrabber] Got selected text via accessibility API',
          )
          return result.context.selectedText.trim()
        }
      } catch (error) {
        console.log(
          '[ContextGrabber] Accessibility API failed, falling back to keyboard:',
          error,
        )
      }
    }

    // Fallback to keyboard-based method
    console.log('[ContextGrabber] Using keyboard method for selected text')
    try {
      const text = await timingCollector.timeAsync(
        TimingEventName.SELCTED_TEXT_GATHER,
        async () => await getSelectedTextString(),
      )
      console.log('[ContextGrabber] Selected text from keyboard:', text)
      return text && text.trim().length > 0 ? text : ''
    } catch (error) {
      log.error('[ContextGrabber] Error getting context text:', error)
      return ''
    }
  }

  /**
   * Get cursor context for grammar rules (capitalization, spacing, etc.)
   * This fetches a small amount of text before the cursor position.
   *
   * @param contextLength - Number of characters to fetch before cursor (default: 4)
   * @returns The text before the cursor, or empty string if unavailable
   */
  public async getCursorContextForGrammar(
    contextLength: number = 4,
  ): Promise<string> {
    const { macosAccessibilityContextEnabled } = getAdvancedSettings()

    // Try accessibility API first if enabled
    if (
      process.platform === 'darwin' &&
      macosAccessibilityContextEnabled &&
      macOSAccessibilityContextProvider.isRunning()
    ) {
      try {
        const result = await macOSAccessibilityContextProvider.getCursorContext(
          {
            maxCharsBefore: contextLength,
            maxCharsAfter: 0,
            timeout: 500,
            debug: false,
          },
        )

        if (result.success && result.context?.textBefore) {
          console.log(
            '[ContextGrabber] Got cursor context via accessibility API',
          )
          return result.context.textBefore
        }
      } catch (error) {
        console.log(
          '[ContextGrabber] Accessibility API failed, falling back to keyboard:',
          error,
        )
      }
    }

    // Fallback to keyboard-based method
    console.log('[ContextGrabber] Using keyboard method for cursor context')
    try {
      const canGetContext = await canGetContextFromCurrentApp()

      if (!canGetContext) {
        console.log(
          '[ContextGrabber] Cannot get cursor context from current app',
        )
        return ''
      }

      const cursorContext = await getCursorContext(contextLength)
      return cursorContext || ''
    } catch (error) {
      log.error(
        '[ContextGrabber] Error getting cursor context for grammar:',
        error,
      )
      return ''
    }
  }
}

export const contextGrabber = new ContextGrabber()
