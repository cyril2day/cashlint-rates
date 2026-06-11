'use client'

const promptSuggestions = [
  'Explain this result',
  'What affects this rate?',
  'How was this calculated?',
  'Summarise these statistics',
] as const

export function BogartSuggestions({
  disabled,
  onSelect,
}: {
  readonly disabled: boolean
  readonly onSelect: (suggestion: string) => void
}) {
  return (
    <div className="bogart-suggestions" aria-label="Bogart prompt suggestions">
      {promptSuggestions.map((suggestion) => (
        <button
          className="button button--secondary"
          disabled={disabled}
          key={suggestion}
          onClick={() => {
            onSelect(suggestion)
          }}
          type="button"
        >
          {suggestion}
        </button>
      ))}
    </div>
  )
}
