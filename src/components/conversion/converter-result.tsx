'use client'

import Link from 'next/link'
import type { ConversionViewModelDto } from '@/shared/dto/conversion'
import { matchDtoTag } from '@/shared/fp'
import { useBogartResultAvailability } from '@/components/bogart'
import { formatDateReadable } from '@/shared/date'

type ConverterResultProps = {
  readonly result: ConversionViewModelDto
}

const effectiveDateText = (result: ConversionViewModelDto): string =>
  matchDtoTag<ConversionViewModelDto['result']['effectiveDate'], string>({
    Just: (effectiveDate) => `Effective date: ${formatDateReadable(effectiveDate.value)}`,
    Nothing: () => 'Same-currency conversion has no provider date.',
  })(result.result.effectiveDate)

export function ConverterResult({ result }: ConverterResultProps) {
  useBogartResultAvailability(result.aiContextSeed)

  return (
    <section className="converter-card__result" aria-live="polite">
      <p className="converter-card__equation">
        <strong>
          {result.amount.displayAmount} {result.base.code} ={' '}
          {result.result.convertedAmount.displayValue} {result.quote.code}
        </strong>
      </p>
      <p>{result.insight}</p>
      <dl className="converter-card__meta">
        <div>
          <dt>Source</dt>
          <dd>{result.attribution.sourceName}</dd>
        </div>
        <div>
          <dt>Reference rate</dt>
          <dd>
            1 {result.base.code} = {result.result.rate.displayValue} {result.quote.code}
          </dd>
        </div>
        <div>
          <dt>Date</dt>
          <dd>{effectiveDateText(result)}</dd>
        </div>
      </dl>
      <div className="converter-card__actions">
        <Link className="button button--secondary" href={result.actions.analysePair.href}>
          Analyse this pair
        </Link>
        <Link className="button button--secondary" href={result.actions.compareBase.href}>
          Compare this base
        </Link>
      </div>
      <p className="converter-card__note">
        Reference rates may differ from live market, bank, card or payment-service rates.
      </p>
    </section>
  )
}
