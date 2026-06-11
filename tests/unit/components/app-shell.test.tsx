import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AppShell } from '@/app/app-shell'
import { useBogartResultAvailability } from '@/components/bogart'
import { pairAnalysisBogartContext } from '../../helpers/bogart-context'

const resultContext = pairAnalysisBogartContext()

function ResultContent() {
  useBogartResultAvailability(resultContext)

  return <p>Result content</p>
}

afterEach(() => {
  vi.restoreAllMocks()
  window.localStorage.clear()
  document.body.style.overflow = ''
  document.querySelector('.app-shell')?.removeAttribute('aria-hidden')
  document.querySelector('.app-shell')?.removeAttribute('inert')
})

describe('AppShell', () => {
  it('keeps the global Bogart button hidden until a result is present', () => {
    render(
      <AppShell>
        <p>Page content</p>
      </AppShell>,
    )

    expect(screen.getByText('Page content')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Ask Bogart' })).not.toBeInTheDocument()
  })

  it('renders the global Bogart button outside page content when a result is present', async () => {
    render(
      <AppShell>
        <ResultContent />
      </AppShell>,
    )

    expect(await screen.findByText('Result content')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Ask Bogart' })).toHaveClass('bogart-button')
    expect(screen.getByText('Ask Bogart')).toHaveClass('bogart-button__tooltip')
  })

  it('opens Bogart as a modal layer and locks the background page', async () => {
    const { container } = render(
      <AppShell>
        <ResultContent />
      </AppShell>,
    )

    fireEvent.click(await screen.findByRole('button', { name: 'Ask Bogart' }))

    expect(await screen.findByRole('dialog', { name: 'Bogart' })).toHaveClass('bogart-modal__panel')
    expect(screen.getByText('Context: Analyse · USD/GBP · 2026-06-02 to 2026-06-09')).toHaveClass('bogart-modal__context')
    expect(screen.getByPlaceholderText('Ask about this chart, formula, or result...')).toBeInTheDocument()
    expect(document.body.style.overflow).toBe('hidden')
    expect(container.querySelector('.app-shell')).toHaveAttribute('inert')
    expect(container.querySelector('.app-shell')).toHaveAttribute('aria-hidden', 'true')
  })

  it('closes Bogart with Escape and returns focus to the button', async () => {
    const { container } = render(
      <AppShell>
        <ResultContent />
      </AppShell>,
    )
    const button = await screen.findByRole('button', { name: 'Ask Bogart' })

    fireEvent.click(button)

    const closeButton = await screen.findByRole('button', { name: 'Close' })

    await waitFor(() => {
      expect(closeButton).toHaveFocus()
    })

    fireEvent.keyDown(document, { key: 'Escape' })

    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'Bogart' })).not.toBeInTheDocument()
    })
    expect(container.querySelector('.app-shell')).not.toHaveAttribute('inert')
    expect(document.body.style.overflow).toBe('')
    await waitFor(() => {
      expect(button).toHaveFocus()
    })
  })

  it('closes Bogart from the backdrop', async () => {
    render(
      <AppShell>
        <ResultContent />
      </AppShell>,
    )

    fireEvent.click(await screen.findByRole('button', { name: 'Ask Bogart' }))

    expect(await screen.findByRole('dialog', { name: 'Bogart' })).toBeInTheDocument()
    fireEvent.click(document.querySelector('.bogart-modal')!)

    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'Bogart' })).not.toBeInTheDocument()
    })
  })

  it('cycles focus inside the Bogart modal', async () => {
    render(
      <AppShell>
        <ResultContent />
      </AppShell>,
    )

    fireEvent.click(await screen.findByRole('button', { name: 'Ask Bogart' }))

    const closeButton = await screen.findByRole('button', { name: 'Close' })
    const input = screen.getByLabelText('Question')
    const finalSuggestion = screen.getByRole('button', { name: 'Why is this metric unavailable?' })

    await waitFor(() => {
      expect(closeButton).toHaveFocus()
    })

    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true })
    expect(finalSuggestion).toHaveFocus()

    fireEvent.keyDown(document, { key: 'Tab' })
    expect(closeButton).toHaveFocus()
    input.focus()
    expect(input).toHaveFocus()
  })

  it('sends a question from the Bogart modal chat', async () => {
    vi.stubGlobal('fetch', vi.fn(() =>
      Promise.resolve(
        new Response(JSON.stringify({
          _tag: 'ApiSuccess',
          data: {
            _tag: 'BogartAnswer',
            answer: 'This result compares the latest reference-rate movement.',
            remainingQuestions: 9,
          },
        }), {
          status: 200,
        }),
      ),
    ))

    render(
      <AppShell>
        <ResultContent />
      </AppShell>,
    )

    fireEvent.click(await screen.findByRole('button', { name: 'Ask Bogart' }))
    fireEvent.change(screen.getByLabelText('Question'), {
      target: { value: 'Explain this chart' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Send' }))

    await waitFor(() => {
      expect(screen.getAllByText('Explain this chart')).toHaveLength(2)
    })
    expect(await screen.findByText('This result compares the latest reference-rate movement.')).toBeInTheDocument()
    expect(screen.getByText('9 Bogart questions left today.')).toBeInTheDocument()
    expect(vi.mocked(fetch)).toHaveBeenCalledWith('/api/bogart', expect.objectContaining({
      method: 'POST',
    }))
  })

  it('renders the daily limit state in the Bogart modal chat', async () => {
    vi.stubGlobal('fetch', vi.fn(() =>
      Promise.resolve(
        new Response(JSON.stringify({
          _tag: 'ApiSuccess',
          data: {
            _tag: 'BogartDailyLimitReached',
            limit: 10,
            resetAt: '2026-06-12T00:00:00.000Z',
          },
        }), {
          status: 200,
        }),
      ),
    ))

    render(
      <AppShell>
        <ResultContent />
      </AppShell>,
    )

    fireEvent.click(await screen.findByRole('button', { name: 'Ask Bogart' }))
    fireEvent.change(screen.getByLabelText('Question'), {
      target: { value: 'Explain this result' },
    })
    fireEvent.keyDown(screen.getByLabelText('Question'), { key: 'Enter' })

    expect(await screen.findByText('Daily question limit reached. Try again after 2026-06-12T00:00:00.000Z.')).toBeInTheDocument()
    expect(screen.getByText('10 of 10 questions used today.')).toBeInTheDocument()
    expect(screen.getByLabelText('Question')).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Send' })).toBeDisabled()
  })
})
