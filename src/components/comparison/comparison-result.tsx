'use client'

import type { ReactNode } from 'react'
import { useId } from 'react'
import type {
  ComparisonMetricValueDto,
  ComparisonQuoteInclusionDto,
  ComparisonQuoteRowDto,
  ComparisonViewModelDto,
  IndexedComparisonChartViewModelDto,
  RankedQuoteDto,
} from '@/shared/dto/comparison'
import { IndexedComparisonChart } from '@/components/charts'
import { BogartPanel } from '@/components/bogart'
import { fromNullable, matchBoolean, matchDtoTag, matchMaybe } from '@/shared/fp'

const maybeMetricText = (metric: ComparisonMetricValueDto): string =>
  matchDtoTag<ComparisonMetricValueDto['displayValue'], string>({
    Just: (value) => value.value,
    Nothing: () =>
      matchDtoTag<ComparisonMetricValueDto['availability'], string>({
        Available: () => 'Available',
        NotApplicable: (availability) => availability.reason,
        Unavailable: (availability) => availability.reason,
      })(metric.availability),
  })(metric.displayValue)

const inclusionText = (inclusion: ComparisonQuoteInclusionDto): string =>
  matchDtoTag<ComparisonQuoteInclusionDto, string>({
    ExcludedFromRankings: (excluded) => excluded.reason.replaceAll('-', ' '),
    IncludedInRankings: () => 'Included in rankings',
  })(inclusion)

const rankedQuoteText = (label: string, rankedQuote: RankedQuoteDto): ReactNode => (
  <article className="comparison-highlight">
    <span>{label}</span>
    <strong>{rankedQuote.quote.code}</strong>
    <p>{maybeMetricText(rankedQuote.metric)}</p>
  </article>
)

function ComparisonHighlights({ result }: { readonly result: ComparisonViewModelDto }) {
  const stable = matchDtoTag<typeof result.rankings.mostStableQuote, ReactNode>({
    Just: (ranked) => rankedQuoteText('Most stable', ranked.value),
    Nothing: () => null,
  })(result.rankings.mostStableQuote)
  const variable = matchDtoTag<typeof result.rankings.mostVariableQuote, ReactNode>({
    Just: (ranked) => rankedQuoteText('Most variable', ranked.value),
    Nothing: () => null,
  })(result.rankings.mostVariableQuote)
  const hasRankableData = result.rankings.periodMovementAscending.length > 0

  return (
    <section className="comparison-highlights" aria-label="Comparison highlights">
      {stable}
      {variable}
      {matchBoolean<ReactNode>({
        false: () => (
          <article className="comparison-highlight comparison-highlight--wide">
            <span>No rankable data</span>
            <strong>No quote met the ranking rules.</strong>
            <p>Partial, same-currency, unavailable, and insufficient rows remain visible below.</p>
          </article>
        ),
        true: () => null,
      })(hasRankableData)}
    </section>
  )
}

function ComparisonChartPanel({ chart }: { readonly chart: IndexedComparisonChartViewModelDto }) {
  const summaryId = useId()
  const titleId = useId()
  const statusText = matchBoolean<string>({
    false: () => 'Chart unavailable',
    true: () => 'Chart ready',
  })(chart.points.length > 0)

  return (
    <div className="chart-panel cr-chart-panel" aria-describedby={summaryId} aria-labelledby={titleId} role="region">
      <h3 id={titleId}>{chart.title}</h3>
      <span className="chart-panel__status cr-chart-panel__status">{statusText}</span>
      <p className="chart-panel__summary cr-chart-panel__summary" id={summaryId}>{chart.summary}</p>
      {matchBoolean<ReactNode>({
        false: () => <p className="analysis-result__empty">No indexed observations to chart.</p>,
        true: () => <IndexedComparisonChart ariaDescribedBy={summaryId} ariaLabel={chart.summary} chart={chart} height={240} width={720} />,
      })(chart.points.length > 0)}
    </div>
  )
}

function ComparisonRowsTable({ result }: { readonly result: ComparisonViewModelDto }) {
  return (
    <table className="data-table cr-data-table">
      <caption>{result.chart.tableCaption}</caption>
      <thead>
        <tr>
          <th scope="col">Quote</th>
          <th scope="col">Latest rate</th>
          <th scope="col">Period movement</th>
          <th scope="col">Relative variability</th>
          <th scope="col">Ranking state</th>
          <th scope="col">Data quality</th>
        </tr>
      </thead>
      <tbody>
        {result.rows.map((row) => (
          <tr key={row.quote.code}>
            <td>{row.quote.code}</td>
            <td>{maybeMetricText(row.latestReferenceRate)}</td>
            <td>{maybeMetricText(row.periodMovement)}</td>
            <td>{maybeMetricText(row.relativeVariability)}</td>
            <td>{inclusionText(row.inclusion)}</td>
            <td>{row.dataQuality.status.replaceAll('-', ' ')}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function ComparisonQualityPanel({ rows }: { readonly rows: ReadonlyArray<ComparisonQuoteRowDto> }) {
  return (
    <section className="analysis-result__quality">
      <h3>Per-quote data quality</h3>
      <dl>
        {rows.map((row) => (
          <div key={row.quote.code}>
            <dt>{row.quote.code}</dt>
            <dd>{row.dataQuality.messages.join(' ')}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}

export function ComparisonResult({ result }: { readonly result: ComparisonViewModelDto }) {
  const effectiveNote = matchDtoTag<typeof result.dateRange.effective.note, string>({
    Just: (note) => note.value,
    Nothing: () => 'Selected dates used without alignment.',
  })(result.dateRange.effective.note)
  const sourceLabel = matchMaybe<string, string>({
    none: () => result.attribution.label,
    some: (firstCaveat) => firstCaveat,
  })(fromNullable(result.caveats[0]))

  return (
    <section className="analysis-result comparison-result" aria-live="polite">
      <div className="analysis-result__header">
        <p className="section__eyebrow">{result.base.code} comparison</p>
        <h2>{result.quotes.map((quote) => quote.code).join(', ')}</h2>
        <p>{result.insight}</p>
        <p className="converter-card__note">
          Effective range: {result.dateRange.effective.startDate} to {result.dateRange.effective.endDate}. {effectiveNote}
        </p>
      </div>
      <ComparisonHighlights result={result} />
      <ComparisonChartPanel chart={result.chart} />
      <ComparisonRowsTable result={result} />
      <ComparisonQualityPanel rows={result.rows} />
      <BogartPanel context={result.aiContextSeed} />
      <p className="converter-card__note">{sourceLabel}</p>
    </section>
  )
}
