import type { FastifyBaseLogger } from 'fastify'
import { makeSendAppointmentRemindersUseCase } from '../../useCases/factories/makeSendAppointmentRemindersUseCase'

export const DEFAULT_REMINDER_JOB_INTERVAL_MS = 15 * 60 * 1000 // 15 minutos

export interface StartAppointmentReminderJobOptions {
  logger?: FastifyBaseLogger
  intervalMs?: number
  runOnStart?: boolean
}

export interface AppointmentReminderJobHandle {
  stop: () => void
  runNow: () => Promise<void>
}

export function startAppointmentReminderJob(
  options: StartAppointmentReminderJobOptions = {},
): AppointmentReminderJobHandle {
  const {
    logger,
    intervalMs = DEFAULT_REMINDER_JOB_INTERVAL_MS,
    runOnStart = true,
  } = options

  let isRunning = false

  const runNow = async () => {
    if (isRunning) {
      logger?.warn('Job de lembrete de consultas já está em execução; pulando ciclo.')
      return
    }

    isRunning = true
    try {
      const useCase = makeSendAppointmentRemindersUseCase(logger)
      const summary = await useCase.execute()

      if (summary.totalFound > 0) {
        logger?.info(
          summary,
          'Ciclo do job de lembretes de consulta concluído',
        )
      }
    } catch (error) {
      logger?.error({ error }, 'Erro ao executar job de lembretes de consulta')
    } finally {
      isRunning = false
    }
  }

  const timer = setInterval(() => {
    void runNow()
  }, intervalMs)

  // Impede que o timer mantenha o event loop preso em encerramentos ou testes
  timer.unref()

  if (runOnStart) {
    void runNow()
  }

  return {
    stop: () => clearInterval(timer),
    runNow,
  }
}

