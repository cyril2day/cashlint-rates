'use client'

export function AnalysisCurrencyFields({
  base,
  currencyCodes,
  onBaseChange,
  onQuoteChange,
  quote,
}: {
  readonly base: string
  readonly currencyCodes: ReadonlyArray<string>
  readonly onBaseChange: (value: string) => void
  readonly onQuoteChange: (value: string) => void
  readonly quote: string
}) {
  return (
    <div className="converter-card__grid">
      <label className="field" htmlFor="analyse-base">
        <span className="field__label">Base</span>
        <select
          className="field__control"
          id="analyse-base"
          name="base"
          onChange={(event) => {
            onBaseChange(event.currentTarget.value)
          }}
          value={base}
        >
          {currencyCodes.map((code) => (
            <option key={code}>{code}</option>
          ))}
        </select>
      </label>
      <label className="field" htmlFor="analyse-quote">
        <span className="field__label">Quote</span>
        <select
          className="field__control"
          id="analyse-quote"
          name="quote"
          onChange={(event) => {
            onQuoteChange(event.currentTarget.value)
          }}
          value={quote}
        >
          {currencyCodes.map((code) => (
            <option key={code}>{code}</option>
          ))}
        </select>
      </label>
    </div>
  )
}
