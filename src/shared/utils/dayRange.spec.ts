import { describe, expect, it } from 'vitest'
import { getDayRange } from './dayRange'

describe('getDayRange', () => {
  const day = new Date('2026-11-12')

  it('sem offset usa o dia UTC', () => {
    const { start, end } = getDayRange(day)
    expect(start.toISOString()).toBe('2026-11-12T00:00:00.000Z')
    expect(end.toISOString()).toBe('2026-11-12T23:59:59.999Z')
  })

  it('com offset de Brasília (180) usa o dia local', () => {
    const { start, end } = getDayRange(day, 180)
    expect(start.toISOString()).toBe('2026-11-12T03:00:00.000Z')
    expect(end.toISOString()).toBe('2026-11-13T02:59:59.999Z')
    // 21h30 em Brasília (00h30Z do dia seguinte) pertence ao dia 12
    const evening = new Date('2026-11-13T00:30:00.000Z')
    expect(evening >= start && evening <= end).toBe(true)
  })
})
