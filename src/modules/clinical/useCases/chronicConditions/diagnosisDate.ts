import { AppError } from '../../../../shared/errors/app-error'

// Tolerância de 24h: o frontend envia a data civil como 12:00 UTC do dia escolhido,
// que pode estar ligeiramente à frente do relógio do servidor para o fuso do Brasil.
const FUTURE_TOLERANCE_MS = 24 * 60 * 60 * 1000

export function parseDiagnosisDate(value: string | Date): Date {
  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    throw new AppError('Data de diagnóstico inválida.', 400)
  }

  if (date.getTime() > Date.now() + FUTURE_TOLERANCE_MS) {
    throw new AppError('A data de diagnóstico não pode ser futura.', 400)
  }

  return date
}
