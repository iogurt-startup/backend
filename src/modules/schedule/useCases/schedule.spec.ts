import { describe, it, expect, beforeEach } from 'vitest'
import { CreateAppointmentUseCase } from './createAppointmentUseCase'
import { ListAppointmentsByDayUseCase } from './listAppointmentsByDayUseCase'
import { CancelAppointmentUseCase } from './cancelAppointmentUseCase'
import { RescheduleAppointmentUseCase } from './rescheduleAppointmentUseCase'
import { InMemoryAppointmentsRepository } from '../repositories/in-memory/InMemoryAppointmentsRepository'
import { InMemoryPatientsRepository } from '../../patient/repositories/in-memory/InMemoryPatientsRepository'
import { InMemoryUsersRepository } from '../../auth/repositories/in-memory/InMemoryUsersRepository'

const CLINIC_ID = 'clinic-1'

async function setupRepos() {
  const appointmentsRepo = new InMemoryAppointmentsRepository()
  const patientsRepo = new InMemoryPatientsRepository()
  const usersRepo = new InMemoryUsersRepository()

  const patient = await patientsRepo.create({ name: 'Rex', tutorId: 'tutor-1', species: 'CANINE', sex: 'MALE', clinicId: CLINIC_ID })
  const vet = await usersRepo.create({ name: 'Dr. Vet', email: 'vet@g.com', passwordHash: 'x', role: 'VET', clinicId: CLINIC_ID })

  return { appointmentsRepo, patientsRepo, usersRepo, patientId: patient.id, vetId: vet.id }
}

describe('CreateAppointmentUseCase', () => {
  it('deve criar agendamento com status SCHEDULED', async () => {
    const { appointmentsRepo, patientsRepo, usersRepo, patientId, vetId } = await setupRepos()
    const sut = new CreateAppointmentUseCase(appointmentsRepo, patientsRepo, usersRepo)

    const result = await sut.execute({ patientId, vetId, clinicId: CLINIC_ID, dateTime: new Date('2026-04-01T10:00:00'), category: 'VACCINATION' })

    expect(result.id).toBeDefined()
    expect(result.status).toBe('SCHEDULED')
  })

  it('deve criar agendamento de EXAM com observação', async () => {
    const { appointmentsRepo, patientsRepo, usersRepo, patientId, vetId } = await setupRepos()
    const sut = new CreateAppointmentUseCase(appointmentsRepo, patientsRepo, usersRepo)

    const result = await sut.execute({ patientId, vetId, clinicId: CLINIC_ID, dateTime: new Date('2026-04-01T14:00:00'), category: 'EXAM', observation: 'Exame de sangue' })
    expect(result.category).toBe('EXAM')
  })

  it('deve lançar 404 para paciente inexistente', async () => {
    const { appointmentsRepo, patientsRepo, usersRepo, vetId } = await setupRepos()
    const sut = new CreateAppointmentUseCase(appointmentsRepo, patientsRepo, usersRepo)

    await expect(sut.execute({ patientId: 'id-fake', clinicId: CLINIC_ID, vetId, dateTime: new Date(), category: 'OBSERVATION' })).rejects.toMatchObject({ statusCode: 404 })
  })

  it('deve lançar 404 para veterinário inexistente', async () => {
    const { appointmentsRepo, patientsRepo, usersRepo, patientId } = await setupRepos()
    const sut = new CreateAppointmentUseCase(appointmentsRepo, patientsRepo, usersRepo)

    await expect(sut.execute({ patientId, vetId: 'id-fake', clinicId: CLINIC_ID, dateTime: new Date(), category: 'OBSERVATION' })).rejects.toMatchObject({ statusCode: 404 })
  })

  it('deve lançar 404 para veterinário de outra clínica', async () => {
    const { appointmentsRepo, patientsRepo, usersRepo, patientId } = await setupRepos()
    const sut = new CreateAppointmentUseCase(appointmentsRepo, patientsRepo, usersRepo)
    const otherClinicVet = await usersRepo.create({
      name: 'Dr. Outra Clínica',
      email: 'outra-clinica@g.com',
      passwordHash: 'x',
      role: 'VET',
      clinicId: 'clinic-2',
    })

    await expect(
      sut.execute({
        patientId,
        vetId: otherClinicVet.id,
        clinicId: CLINIC_ID,
        dateTime: new Date(),
        category: 'OBSERVATION',
      })
    ).rejects.toMatchObject({ statusCode: 404 })
  })
})

describe('ListAppointmentsByDayUseCase', () => {
  let appointmentsRepo: InMemoryAppointmentsRepository

  beforeEach(async () => {
    appointmentsRepo = new InMemoryAppointmentsRepository()
    await appointmentsRepo.create({ patientId: 'p1', vetId: 'v1', dateTime: new Date('2026-04-01T09:00:00'), category: 'VACCINATION' })
    await appointmentsRepo.create({ patientId: 'p2', vetId: 'v2', dateTime: new Date('2026-04-01T15:00:00'), category: 'EXAM' })
    await appointmentsRepo.create({ patientId: 'p3', vetId: 'v1', dateTime: new Date('2026-04-02T09:00:00'), category: 'EXAM' })
  })

  it('deve retornar apenas os agendamentos do dia informado', async () => {
    const result = await new ListAppointmentsByDayUseCase(appointmentsRepo).execute({ date: '2026-04-01', clinicId: CLINIC_ID })
    expect(result).toHaveLength(2)
  })

  it('deve respeitar o fuso do cliente (tzOffsetMinutes) ao definir o dia', async () => {
    // 21h30 em Brasília = 00h30Z do dia seguinte
    await appointmentsRepo.create({ patientId: 'p4', vetId: 'v1', dateTime: new Date('2026-04-02T00:30:00Z'), category: 'EXAM' })
    const sut = new ListAppointmentsByDayUseCase(appointmentsRepo)

    const utcDay = await sut.execute({ date: '2026-04-01', clinicId: CLINIC_ID })
    const brDay = await sut.execute({ date: '2026-04-01', clinicId: CLINIC_ID, tzOffsetMinutes: 180 })

    expect(utcDay.map(a => a.patientId)).not.toContain('p4')
    expect(brDay.map(a => a.patientId)).toContain('p4')
  })

  it('deve filtrar por vetId dentro do dia', async () => {
    const result = await new ListAppointmentsByDayUseCase(appointmentsRepo).execute({ date: '2026-04-01', clinicId: CLINIC_ID, vetId: 'v1' })
    expect(result).toHaveLength(1)
    expect(result[0].vetId).toBe('v1')
  })

  it('deve retornar array vazio para dia sem agendamentos', async () => {
    const result = await new ListAppointmentsByDayUseCase(appointmentsRepo).execute({ date: '2099-01-01', clinicId: CLINIC_ID })
    expect(result).toHaveLength(0)
  })

  it('não deve listar agendamentos com status PENDING_APPROVAL ou REJECTED', async () => {
    const pending = await appointmentsRepo.create({
      patientId: 'p4',
      dateTime: new Date('2026-04-01T11:00:00'),
      category: 'OBSERVATION',
    })
    await appointmentsRepo.updateStatus(pending.id, 'PENDING_APPROVAL')

    const rejected = await appointmentsRepo.create({
      patientId: 'p5',
      dateTime: new Date('2026-04-01T12:00:00'),
      category: 'OBSERVATION',
    })
    await appointmentsRepo.updateStatus(rejected.id, 'REJECTED')

    const result = await new ListAppointmentsByDayUseCase(appointmentsRepo).execute({ date: '2026-04-01', clinicId: CLINIC_ID })
    expect(result).toHaveLength(2)
    expect(result.some(a => a.status === 'PENDING_APPROVAL' || a.status === 'REJECTED')).toBe(false)
  })
})

describe('CancelAppointmentUseCase', () => {
  it('deve cancelar um agendamento SCHEDULED com justificativa', async () => {
    const pRepo = new InMemoryPatientsRepository()
    const uRepo = new InMemoryUsersRepository()
    const aRepo = new InMemoryAppointmentsRepository()
    const patient = await pRepo.create({ name: 'Rex', tutorId: 'tutor-1', species: 'CANINE', sex: 'MALE', clinicId: CLINIC_ID })
    const vet = await uRepo.create({ name: 'Dr. Vet', email: 'vet2@g.com', passwordHash: 'x', role: 'VET', clinicId: CLINIC_ID })
    const appointment = await new CreateAppointmentUseCase(aRepo, pRepo, uRepo).execute({
      patientId: patient.id, vetId: vet.id, clinicId: CLINIC_ID,
      dateTime: new Date('2099-01-01T10:00:00'), category: 'OBSERVATION',
    })
    const result = await new CancelAppointmentUseCase(aRepo).execute({ appointmentId: appointment.id, clinicId: CLINIC_ID, reason: 'Paciente não compareceu' })
    expect(result.status).toBe('CANCELLED')
    expect(result.cancelReason).toBe('Paciente não compareceu')
  })

  it('deve rejeitar cancelamento sem justificativa adequada', async () => {
    const pRepo = new InMemoryPatientsRepository()
    const uRepo = new InMemoryUsersRepository()
    const aRepo = new InMemoryAppointmentsRepository()
    const patient = await pRepo.create({ name: 'Rex', tutorId: 'tutor-1', species: 'CANINE', sex: 'MALE', clinicId: CLINIC_ID })
    const vet = await uRepo.create({ name: 'Dr. Vet', email: 'vet3@g.com', passwordHash: 'x', role: 'VET', clinicId: CLINIC_ID })
    const appointment = await new CreateAppointmentUseCase(aRepo, pRepo, uRepo).execute({
      patientId: patient.id, vetId: vet.id, clinicId: CLINIC_ID,
      dateTime: new Date('2099-01-01T10:00:00'), category: 'OBSERVATION',
    })
    await expect(new CancelAppointmentUseCase(aRepo).execute({ appointmentId: appointment.id, clinicId: CLINIC_ID, reason: '' }))
      .rejects.toMatchObject({ statusCode: 400 })
  })

  it('deve rejeitar cancelamento de agendamento já cancelado', async () => {
    const pRepo = new InMemoryPatientsRepository()
    const uRepo = new InMemoryUsersRepository()
    const aRepo = new InMemoryAppointmentsRepository()
    const patient = await pRepo.create({ name: 'Rex', tutorId: 'tutor-1', species: 'CANINE', sex: 'MALE', clinicId: CLINIC_ID })
    const vet = await uRepo.create({ name: 'Dr. Vet', email: 'vet4@g.com', passwordHash: 'x', role: 'VET', clinicId: CLINIC_ID })
    const appointment = await new CreateAppointmentUseCase(aRepo, pRepo, uRepo).execute({
      patientId: patient.id, vetId: vet.id, clinicId: CLINIC_ID,
      dateTime: new Date('2099-01-01T10:00:00'), category: 'OBSERVATION',
    })
    const cancelUC = new CancelAppointmentUseCase(aRepo)
    await cancelUC.execute({ appointmentId: appointment.id, clinicId: CLINIC_ID, reason: 'Motivo válido aqui' })
    await expect(cancelUC.execute({ appointmentId: appointment.id, clinicId: CLINIC_ID, reason: 'Motivo válido aqui' }))
      .rejects.toMatchObject({ statusCode: 400 })
  })
})

describe('CreateAppointmentUseCase — conflitos', () => {
  it('deve bloquear double-booking do mesmo veterinário no mesmo horário', async () => {
    const { appointmentsRepo, patientsRepo, usersRepo, patientId, vetId } = await setupRepos()
    const sut = new CreateAppointmentUseCase(appointmentsRepo, patientsRepo, usersRepo)
    await sut.execute({ patientId, vetId, clinicId: CLINIC_ID, dateTime: new Date('2099-03-01T09:00:00'), endDateTime: new Date('2099-03-01T09:15:00'), category: 'OBSERVATION' })
    await expect(sut.execute({ patientId, vetId, clinicId: CLINIC_ID, dateTime: new Date('2099-03-01T09:00:00'), endDateTime: new Date('2099-03-01T09:15:00'), category: 'VACCINATION' }))
      .rejects.toMatchObject({ statusCode: 409 })
  })

  it('deve permitir o mesmo horário para veterinários diferentes', async () => {
    const { appointmentsRepo, patientsRepo, usersRepo, patientId, vetId } = await setupRepos()
    const vet2 = await usersRepo.create({ name: 'Dr. Outro', email: 'outro@g.com', passwordHash: 'x', role: 'VET', clinicId: CLINIC_ID })
    const sut = new CreateAppointmentUseCase(appointmentsRepo, patientsRepo, usersRepo)
    await sut.execute({ patientId, vetId, clinicId: CLINIC_ID, dateTime: new Date('2099-03-01T09:00:00'), endDateTime: new Date('2099-03-01T09:15:00'), category: 'OBSERVATION' })
    const result = await sut.execute({ patientId, vetId: vet2.id, clinicId: CLINIC_ID, dateTime: new Date('2099-03-01T09:00:00'), endDateTime: new Date('2099-03-01T09:15:00'), category: 'OBSERVATION' })
    expect(result.status).toBe('SCHEDULED')
  })

  it('deve bloquear agendamento que se sobrepõe parcialmente a outro', async () => {
    const { appointmentsRepo, patientsRepo, usersRepo, patientId, vetId } = await setupRepos()
    const sut = new CreateAppointmentUseCase(appointmentsRepo, patientsRepo, usersRepo)
    await sut.execute({ patientId, vetId, clinicId: CLINIC_ID, dateTime: new Date('2099-03-01T09:00:00'), endDateTime: new Date('2099-03-01T10:00:00'), category: 'SURGICAL' })
    await expect(sut.execute({ patientId, vetId, clinicId: CLINIC_ID, dateTime: new Date('2099-03-01T09:30:00'), endDateTime: new Date('2099-03-01T09:45:00'), category: 'OBSERVATION' }))
      .rejects.toMatchObject({ statusCode: 409 })
  })

  it('não deve bloquear um atendimento quando há um anterior SEM fim em outro horário', async () => {
    const { appointmentsRepo, patientsRepo, usersRepo, patientId, vetId } = await setupRepos()
    const sut = new CreateAppointmentUseCase(appointmentsRepo, patientsRepo, usersRepo)
    // Atendimento "direto" anterior, criado sem endDateTime (fica null).
    await sut.execute({ patientId, vetId, clinicId: CLINIC_ID, dateTime: new Date('2099-03-01T09:00:00'), category: 'OBSERVATION' })
    // Novo atendimento bem depois NÃO deve conflitar (sem fim != duração infinita).
    const result = await sut.execute({ patientId, vetId, clinicId: CLINIC_ID, dateTime: new Date('2099-03-01T14:00:00'), category: 'OBSERVATION' })
    expect(result.status).toBe('SCHEDULED')
  })

  it('deve bloquear atendimento sobreposto a um anterior SEM fim (dentro da janela padrão)', async () => {
    const { appointmentsRepo, patientsRepo, usersRepo, patientId, vetId } = await setupRepos()
    const sut = new CreateAppointmentUseCase(appointmentsRepo, patientsRepo, usersRepo)
    await sut.execute({ patientId, vetId, clinicId: CLINIC_ID, dateTime: new Date('2099-03-01T09:00:00'), category: 'OBSERVATION' })
    await expect(sut.execute({ patientId, vetId, clinicId: CLINIC_ID, dateTime: new Date('2099-03-01T09:05:00'), category: 'OBSERVATION' }))
      .rejects.toMatchObject({ statusCode: 409 })
  })

  it('deve permitir agendar no mesmo slot após cancelamento', async () => {
    const { appointmentsRepo, patientsRepo, usersRepo, patientId, vetId } = await setupRepos()
    const sut = new CreateAppointmentUseCase(appointmentsRepo, patientsRepo, usersRepo)
    const appt = await sut.execute({ patientId, vetId, clinicId: CLINIC_ID, dateTime: new Date('2099-03-01T09:00:00'), endDateTime: new Date('2099-03-01T09:15:00'), category: 'OBSERVATION' })
    await new CancelAppointmentUseCase(appointmentsRepo).execute({ appointmentId: appt.id, clinicId: CLINIC_ID, reason: 'Paciente cancelou' })
    const result = await sut.execute({ patientId, vetId, clinicId: CLINIC_ID, dateTime: new Date('2099-03-01T09:00:00'), endDateTime: new Date('2099-03-01T09:15:00'), category: 'OBSERVATION' })
    expect(result.status).toBe('SCHEDULED')
  })

  it('não deve considerar solicitações com status PENDING_APPROVAL ou REJECTED como conflito', async () => {
    const { appointmentsRepo, patientsRepo, usersRepo, patientId, vetId } = await setupRepos()
    const sut = new CreateAppointmentUseCase(appointmentsRepo, patientsRepo, usersRepo)

    const pending = await appointmentsRepo.create({
      patientId,
      vetId,
      dateTime: new Date('2099-03-01T09:00:00'),
      endDateTime: new Date('2099-03-01T09:15:00'),
      category: 'OBSERVATION',
    })
    await appointmentsRepo.updateStatus(pending.id, 'PENDING_APPROVAL')

    const result = await sut.execute({
      patientId,
      vetId,
      clinicId: CLINIC_ID,
      dateTime: new Date('2099-03-01T09:00:00'),
      endDateTime: new Date('2099-03-01T09:15:00'),
      category: 'OBSERVATION',
    })
    expect(result.status).toBe('SCHEDULED')
  })
})

describe('RescheduleAppointmentUseCase', () => {
  it('deve reagendar um agendamento SCHEDULED para data futura', async () => {
    const pRepo = new InMemoryPatientsRepository()
    const uRepo = new InMemoryUsersRepository()
    const aRepo = new InMemoryAppointmentsRepository()
    const patient = await pRepo.create({ name: 'Rex', tutorId: 'tutor-1', species: 'CANINE', sex: 'MALE', clinicId: CLINIC_ID })
    const vet = await uRepo.create({ name: 'Dr. Vet', email: 'vet5@g.com', passwordHash: 'x', role: 'VET', clinicId: CLINIC_ID })
    const appointment = await new CreateAppointmentUseCase(aRepo, pRepo, uRepo).execute({
      patientId: patient.id, vetId: vet.id, clinicId: CLINIC_ID,
      dateTime: new Date('2099-01-01T10:00:00'), category: 'OBSERVATION',
    })
    const newDate = new Date('2099-06-01T10:00:00')
    const result = await new RescheduleAppointmentUseCase(aRepo).execute({
      appointmentId: appointment.id, clinicId: CLINIC_ID, newDateTime: newDate,
    })
    expect(result.dateTime).toEqual(newDate)
  })

  it('deve rejeitar reagendamento para data no passado', async () => {
    const pRepo = new InMemoryPatientsRepository()
    const uRepo = new InMemoryUsersRepository()
    const aRepo = new InMemoryAppointmentsRepository()
    const patient = await pRepo.create({ name: 'Rex', tutorId: 'tutor-1', species: 'CANINE', sex: 'MALE', clinicId: CLINIC_ID })
    const vet = await uRepo.create({ name: 'Dr. Vet', email: 'vet6@g.com', passwordHash: 'x', role: 'VET', clinicId: CLINIC_ID })
    const appointment = await new CreateAppointmentUseCase(aRepo, pRepo, uRepo).execute({
      patientId: patient.id, vetId: vet.id, clinicId: CLINIC_ID,
      dateTime: new Date('2099-01-01T10:00:00'), category: 'OBSERVATION',
    })
    await expect(
      new RescheduleAppointmentUseCase(aRepo).execute({
        appointmentId: appointment.id,
        clinicId: CLINIC_ID,
        newDateTime: new Date('2020-01-01'),
      })
    ).rejects.toMatchObject({ statusCode: 400 })
  })

  it('deve bloquear reagendamento para horário já ocupado por outro agendamento', async () => {
    const pRepo = new InMemoryPatientsRepository()
    const uRepo = new InMemoryUsersRepository()
    const aRepo = new InMemoryAppointmentsRepository()
    const patient = await pRepo.create({ name: 'Rex', tutorId: 'tutor-1', species: 'CANINE', sex: 'MALE', clinicId: CLINIC_ID })
    const vet = await uRepo.create({ name: 'Dr. Vet', email: 'vet7@g.com', passwordHash: 'x', role: 'VET', clinicId: CLINIC_ID })
    const createUC = new CreateAppointmentUseCase(aRepo, pRepo, uRepo)
    await createUC.execute({ patientId: patient.id, vetId: vet.id, clinicId: CLINIC_ID, dateTime: new Date('2099-05-01T10:00:00'), endDateTime: new Date('2099-05-01T10:15:00'), category: 'OBSERVATION' })
    const appt2 = await createUC.execute({ patientId: patient.id, vetId: vet.id, clinicId: CLINIC_ID, dateTime: new Date('2099-05-01T11:00:00'), endDateTime: new Date('2099-05-01T11:15:00'), category: 'EXAM' })
    await expect(
      new RescheduleAppointmentUseCase(aRepo).execute({ appointmentId: appt2.id, clinicId: CLINIC_ID, newDateTime: new Date('2099-05-01T10:00:00'), newEndDateTime: new Date('2099-05-01T10:15:00') })
    ).rejects.toMatchObject({ statusCode: 409 })
  })

  it('deve permitir reagendar para o mesmo horário (auto-substituição)', async () => {
    const pRepo = new InMemoryPatientsRepository()
    const uRepo = new InMemoryUsersRepository()
    const aRepo = new InMemoryAppointmentsRepository()
    const patient = await pRepo.create({ name: 'Rex', tutorId: 'tutor-1', species: 'CANINE', sex: 'MALE', clinicId: CLINIC_ID })
    const vet = await uRepo.create({ name: 'Dr. Vet', email: 'vet8@g.com', passwordHash: 'x', role: 'VET', clinicId: CLINIC_ID })
    const appt = await new CreateAppointmentUseCase(aRepo, pRepo, uRepo).execute({ patientId: patient.id, vetId: vet.id, clinicId: CLINIC_ID, dateTime: new Date('2099-05-01T10:00:00'), endDateTime: new Date('2099-05-01T10:15:00'), category: 'OBSERVATION' })
    const result = await new RescheduleAppointmentUseCase(aRepo).execute({ appointmentId: appt.id, clinicId: CLINIC_ID, newDateTime: new Date('2099-05-01T10:00:00'), newEndDateTime: new Date('2099-05-01T10:15:00') })
    expect(result.dateTime).toEqual(new Date('2099-05-01T10:00:00'))
  })
})
