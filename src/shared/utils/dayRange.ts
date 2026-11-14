const DAY_MS = 24 * 60 * 60 * 1000

/**
 * Intervalo [start, end] (em UTC) do dia civil `YYYY-MM-DD` de um cliente.
 *
 * `date` vem de `new Date('YYYY-MM-DD')`, isto é, meia-noite UTC. Sem
 * `tzOffsetMinutes` o dia é o dia UTC (comportamento histórico, usado pelo
 * mobile). Com ele — o valor de `Date#getTimezoneOffset()` do cliente, ex.: 180
 * para UTC-3 — o dia passa a ser o dia local do usuário, para que um
 * atendimento às 21h30 em Brasília não apareça na agenda do dia seguinte.
 */
export function getDayRange(date: Date, tzOffsetMinutes = 0): { start: Date; end: Date } {
  const startMs =
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) + tzOffsetMinutes * 60_000
  return { start: new Date(startMs), end: new Date(startMs + DAY_MS - 1) }
}
