import { describe, expect, it } from 'vitest'
import { GET } from '@/app/api/currencies/route'

describe('GET /api/currencies', () => {
  it('returns a standard API envelope with a static safe-list catalogue', async () => {
    const response = GET()
    const body = (await response.json()) as {
      readonly _tag: string
      readonly data: {
        readonly catalogue: {
          readonly source: string
          readonly currencies: ReadonlyArray<{ readonly code: string }>
        }
      }
    }

    expect(response.status).toBe(200)
    expect(body._tag).toBe('ApiSuccess')
    expect(body.data.catalogue.source).toBe('static-safe-list')
    expect(body.data.catalogue.currencies.map((currency) => currency.code)).toContain('USD')
  })
})
