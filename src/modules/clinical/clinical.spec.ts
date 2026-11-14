import { describe, it, expect, beforeEach } from 'vitest'
import { InMemoryAppointmentsRepository } from '../schedule/repositories/in-memory/InMemoryAppointmentsRepository'
import { InMemoryClinicalRecordsRepository } from './repositories/in-memory/InMemoryClinicalRecordsRepository'
import { InMemoryUsersRepository } from '../auth/repositories/in-memory/InMemoryUsersRepository'
import { StartClinicalRecordUseCase } from './useCases/startClinicalRecordUseCase'
import { UpdateClinicalRecordUseCase } from './useCases/updateClinicalRecordUseCase'
import { FinalizeClinicalRecordUseCase } from './useCases/finalizeClinicalRecordUseCase'
import { GetPatientHistoryUseCase } from './useCases/getPatientHistoryUseCase'
import { randomUUID } from 'crypto'

describe('Clinical Records Module', () => {
  let appointmentsRepository: InMemoryAppointmentsRepository
  let clinicalRecordsRepository: InMemoryClinicalRecordsRepository
  let usersRepository: InMemoryUsersRepository
  let startUseCase: StartClinicalRecordUseCase
  let updateUseCase: UpdateClinicalRecordUseCase
  let finalizeUseCase: FinalizeClinicalRecordUseCase
  let historyUseCase: GetPatientHistoryUseCase

  beforeEach(() => {
    appointmentsRepository = new InMemoryAppointmentsRepository()
    clinicalRecordsRepository = new InMemoryClinicalRecordsRepository()
    usersRepository = new InMemoryUsersRepository()

    startUseCase = new StartClinicalRecordUseCase(
      appointmentsRepository,
      clinicalRecordsRepository,
      usersRepository
    )
    updateUseCase = new UpdateClinicalRecordUseCase(clinicalRecordsRepository)
    finalizeUseCase = new FinalizeClinicalRecordUseCase(clinicalRecordsRepository, appointmentsRepository)
    historyUseCase = new GetPatientHistoryUseCase(clinicalRecordsRepository)
  })

  it('should start a clinical record and change appointment status to IN_PROGRESS', async () => {
    const vetId = randomUUID()
    await usersRepository.create({
      email: 'vet@example.com',
      passwordHash: 'hash',
      name: 'Dr. Vet',
      role: 'VET',
      clinicId: 'clinic-1',
      crmv: 'CRMV-123',
    })
    const appointment = await appointmentsRepository.create({
      patientId: 'patient-1',
      vetId,
      dateTime: new Date(),
      category: 'OBSERVATION',
    })

    const record = await startUseCase.execute({
      appointmentId: appointment.id,
      vetId,
      clinicId: 'clinic-1',
    })

    expect(record.id).toBeDefined()
    expect(record.appointmentId).toBe(appointment.id)
    expect(record.patientId).toBe('patient-1')
    expect(record.vetId).toBe(vetId)

    const updatedAppt = await appointmentsRepository.findById(appointment.id, 'clinic-1')
    expect(updatedAppt?.status).toBe('IN_PROGRESS')
  })

  it('should allow OWNER with CRMV to start appointment of another vet in same clinic', async () => {
    const originalVetId = randomUUID()
    const owner = await usersRepository.create({
      email: 'owner@example.com',
      passwordHash: 'hash',
      name: 'Dr. Dono',
      role: 'OWNER',
      clinicId: 'clinic-1',
      crmv: 'CRMV-SP 99999',
    })

    const appointment = await appointmentsRepository.create({
      patientId: 'patient-1',
      vetId: originalVetId,
      dateTime: new Date(),
      category: 'OBSERVATION',
    })

    const record = await startUseCase.execute({
      appointmentId: appointment.id,
      vetId: owner.id,
      clinicId: 'clinic-1',
    })

    expect(record.id).toBeDefined()
    expect(record.vetId).toBe(owner.id)

    const updatedAppt = await appointmentsRepository.findById(appointment.id, 'clinic-1')
    expect(updatedAppt?.status).toBe('IN_PROGRESS')
  })

  it('should not allow OWNER without CRMV to start a clinical record', async () => {
    const ownerWithoutCrmv = await usersRepository.create({
      email: 'owner2@example.com',
      passwordHash: 'hash',
      name: 'Dono Sem CRMV',
      role: 'OWNER',
      clinicId: 'clinic-1',
      crmv: null,
    })

    const appointment = await appointmentsRepository.create({
      patientId: 'patient-1',
      vetId: randomUUID(),
      dateTime: new Date(),
      category: 'OBSERVATION',
    })

    await expect(
      startUseCase.execute({
        appointmentId: appointment.id,
        vetId: ownerWithoutCrmv.id,
        clinicId: 'clinic-1',
      })
    ).rejects.toThrow('É necessário possuir CRMV cadastrado para iniciar o prontuário.')
  })

  it('should not allow OWNER of another clinic to start a clinical record', async () => {
    const ownerOtherClinic = await usersRepository.create({
      email: 'owner3@example.com',
      passwordHash: 'hash',
      name: 'Dono Outra Clinica',
      role: 'OWNER',
      clinicId: 'clinic-2',
      crmv: 'CRMV-12345',
    })

    const appointment = await appointmentsRepository.create({
      patientId: 'patient-1',
      vetId: randomUUID(),
      dateTime: new Date(),
      category: 'OBSERVATION',
    })

    await expect(
      startUseCase.execute({
        appointmentId: appointment.id,
        vetId: ownerOtherClinic.id,
        clinicId: 'clinic-2',
      })
    ).rejects.toThrow('Agendamento não encontrado.')
  })

  it('should not allow starting a record if not the assigned vet', async () => {
    const assignedVetId = randomUUID()
    const otherVet = await usersRepository.create({
      email: 'other-vet@example.com',
      passwordHash: 'hash',
      name: 'Outro Vet',
      role: 'VET',
      clinicId: 'clinic-1',
      crmv: 'CRMV-888',
    })

    const appointment = await appointmentsRepository.create({
      patientId: 'patient-1',
      vetId: assignedVetId,
      dateTime: new Date(),
      category: 'OBSERVATION',
    })

    await expect(
      startUseCase.execute({
        appointmentId: appointment.id,
        vetId: otherVet.id,
        clinicId: 'clinic-1',
      })
    ).rejects.toThrow('Apenas o veterinário responsável pode iniciar o prontuário.')
  })

  it('should reject originally assigned VET from starting after OWNER already assumed and started the record', async () => {
    const originalVet = await usersRepository.create({
      email: 'original-vet@example.com',
      passwordHash: 'hash',
      name: 'Dr. Escalado',
      role: 'VET',
      clinicId: 'clinic-1',
      crmv: 'CRMV-111',
    })

    const owner = await usersRepository.create({
      email: 'owner@example.com',
      passwordHash: 'hash',
      name: 'Dr. Dono',
      role: 'OWNER',
      clinicId: 'clinic-1',
      crmv: 'CRMV-999',
    })

    const appointment = await appointmentsRepository.create({
      patientId: 'patient-1',
      vetId: originalVet.id,
      dateTime: new Date(),
      category: 'OBSERVATION',
    })

    // OWNER inicia o prontuário primeiro
    const record = await startUseCase.execute({
      appointmentId: appointment.id,
      vetId: owner.id,
      clinicId: 'clinic-1',
    })
    expect(record.vetId).toBe(owner.id)

    // VET original tenta iniciar a consulta depois
    await expect(
      startUseCase.execute({
        appointmentId: appointment.id,
        vetId: originalVet.id,
        clinicId: 'clinic-1',
      })
    ).rejects.toThrow('Apenas o veterinário responsável pode iniciar o prontuário.')
  })

  it('should not allow starting a record if appointment status is PENDING_APPROVAL', async () => {
    const vetId = randomUUID()
    const appointment = await appointmentsRepository.create({
      patientId: 'patient-1',
      vetId,
      dateTime: new Date(),
      category: 'OBSERVATION',
    })
    await appointmentsRepository.updateStatus(appointment.id, 'PENDING_APPROVAL')

    await expect(startUseCase.execute({
      appointmentId: appointment.id,
      vetId,
      clinicId: 'clinic-1',
    })).rejects.toThrow('Apenas agendamentos agendados ou em andamento podem ter prontuário iniciado.')
  })

  it('should not allow starting a record if appointment status is REJECTED', async () => {
    const vetId = randomUUID()
    const appointment = await appointmentsRepository.create({
      patientId: 'patient-1',
      vetId,
      dateTime: new Date(),
      category: 'OBSERVATION',
    })
    await appointmentsRepository.updateStatus(appointment.id, 'REJECTED')

    await expect(startUseCase.execute({
      appointmentId: appointment.id,
      vetId,
      clinicId: 'clinic-1',
    })).rejects.toThrow('Apenas agendamentos agendados ou em andamento podem ter prontuário iniciado.')
  })

  it('should update clinical record notes and weight', async () => {
    const vetId = randomUUID()
    const appointment = await appointmentsRepository.create({
      patientId: 'patient-1',
      vetId,
      dateTime: new Date(),
      category: 'OBSERVATION',
    })

    const record = await startUseCase.execute({
      appointmentId: appointment.id,
      vetId,
      clinicId: 'clinic-1',
    })

    const updated = await updateUseCase.execute({
      recordId: record.id,
      vetId,
      clinicId: 'clinic-1',
      data: {
        weightKg: 12.5,
        clinicalNotes: 'Paciente estável',
      },
    })

    expect(updated.weightKg?.toNumber()).toBe(12.5)
    expect(updated.clinicalNotes).toBe('Paciente estável')
  })

  // CLI-01 — observações do atendimento em campo próprio.
  it('should save appointment observations in their own field', async () => {
    const vetId = randomUUID()
    const appointment = await appointmentsRepository.create({
      patientId: 'patient-1',
      vetId,
      dateTime: new Date(),
      category: 'OBSERVATION',
    })

    const record = await startUseCase.execute({
      appointmentId: appointment.id,
      vetId,
      clinicId: 'clinic-1',
    })

    const updated = await updateUseCase.execute({
      recordId: record.id,
      vetId,
      clinicId: 'clinic-1',
      data: {
        observations: 'Tutor relata tosse noturna há uma semana',
        routineGuidance: 'Retorno em 15 dias',
      },
    })

    expect(updated.observations).toBe('Tutor relata tosse noturna há uma semana')
    // O campo de orientações volta a guardar só o que ele deveria guardar:
    // texto puro, sem JSON embutido.
    expect(updated.routineGuidance).toBe('Retorno em 15 dias')
    expect(updated.routineGuidance).not.toContain('__IOUGURT_META__')
  })

  it('should keep observations untouched when the update omits them', async () => {
    const vetId = randomUUID()
    const appointment = await appointmentsRepository.create({
      patientId: 'patient-1',
      vetId,
      dateTime: new Date(),
      category: 'OBSERVATION',
    })

    const record = await startUseCase.execute({
      appointmentId: appointment.id,
      vetId,
      clinicId: 'clinic-1',
    })

    await updateUseCase.execute({
      recordId: record.id,
      vetId,
      clinicId: 'clinic-1',
      data: { observations: 'Tosse noturna' },
    })

    const updated = await updateUseCase.execute({
      recordId: record.id,
      vetId,
      clinicId: 'clinic-1',
      data: { diagnosis: 'Traqueobronquite' },
    })

    expect(updated.diagnosis).toBe('Traqueobronquite')
    expect(updated.observations).toBe('Tosse noturna')
  })

  it('should finalize clinical record and mark appointment as COMPLETED', async () => {
    const vetId = randomUUID()
    const endDateTime = new Date('2099-01-01T10:30:00.000Z')
    const appointment = await appointmentsRepository.create({
      patientId: 'patient-1',
      vetId,
      dateTime: new Date(),
      category: 'OBSERVATION',
    })

    const record = await startUseCase.execute({
      appointmentId: appointment.id,
      vetId,
      clinicId: 'clinic-1',
    })

    const finalized = await finalizeUseCase.execute({
      recordId: record.id,
      vetId,
      clinicId: 'clinic-1',
      endDateTime,
    })

    expect(finalized.finalized).toBe(true)

    const appt = await appointmentsRepository.findById(appointment.id, 'clinic-1')
    expect(appt?.status).toBe('COMPLETED')
    expect(appt?.endDateTime?.toISOString()).toBe(endDateTime.toISOString())
  })

  it('should keep the scheduled endDateTime when finalizing a booked appointment out of hours', async () => {
    const vetId = randomUUID()
    const scheduledEnd = new Date('2099-01-01T08:15:00.000Z')
    const appointment = await appointmentsRepository.create({
      patientId: 'patient-1',
      vetId,
      dateTime: new Date('2099-01-01T08:00:00.000Z'),
      endDateTime: scheduledEnd,
      category: 'OBSERVATION',
    })

    const record = await startUseCase.execute({
      appointmentId: appointment.id,
      vetId,
      clinicId: 'clinic-1',
    })

    await finalizeUseCase.execute({
      recordId: record.id,
      vetId,
      clinicId: 'clinic-1',
      endDateTime: new Date('2099-01-01T19:00:00.000Z'),
    })

    const appt = await appointmentsRepository.findById(appointment.id, 'clinic-1')
    expect(appt?.status).toBe('COMPLETED')
    expect(appt?.endDateTime?.toISOString()).toBe(scheduledEnd.toISOString())
  })

  it('should not allow editing a finalized record', async () => {
    const vetId = randomUUID()
    const appointment = await appointmentsRepository.create({
      patientId: 'patient-1',
      vetId,
      dateTime: new Date(),
      category: 'OBSERVATION',
    })

    const record = await startUseCase.execute({
      appointmentId: appointment.id,
      vetId,
      clinicId: 'clinic-1',
    })

    await finalizeUseCase.execute({ recordId: record.id, vetId, clinicId: 'clinic-1' })

    await expect(
      updateUseCase.execute({
        recordId: record.id,
        vetId,
        clinicId: 'clinic-1',
        data: { weightKg: 15 },
      })
    ).rejects.toThrow('Não é possível editar um prontuário finalizado')
  })

  it('should fetch patient clinical history', async () => {
    const vetId = randomUUID()
    const appointment1 = await appointmentsRepository.create({
      patientId: 'patient-1',
      vetId,
      dateTime: new Date(),
      category: 'OBSERVATION',
    })
    await startUseCase.execute({ appointmentId: appointment1.id, vetId, clinicId: 'clinic-1' })

    const history = await historyUseCase.execute({ patientId: 'patient-1' })
    expect(history.length).toBe(1)
  })
})
