import type { AIResultContextDto as PairAnalysisContextDto } from './analysis'
import type { AIComparisonContextDto } from './comparison'
import type { AIResultContextDto as ConversionContextDto } from './conversion'
import type { ISODateTimeStringDto } from './api'

export type BogartResultContextDto =
  | ConversionContextDto
  | PairAnalysisContextDto
  | AIComparisonContextDto

export type BogartRequestDto = {
  readonly question: string
  readonly context: BogartResultContextDto
  readonly anonymousUserKey: string
}

export type BogartRefusalReasonDto =
  | 'financial-advice'
  | 'future-prediction'
  | 'good-rate'
  | 'probability-forecast'
  | 'trading-strategy'
  | 'out-of-scope'
  | 'hidden-instructions'

export type BogartAnswerDto = {
  readonly _tag: 'BogartAnswer'
  readonly answer: string
  readonly remainingQuestions: number
}

export type BogartRefusalDto = {
  readonly _tag: 'BogartRefusal'
  readonly reason: BogartRefusalReasonDto
  readonly message: string
  readonly remainingQuestions: number
}

export type BogartDailyLimitDto = {
  readonly _tag: 'BogartDailyLimitReached'
  readonly limit: number
  readonly resetAt: ISODateTimeStringDto
}

export type BogartUnavailableDto = {
  readonly _tag: 'BogartUnavailable'
  readonly message: string
}

export type BogartResponseViewModelDto =
  | BogartAnswerDto
  | BogartRefusalDto
  | BogartDailyLimitDto
  | BogartUnavailableDto
