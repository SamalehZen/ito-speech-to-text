import { setFocusedText } from '../../media/text-writer'
import { timingCollector, TimingEventName } from '../timing/TimingCollector'

const MAX_RETRY_ATTEMPTS = 3
const RETRY_DELAY_MS = 100

export class TextInserter {
  async insertText(transcript: string): Promise<boolean> {
    if (!transcript || !transcript.trim()) {
      return false
    }

    let lastError: Error | null = null

    for (let attempt = 1; attempt <= MAX_RETRY_ATTEMPTS; attempt++) {
      try {
        const success = await timingCollector.timeAsync(
          TimingEventName.TEXT_WRITER,
          async () => await setFocusedText(transcript),
        )

        if (success) {
          if (attempt > 1) {
            console.log(`Text insertion succeeded on attempt ${attempt}`)
          }
          return true
        }

        console.warn(
          `Text insertion returned false on attempt ${attempt}/${MAX_RETRY_ATTEMPTS}`,
        )
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error))
        console.warn(
          `Text insertion failed on attempt ${attempt}/${MAX_RETRY_ATTEMPTS}:`,
          lastError.message,
        )
      }

      if (attempt < MAX_RETRY_ATTEMPTS) {
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS))
      }
    }

    console.error(
      'Text insertion failed after all retry attempts:',
      lastError?.message || 'unknown error',
    )
    return false
  }
}
