'use client'

import { anyTrue, matchBoolean } from '@/shared/fp'

const quoteLimit = 10

const addQuote =
  (candidate: string) =>
  (quotes: ReadonlyArray<string>): ReadonlyArray<string> =>
    matchBoolean<ReadonlyArray<string>>({
      false: () =>
        matchBoolean<ReadonlyArray<string>>({
          false: () => [...quotes, candidate],
          true: () => quotes,
        })(quotes.length >= quoteLimit),
      true: () => quotes,
    })(quotes.includes(candidate))

const removeQuote =
  (quote: string) =>
  (quotes: ReadonlyArray<string>): ReadonlyArray<string> =>
    quotes.filter((selected) => selected !== quote)

export function ComparisonQuoteFields({
  base,
  currencyCodes,
  onBaseChange,
  onQuoteCandidateChange,
  onQuotesChange,
  quoteCandidate,
  selectedQuotes,
}: {
  readonly base: string
  readonly currencyCodes: ReadonlyArray<string>
  readonly onBaseChange: (value: string) => void
  readonly onQuoteCandidateChange: (value: string) => void
  readonly onQuotesChange: (value: ReadonlyArray<string>) => void
  readonly quoteCandidate: string
  readonly selectedQuotes: ReadonlyArray<string>
}) {
  const atQuoteLimit = selectedQuotes.length >= quoteLimit
  const selectedCandidate = selectedQuotes.includes(quoteCandidate)
  const addDisabled = anyTrue([atQuoteLimit, selectedCandidate])

  return (
    <>
      <div className="converter-card__grid">
        <label className="field" htmlFor="compare-base">
          <span className="field__label">Base</span>
          <select
            className="field__control"
            id="compare-base"
            name="base"
            onChange={(event) => {
              onBaseChange(event.currentTarget.value)
            }}
            value={base}
          >
            {currencyCodes.map((code) => (
              <option key={code} value={code}>{code}</option>
            ))}
          </select>
        </label>
        <label className="field" htmlFor="compare-quote-candidate">
          <span className="field__label">Quote to add</span>
          <select
            className="field__control"
            id="compare-quote-candidate"
            name="quoteCandidate"
            onChange={(event) => {
              onQuoteCandidateChange(event.currentTarget.value)
            }}
            value={quoteCandidate}
          >
            {currencyCodes.map((code) => (
              <option disabled={selectedQuotes.includes(code)} key={code} value={code}>{code}</option>
            ))}
          </select>
        </label>
      </div>
      <button
        className="button button--secondary"
        disabled={addDisabled}
        onClick={() => {
          onQuotesChange(addQuote(quoteCandidate)(selectedQuotes))
        }}
        type="button"
      >
        Add quote
      </button>
      <div className="quote-chip-list" aria-label="Selected quote currencies">
        {selectedQuotes.map((quote) => (
          <button
            className="quote-chip"
            key={quote}
            onClick={() => {
              onQuotesChange(removeQuote(quote)(selectedQuotes))
            }}
            type="button"
          >
            <span>{quote}</span>
            <span aria-hidden="true">x</span>
          </button>
        ))}
      </div>
      <p className="field__helper">{selectedQuotes.length} of 10 quote currencies selected.</p>
    </>
  )
}
