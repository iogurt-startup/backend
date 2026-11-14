import { describe, it, expect, beforeEach } from 'vitest'
import { randomUUID } from 'crypto'
import { InMemoryPatientsRepository } from '../../../patient/repositories/in-memory/InMemoryPatientsRepository'
import { InMemoryChronicConditionsRepository } from '../../repositories/in-memory/InMemoryChronicConditionsRepository'
import { CreateChronicConditionUseCase } from './createChronicConditionUseCase'

const CLINIC_ID = 'clinic-1'
const OTHER_CLINIC_ID = 'clinic-2'
const DAY_MS = 24 * 60 * 60 * 1000

describe('CreateChronicConditionUseCase', () => {
  let patientsRepository: InMemoryPatientsRepository
  let chronicConditionsRepository: InMemoryChronicConditionsRepository
  let useCase: CreateChronicConditionUseCase

  async function createPatient(clinicId = CLINIC_ID) {
    return patientsRepository.create({ name: 'Rex', species: 'CANINE', sex: 'MALE', tutorId: 'tutor-1', clinicId })
  }

  beforeEach(() => {
    patientsRepository = new InMemoryPatientsRepository()
    chronicConditionsRepository = new InMemoryChronicConditionsRepository(patientsRepository)
    useCase = new CreateChronicConditionUseCase(chronicConditionsRepository, patientsRepository)
  })

  it('registra a patologia com status ACTIVE por padrão', async () => {
    const patient = await createPatient()

    const condition = await useCase.execute({
      patientId: patient.id,
      clinicId: CLINIC_ID,
      name: 'Diabetes mellitus',
      diagnosedAt: '2026-03-10T12:00:00.000Z',
      observations: 'Insulina 2x ao dia',
    })

    expect(condition.id).toBeDefined()
    expect(condition.patientId).toBe(patient.id)
    expect(condition.status).toBe('ACTIVE')
    expect(condition.diagnosedAt).toEqual(new Date('2026-03-10T12:00:00.000Z'))
    expect(condition.observations).toBe('Insulina 2x ao dia')
  })

  it('aceita status informado e campos opcionais ausentes', async () => {
    const patient = await createPatient()

    const condition = await useCase.execute({
      patientId: patient.id,
      clinicId: CLINIC_ID,
      name: 'Cardiopatia',
      status: 'INACTIVE',
    })

    expect(condition.status).toBe('INACTIVE')
    expect(condition.diagnosedAt).toBeNull()
    expect(condition.observations).toBeNull()
  })

  it('remove espaços do nome', async () => {
    const patient = await createPatient()

    const condition = await useCase.execute({ patientId: patient.id, clinicId: CLINIC_ID, name: '  Asma  ' })

    expect(condition.name).toBe('Asma')
  })

  it('rejeita nome com menos de 2 caracteres após o trim', async () => {
    const patient = await createPatient()

    await expect(
      useCase.execute({ patientId: patient.id, clinicId: CLINIC_ID, name: ' a ' })
    ).rejects.toMatchObject({ statusCode: 400 })
  })

  it('retorna 404 quando o paciente não existe', async () => {
    await expect(
      useCase.execute({ patientId: randomUUID(), clinicId: CLINIC_ID, name: 'Asma' })
    ).rejects.toMatchObject({ statusCode: 404, message: 'Paciente não encontrado.' })
  })

  it('retorna 404 para paciente de outra clínica sem revelar sua existência', async () => {
    const patient = await createPatient(OTHER_CLINIC_ID)

    await expect(
      useCase.execute({ patientId: patient.id, clinicId: CLINIC_ID, name: 'Asma' })
    ).rejects.toMatchObject({ statusCode: 404, message: 'Paciente não encontrado.' })
    expect(chronicConditionsRepository.items).toHaveLength(0)
  })

  it('retorna 404 para paciente excluído logicamente', async () => {
    const patient = await createPatient()
    await patientsRepository.softDelete(patient.id)

    await expect(
      useCase.execute({ patientId: patient.id, clinicId: CLINIC_ID, name: 'Asma' })
    ).rejects.toMatchObject({ statusCode: 404 })
    expect(chronicConditionsRepository.items).toHaveLength(0)
  })

  it('rejeita data de diagnóstico futura', async () => {
    const patient = await createPatient()

    await expect(
      useCase.execute({
        patientId: patient.id,
        clinicId: CLINIC_ID,
        name: 'Asma',
        diagnosedAt: new Date(Date.now() + 3 * DAY_MS),
      })
    ).rejects.toMatchObject({ statusCode: 400, message: 'A data de diagnóstico não pode ser futura.' })
  })

  it('aceita data civil de hoje enviada como 12:00 UTC (tolerância de fuso)', async () => {
    const patient = await createPatient()
    const today = new Date()
    today.setUTCHours(12, 0, 0, 0)

    const condition = await useCase.execute({
      patientId: patient.id,
      clinicId: CLINIC_ID,
      name: 'Asma',
      diagnosedAt: today,
    })

    expect(condition.diagnosedAt).toEqual(today)
  })

  it('rejeita data de diagnóstico inválida', async () => {
    const patient = await createPatient()

    await expect(
      useCase.execute({ patientId: patient.id, clinicId: CLINIC_ID, name: 'Asma', diagnosedAt: 'not-a-date' })
    ).rejects.toMatchObject({ statusCode: 400 })
  })
})
