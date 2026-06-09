'use client'

import type { CustomDateRangeInput, DateRangeChoice } from './analysis-form-model'
import { dateRangeChoiceFromInput } from './analysis-form-model'
import { matchBoolean } from '@/shared/fp'

function CustomDateRangeFields({
  customRange,
  setEndDate,
  setStartDate,
}: {
  readonly customRange: CustomDateRangeInput
  readonly setEndDate: (value: string) => void
  readonly setStartDate: (value: string) => void
}) {
  return (
    <div className="converter-card__grid">
      <label className="field" htmlFor="analyse-start-date">
        <span className="field__label">Start date</span>
        <input
          className="field__control"
          id="analyse-start-date"
          name="startDate"
          onChange={(event) => {
            setStartDate(event.currentTarget.value)
          }}
          type="date"
          value={customRange.startDate}
        />
      </label>
      <label className="field" htmlFor="analyse-end-date">
        <span className="field__label">End date</span>
        <input
          className="field__control"
          id="analyse-end-date"
          name="endDate"
          onChange={(event) => {
            setEndDate(event.currentTarget.value)
          }}
          type="date"
          value={customRange.endDate}
        />
      </label>
    </div>
  )
}

export function AnalysisDateRangeFields({
  customRange,
  dateRangeChoice,
  setDateRangeChoice,
  setEndDate,
  setStartDate,
}: {
  readonly customRange: CustomDateRangeInput
  readonly dateRangeChoice: DateRangeChoice
  readonly setDateRangeChoice: (value: DateRangeChoice) => void
  readonly setEndDate: (value: string) => void
  readonly setStartDate: (value: string) => void
}) {
  return (
    <>
      <label className="field" htmlFor="analyse-date-range">
        <span className="field__label">Date range</span>
        <select
          className="field__control"
          id="analyse-date-range"
          name="dateRange"
          onChange={(event) => {
            setDateRangeChoice(dateRangeChoiceFromInput(event.currentTarget.value))
          }}
          value={dateRangeChoice}
        >
          <option value="7D">Last 7 days</option>
          <option value="30D">Last 30 days</option>
          <option value="90D">Last 90 days</option>
          <option value="1Y">Last year</option>
          <option value="Custom">Custom</option>
        </select>
      </label>
      {matchBoolean({
        false: () => null,
        true: () => (
          <CustomDateRangeFields
            customRange={customRange}
            setEndDate={setEndDate}
            setStartDate={setStartDate}
          />
        ),
      })(dateRangeChoice === 'Custom')}
    </>
  )
}
