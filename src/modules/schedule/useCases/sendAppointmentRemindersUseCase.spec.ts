import { beforeEach, describe, expect, it } from 'vitest'
import type { IMailProvider, SendMailData } from '../../auth/providers/IMailProvider'
import { InMemoryAppointmentsRepository } from '../repositories/in-memory/InMemoryAppointmentsRepository'
import { SendAppointmentRemindersUseCase } from './sendAppointmentRemindersUseCase'
import { env } from '../../../config/env'

class FakeMailProvider implements IMailProvider {
  public sentMessages: SendMailData[] = []
  public shouldFail = false
  public shouldThrow = false

  async sendMail(data: SendMailData): Promise<boolean> {
    if (this.shouldThrow) {
      throw new Error('Erro inesperado no provedor de e-mail')
    }
    if (this.shouldFail) {
      return false
    }
    this.sentMessages.push(data)
    return true
  }
}

describe('SendAppointmentRemindersUseCase', () => {
  let appointmentsRepository: InMemoryAppointmentsRepository
  let mailProvider: FakeMailProvider
  let sut: SendAppointmentRemindersUseCase

  const NOW = new Date('2026-10-27T10:00:00.000Z')

  beforeEach(() => {
    appointmentsRepository = new InMemoryAppointmentsRepository()
    mailProvider = new FakeMailProvider()
    env.FRONTEND_URL = 'http://localhost:5173'
    sut = new SendAppointmentRemindersUseCase(appointmentsRepository, mailProvider)
  })

  it('deve enviar e-mail de lembrete para consultas SCHEDULED dentro das próximas 24h e preencher reminderSentAt', async () => {
    const in20Hours = new Date(NOW.getTime() + 20 * 60 * 60 * 1000)

    const appointment = await appointmentsRepository.create({
      patientId: 'patient-1',
      vetId: 'vet-1',
      dateTime: in20Hours,
      category: 'VACCINATION',
    })

    const result = await sut.execute({ referenceDate: NOW })

    expect(result).toEqual({
      totalFound: 1,
      sentCount: 1,
      failedCount: 0,
      skippedCount: 0,
    })

    expect(mailProvider.sentMessages).toHaveLength(1)
    expect(mailProvider.sentMessages[0].to).toBe('tutor@iougurt.com')
    expect(mailProvider.sentMessages[0].subject).toContain('Lembrete de consulta — Paciente')
    expect(mailProvider.sentMessages[0].html).toContain('Tutor Padrão')

    const updated = await appointmentsRepository.findById(appointment.id, 'clinic-1')
    expect(updated?.reminderSentAt).toEqual(NOW)
  })

  it('deve garantir idempotência não reenviando lembrete na execução seguinte', async () => {
    const in12Hours = new Date(NOW.getTime() + 12 * 60 * 60 * 1000)

    await appointmentsRepository.create({
      patientId: 'patient-1',
      vetId: 'vet-1',
      dateTime: in12Hours,
      category: 'OBSERVATION',
    })

    const firstRun = await sut.execute({ referenceDate: NOW })
    expect(firstRun.sentCount).toBe(1)

    const secondRun = await sut.execute({ referenceDate: NOW })
    expect(secondRun.totalFound).toBe(0)
    expect(secondRun.sentCount).toBe(0)
    expect(mailProvider.sentMessages).toHaveLength(1)
  })

  it('deve ignorar consultas fora da janela de 24h ou com status diferente de SCHEDULED', async () => {
    const in30Hours = new Date(NOW.getTime() + 30 * 60 * 60 * 1000)
    const in2Hours = new Date(NOW.getTime() + 2 * 60 * 60 * 1000)
    const in1HourPast = new Date(NOW.getTime() - 1 * 60 * 60 * 1000)

    // Fora da janela (> 24h)
    await appointmentsRepository.create({
      patientId: 'p-future',
      dateTime: in30Hours,
      category: 'EXAM',
    })

    // No passado
    await appointmentsRepository.create({
      patientId: 'p-past',
      dateTime: in1HourPast,
      category: 'EXAM',
    })

    // Cancelada dentro da janela
    const cancelled = await appointmentsRepository.create({
      patientId: 'p-cancelled',
      dateTime: in2Hours,
      category: 'EXAM',
    })
    await appointmentsRepository.cancel(cancelled.id, 'Tutor desmarcou')

    const result = await sut.execute({ referenceDate: NOW })

    expect(result.totalFound).toBe(0)
    expect(result.sentCount).toBe(0)
    expect(mailProvider.sentMessages).toHaveLength(0)
  })

  it('não deve marcar reminderSentAt se o provedor de e-mail falhar, permitindo nova tentativa no próximo ciclo', async () => {
    const in18Hours = new Date(NOW.getTime() + 18 * 60 * 60 * 1000)

    const appointment = await appointmentsRepository.create({
      patientId: 'patient-1',
      dateTime: in18Hours,
      category: 'SURGICAL',
    })

    mailProvider.shouldFail = true
    const failedRun = await sut.execute({ referenceDate: NOW })

    expect(failedRun.totalFound).toBe(1)
    expect(failedRun.sentCount).toBe(0)
    expect(failedRun.failedCount).toBe(1)

    const afterFail = await appointmentsRepository.findById(appointment.id, 'clinic-1')
    expect(afterFail?.reminderSentAt).toBeNull()

    // No próximo ciclo o Resend volta a funcionar
    mailProvider.shouldFail = false
    const retryRun = await sut.execute({ referenceDate: NOW })

    expect(retryRun.sentCount).toBe(1)
    const afterRetry = await appointmentsRepository.findById(appointment.id, 'clinic-1')
    expect(afterRetry?.reminderSentAt).toEqual(NOW)
  })

  it('deve enviar novo lembrete caso uma consulta já notificada seja reagendada', async () => {
    const in10Hours = new Date(NOW.getTime() + 10 * 60 * 60 * 1000)
    const appointment = await appointmentsRepository.create({
      patientId: 'patient-1',
      dateTime: in10Hours,
      category: 'VACCINATION',
    })

    await sut.execute({ referenceDate: NOW })
    expect(mailProvider.sentMessages).toHaveLength(1)

    // Reagenda para nova data e avança o relógio para 20h antes da nova data
    const newDate = new Date('2026-11-05T14:00:00.000Z')
    await appointmentsRepository.reschedule(appointment.id, newDate)

    const resendReference = new Date(newDate.getTime() - 20 * 60 * 60 * 1000)
    const secondRun = await sut.execute({ referenceDate: resendReference })

    expect(secondRun.sentCount).toBe(1)
    expect(mailProvider.sentMessages).toHaveLength(2)
  })
})

