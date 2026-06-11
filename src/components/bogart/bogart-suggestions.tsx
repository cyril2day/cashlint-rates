'use client'

export function BogartSuggestions({
  disabled,
  onSelect,
  suggestions,
}: {
  readonly disabled: boolean
  readonly onSelect: (suggestion: string) => void
  readonly suggestions: ReadonlyArray<string>
}) {
  return (
    <div className="bogart-suggestions" aria-label="Bogart prompt suggestions">
      {suggestions.map((suggestion) => (
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
