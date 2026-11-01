import { beforeEach, describe, expect, it, vi } from 'vitest'
import { startAppointmentReminderJob } from './appointmentReminderJob'
import * as factoryModule from '../../useCases/factories/makeSendAppointmentRemindersUseCase'
import type { FastifyBaseLogger } from 'fastify'

describe('startAppointmentReminderJob', () => {
  const fakeLogger = {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('deve executar o caso de uso e logar resumo quando encontrar lembretes', async () => {
    const executeMock = vi.fn().mockResolvedValue({
      totalFound: 2,
      sentCount: 2,
      failedCount: 0,
      skippedCount: 0,
    })

    vi.spyOn(factoryModule, 'makeSendAppointmentRemindersUseCase').mockReturnValue({
      execute: executeMock,
    } as unknown as ReturnType<typeof factoryModule.makeSendAppointmentRemindersUseCase>)

    const handle = startAppointmentReminderJob({
      logger: fakeLogger as unknown as FastifyBaseLogger,
      runOnStart: false,
      intervalMs: 60_000,
    })

    await handle.runNow()
    handle.stop()

    expect(executeMock).toHaveBeenCalledTimes(1)
    expect(fakeLogger.info).toHaveBeenCalledWith(
      {
        totalFound: 2,
        sentCount: 2,
        failedCount: 0,
        skippedCount: 0,
      },
      'Ciclo do job de lembretes de consulta concluído',
    )
  })

  it('deve capturar e logar erros inesperados sem quebrar o processo', async () => {
    const executeMock = vi.fn().mockRejectedValue(new Error('Falha no banco'))

    vi.spyOn(factoryModule, 'makeSendAppointmentRemindersUseCase').mockReturnValue({
      execute: executeMock,
    } as unknown as ReturnType<typeof factoryModule.makeSendAppointmentRemindersUseCase>)

    const handle = startAppointmentReminderJob({
      logger: fakeLogger as unknown as FastifyBaseLogger,
      runOnStart: false,
      intervalMs: 60_000,
    })

    await expect(handle.runNow()).resolves.not.toThrow()
    handle.stop()

    expect(fakeLogger.error).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.any(Error) }),
      'Erro ao executar job de lembretes de consulta',
    )
  })
})

