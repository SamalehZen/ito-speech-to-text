import { describe, test, expect, beforeEach, mock } from 'bun:test'

const mockSetFocusedText = mock(() => Promise.resolve(true))
mock.module('../../media/text-writer', () => ({
  setFocusedText: mockSetFocusedText,
}))

import { TextInserter } from './TextInserter'

describe('TextInserter', () => {
  let textInserter: TextInserter

  beforeEach(() => {
    textInserter = new TextInserter()
    mockSetFocusedText.mockClear()
    mockSetFocusedText.mockResolvedValue(true)
  })

  describe('Text Insertion', () => {
    test('should insert text successfully', async () => {
      const transcript = 'Hello world'
      const result = await textInserter.insertText(transcript)

      expect(result).toBe(true)
      expect(mockSetFocusedText).toHaveBeenCalledWith(transcript)
      expect(mockSetFocusedText).toHaveBeenCalledTimes(1)
    })

    test('should return false for empty transcript', async () => {
      const result = await textInserter.insertText('')

      expect(result).toBe(false)
      expect(mockSetFocusedText).not.toHaveBeenCalled()
    })

    test('should return false for transcript of whitespace', async () => {
      let result = await textInserter.insertText(' ')
      expect(result).toBe(false)
      expect(mockSetFocusedText).not.toHaveBeenCalled()

      result = await textInserter.insertText('\n')
      expect(result).toBe(false)
      expect(mockSetFocusedText).not.toHaveBeenCalled()
    })

    test('should return false for null transcript', async () => {
      const result = await textInserter.insertText(null as any)

      expect(result).toBe(false)
      expect(mockSetFocusedText).not.toHaveBeenCalled()
    })

    test('should return false for undefined transcript', async () => {
      const result = await textInserter.insertText(undefined as any)

      expect(result).toBe(false)
      expect(mockSetFocusedText).not.toHaveBeenCalled()
    })

    test('should handle different transcript types', async () => {
      const transcripts = [
        'Short text',
        'This is a longer transcript with multiple words and punctuation.',
        'Special characters: !@#$%^&*()',
        'Numbers: 123 456 789',
        'Mixed: Hello 123 World!',
      ]

      for (const transcript of transcripts) {
        mockSetFocusedText.mockClear()
        const result = await textInserter.insertText(transcript)
        expect(result).toBe(true)
        expect(mockSetFocusedText).toHaveBeenCalledWith(transcript)
        expect(mockSetFocusedText).toHaveBeenCalledTimes(1)
      }
    })
  })

  describe('Retry Mechanism', () => {
    test('should retry on first failure and succeed on second attempt', async () => {
      mockSetFocusedText
        .mockResolvedValueOnce(false)
        .mockResolvedValueOnce(true)

      const result = await textInserter.insertText('test')

      expect(result).toBe(true)
      expect(mockSetFocusedText).toHaveBeenCalledTimes(2)
    })

    test('should retry on error and succeed on next attempt', async () => {
      mockSetFocusedText
        .mockRejectedValueOnce(new Error('First attempt failed'))
        .mockResolvedValueOnce(true)

      const result = await textInserter.insertText('test')

      expect(result).toBe(true)
      expect(mockSetFocusedText).toHaveBeenCalledTimes(2)
    })

    test('should retry up to 3 times before giving up', async () => {
      mockSetFocusedText.mockResolvedValue(false)

      const result = await textInserter.insertText('test')

      expect(result).toBe(false)
      expect(mockSetFocusedText).toHaveBeenCalledTimes(3)
    })

    test('should succeed on third attempt', async () => {
      mockSetFocusedText
        .mockResolvedValueOnce(false)
        .mockRejectedValueOnce(new Error('Second attempt failed'))
        .mockResolvedValueOnce(true)

      const result = await textInserter.insertText('test')

      expect(result).toBe(true)
      expect(mockSetFocusedText).toHaveBeenCalledTimes(3)
    })
  })

  describe('Error Handling', () => {
    test('should handle setFocusedText returning false after all retries', async () => {
      mockSetFocusedText.mockResolvedValue(false)

      const result = await textInserter.insertText('test')

      expect(result).toBe(false)
      expect(mockSetFocusedText).toHaveBeenCalledWith('test')
      expect(mockSetFocusedText).toHaveBeenCalledTimes(3)
    })

    test('should handle setFocusedText throwing error after all retries', async () => {
      const testError = new Error('Text insertion failed')
      mockSetFocusedText.mockRejectedValue(testError)

      const result = await textInserter.insertText('test')

      expect(result).toBe(false)
      expect(mockSetFocusedText).toHaveBeenCalledWith('test')
      expect(mockSetFocusedText).toHaveBeenCalledTimes(3)
    })

    test('should handle setFocusedText throwing non-Error object', async () => {
      mockSetFocusedText.mockRejectedValue('String error')

      const result = await textInserter.insertText('test')

      expect(result).toBe(false)
      expect(mockSetFocusedText).toHaveBeenCalledTimes(3)
    })
  })

  describe('Integration Scenarios', () => {
    test('should handle multiple sequential insertions', async () => {
      const transcripts = ['First', 'Second', 'Third']

      for (const transcript of transcripts) {
        mockSetFocusedText.mockClear()
        const result = await textInserter.insertText(transcript)
        expect(result).toBe(true)
        expect(mockSetFocusedText).toHaveBeenCalledTimes(1)
      }
    })

    test('should handle mixed success and failure scenarios', async () => {
      mockSetFocusedText.mockResolvedValueOnce(true)
      const result1 = await textInserter.insertText('Success')
      expect(result1).toBe(true)

      mockSetFocusedText
        .mockResolvedValueOnce(false)
        .mockResolvedValueOnce(false)
        .mockResolvedValueOnce(false)
      const result2 = await textInserter.insertText('Failure')
      expect(result2).toBe(false)

      mockSetFocusedText
        .mockRejectedValueOnce(new Error('Error case'))
        .mockRejectedValueOnce(new Error('Error case'))
        .mockRejectedValueOnce(new Error('Error case'))
      const result3 = await textInserter.insertText('Error')
      expect(result3).toBe(false)
    })
  })
})
