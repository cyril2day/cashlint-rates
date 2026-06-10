import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AIExplanationProvider } from '@/server/ports/ai-explanation-provider'
import type { BogartResultContextDto } from '@/shared/dto/bogart'
import { failure, success } from '@/shared/fp'
import { pairAnalysisBogartContext } from '../../helpers/bogart-context'

type MockResponse = { readonly text: string | undefined }

const mockGenerateContent = vi.fn<
  (params: {
    model: string
    contents: unknown
    config?: Record<string, unknown>
  }) => Promise<MockResponse>
>()

vi.mock('@google/genai', () => ({
  GoogleGenAI: vi.fn().mockImplementation(() => ({
    models: {
      generateContent: mockGenerateContent,
    },
  })),
}))

import { createGoogleAIBogartProvider } from '@/server/adapters/bogart/google-ai-bogart-provider'

const provider: AIExplanationProvider = createGoogleAIBogartProvider({
  apiKey: 'test-api-key',
  model: 'test-model',
  temperature: 0,
  maxOutputTokens: 100,
})

const context: BogartResultContextDto = pairAnalysisBogartContext()

const withText = (text: string | undefined): MockResponse => ({ text })

const lastCallParam = (): {
  model: string
  contents: unknown
  config?: Record<string, unknown>
} | undefined => {
  const call = mockGenerateContent.mock.calls.at(-1)

  return call?.[0]
}

const lastCallContents = (): string => {
  const param = lastCallParam()
  const contents = param?.contents

  return typeof contents === 'string' ? contents : ''
}

describe('createGoogleAIBogartProvider', () => {
  beforeEach(() => {
    mockGenerateContent.mockReset()
  })

  it('returns an AIExplanationProvider', () => {
    expect(provider).toBeDefined()
    expect(typeof provider.explain).toBe('function')
  })

  it('calls the Google AI API with the correct model and config', async () => {
    mockGenerateContent.mockResolvedValueOnce(withText('Test answer.'))

    await provider.explain({ question: 'What is the latest rate?', context })

    expect(mockGenerateContent).toHaveBeenCalledTimes(1)
    const call = lastCallParam()
    expect(call?.model).toBe('test-model')
    expect(call?.config?.temperature).toBe(0)
    expect(call?.config?.maxOutputTokens).toBe(100)
  })

  it('passes the system instruction to the model', async () => {
    mockGenerateContent.mockResolvedValueOnce(withText('OK.'))

    await provider.explain({ question: 'What is the latest rate?', context })

    const instruction: unknown = lastCallParam()?.config?.systemInstruction
    const text = typeof instruction === 'string' ? instruction : ''

    expect(text.includes('Bogart')).toBe(true)
    expect(text.includes('Cashlint Rates')).toBe(true)
  })

  it('returns the model response text on success', async () => {
    mockGenerateContent.mockResolvedValueOnce(
      withText('The latest reference rate is 0.7900 GBP.'),
    )

    const result = await provider.explain({
      question: 'What is the latest rate?',
      context,
    })

    expect(result).toEqual(success('The latest reference rate is 0.7900 GBP.'))
  })

  it('includes mode, currencies, and key results in the prompt contents', async () => {
    mockGenerateContent.mockResolvedValueOnce(withText('OK.'))

    await provider.explain({ question: 'Explain this result', context })

    const contents = lastCallContents()

    expect(contents.includes('pair analysis')).toBe(true)
    expect(contents.includes('USD')).toBe(true)
    expect(contents.includes('GBP')).toBe(true)
    expect(contents.includes('Latest reference rate')).toBe(true)
    expect(contents.includes('0.7900 GBP')).toBe(true)
  })

  it('returns provider-unavailable error when the API throws', async () => {
    mockGenerateContent.mockRejectedValueOnce(new Error('Network failure'))

    const result = await provider.explain({
      question: 'What is the latest rate?',
      context,
    })

    expect(result).toEqual(
      failure({
        tag: 'ai-provider-unavailable',
        message: 'Google AI request failed.',
      }),
    )
  })

  it('returns provider-unavailable error when response text is empty', async () => {
    mockGenerateContent.mockResolvedValueOnce(withText(''))

    const result = await provider.explain({
      question: 'What is the latest rate?',
      context,
    })

    expect(result).toEqual(
      failure({
        tag: 'ai-provider-unavailable',
        message: 'Google AI request failed.',
      }),
    )
  })

  it('returns provider-unavailable error when response text is undefined', async () => {
    mockGenerateContent.mockResolvedValueOnce(withText(undefined))

    const result = await provider.explain({
      question: 'What is the latest rate?',
      context,
    })

    expect(result).toEqual(
      failure({
        tag: 'ai-provider-unavailable',
        message: 'Google AI request failed.',
      }),
    )
  })

  it('includes the user question in the prompt', async () => {
    mockGenerateContent.mockResolvedValueOnce(withText('OK.'))

    await provider.explain({ question: 'Why did GBP move this week?', context })

    expect(lastCallContents().includes('Why did GBP move this week?')).toBe(true)
  })

  it('includes date range when available', async () => {
    mockGenerateContent.mockResolvedValueOnce(withText('OK.'))

    await provider.explain({ question: 'Explain the trend', context })

    const contents = lastCallContents()

    expect(contents.includes('2026-06-02')).toBe(true)
    expect(contents.includes('2026-06-09')).toBe(true)
  })

  it('includes chart summary when available', async () => {
    mockGenerateContent.mockResolvedValueOnce(withText('OK.'))

    await provider.explain({ question: 'Describe the chart', context })

    expect(lastCallContents().includes('7 usable historical observations')).toBe(true)
  })
})
