import { describe, it, expect, beforeEach } from 'vitest'
import { randomUUID } from 'crypto'
import { InMemoryPatientsRepository } from '../../../patient/repositories/in-memory/InMemoryPatientsRepository'
import { InMemoryChronicConditionsRepository } from '../../repositories/in-memory/InMemoryChronicConditionsRepository'
import { UpdateChronicConditionUseCase } from './updateChronicConditionUseCase'

const CLINIC_ID = 'clinic-1'
const OTHER_CLINIC_ID = 'clinic-2'
const DAY_MS = 24 * 60 * 60 * 1000

describe('UpdateChronicConditionUseCase', () => {
  let patientsRepository: InMemoryPatientsRepository
  let chronicConditionsRepository: InMemoryChronicConditionsRepository
  let useCase: UpdateChronicConditionUseCase

  async function createCondition(clinicId = CLINIC_ID) {
    const patient = await patientsRepository.create({ name: 'Rex', species: 'CANINE', sex: 'MALE', tutorId: 'tutor-1', clinicId })
    const condition = await chronicConditionsRepository.create({
      patientId: patient.id,
      name: 'Diabetes',
      diagnosedAt: new Date('2026-03-10T12:00:00.000Z'),
      status: 'ACTIVE',
      observations: 'Insulina 2x ao dia',
    })
    return { patient, condition }
  }

  beforeEach(() => {
    patientsRepository = new InMemoryPatientsRepository()
    chronicConditionsRepository = new InMemoryChronicConditionsRepository(patientsRepository)
    useCase = new UpdateChronicConditionUseCase(chronicConditionsRepository)
  })

  it('atualiza apenas os campos informados e preserva os omitidos', async () => {
    const { condition } = await createCondition()

    const updated = await useCase.execute({ id: condition.id, clinicId: CLINIC_ID, status: 'RESOLVED' })

    expect(updated.status).toBe('RESOLVED')
    expect(updated.name).toBe('Diabetes')
    expect(updated.diagnosedAt).toEqual(new Date('2026-03-10T12:00:00.000Z'))
    expect(updated.observations).toBe('Insulina 2x ao dia')
  })

  it('remove espaços do nome ao renomear', async () => {
    const { condition } = await createCondition()

    const updated = await useCase.execute({ id: condition.id, clinicId: CLINIC_ID, name: '  Diabetes tipo 2 ' })

    expect(updated.name).toBe('Diabetes tipo 2')
  })

  it('permite limpar observações e data de diagnóstico com null', async () => {
    const { condition } = await createCondition()

    const updated = await useCase.execute({
      id: condition.id,
      clinicId: CLINIC_ID,
      observations: null,
      diagnosedAt: null,
    })

    expect(updated.observations).toBeNull()
    expect(updated.diagnosedAt).toBeNull()
  })

  it('atualiza a data de diagnóstico', async () => {
    const { condition } = await createCondition()

    const updated = await useCase.execute({
      id: condition.id,
      clinicId: CLINIC_ID,
      diagnosedAt: '2026-04-01T12:00:00.000Z',
    })

    expect(updated.diagnosedAt).toEqual(new Date('2026-04-01T12:00:00.000Z'))
  })

  it('não altera o paciente da patologia', async () => {
    const { condition, patient } = await createCondition()

    const updated = await useCase.execute({ id: condition.id, clinicId: CLINIC_ID, name: 'Outro nome' })

    expect(updated.patientId).toBe(patient.id)
  })

  it('rejeita data de diagnóstico futura', async () => {
    const { condition } = await createCondition()

    await expect(
      useCase.execute({ id: condition.id, clinicId: CLINIC_ID, diagnosedAt: new Date(Date.now() + 3 * DAY_MS) })
    ).rejects.toMatchObject({ statusCode: 400 })
  })

  it('rejeita nome curto demais', async () => {
    const { condition } = await createCondition()

    await expect(
      useCase.execute({ id: condition.id, clinicId: CLINIC_ID, name: ' x ' })
    ).rejects.toMatchObject({ statusCode: 400 })
  })

  it('rejeita atualização sem nenhum campo', async () => {
    const { condition } = await createCondition()

    await expect(
      useCase.execute({ id: condition.id, clinicId: CLINIC_ID })
    ).rejects.toMatchObject({ statusCode: 400 })
  })

  it('retorna 404 quando a patologia não existe', async () => {
    await expect(
      useCase.execute({ id: randomUUID(), clinicId: CLINIC_ID, status: 'INACTIVE' })
    ).rejects.toMatchObject({ statusCode: 404, message: 'Patologia não encontrada.' })
  })

  it('retorna 404 para patologia de paciente de outra clínica e não a modifica', async () => {
    const { condition } = await createCondition(OTHER_CLINIC_ID)

    await expect(
      useCase.execute({ id: condition.id, clinicId: CLINIC_ID, status: 'INACTIVE' })
    ).rejects.toMatchObject({ statusCode: 404, message: 'Patologia não encontrada.' })
    expect(chronicConditionsRepository.items[0].status).toBe('ACTIVE')
  })

  it('retorna 404 quando o paciente da patologia foi excluído logicamente', async () => {
    const { condition, patient } = await createCondition()
    await patientsRepository.softDelete(patient.id)

    await expect(
      useCase.execute({ id: condition.id, clinicId: CLINIC_ID, status: 'INACTIVE' })
    ).rejects.toMatchObject({ statusCode: 404 })
  })
})
