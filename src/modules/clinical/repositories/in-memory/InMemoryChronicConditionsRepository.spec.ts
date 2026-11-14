import { describe, it, expect, beforeEach } from 'vitest'
import { InMemoryPatientsRepository } from '../../../patient/repositories/in-memory/InMemoryPatientsRepository'
import { InMemoryChronicConditionsRepository } from './InMemoryChronicConditionsRepository'

describe('InMemoryChronicConditionsRepository', () => {
  let patientsRepository: InMemoryPatientsRepository
  let repository: InMemoryChronicConditionsRepository

  beforeEach(() => {
    patientsRepository = new InMemoryPatientsRepository()
    repository = new InMemoryChronicConditionsRepository(patientsRepository)
  })

  it('findById só retorna registros de pacientes da clínica informada', async () => {
    const patient = await patientsRepository.create({ name: 'Rex', species: 'CANINE', sex: 'MALE', tutorId: 't', clinicId: 'clinic-1' })
    const condition = await repository.create({ patientId: patient.id, name: 'Asma', status: 'ACTIVE' })

    expect(await repository.findById(condition.id, 'clinic-1')).toEqual(condition)
    expect(await repository.findById(condition.id, 'clinic-2')).toBeNull()
  })

  it('findById ignora registros de pacientes excluídos logicamente', async () => {
    const patient = await patientsRepository.create({ name: 'Rex', species: 'CANINE', sex: 'MALE', tutorId: 't', clinicId: 'clinic-1' })
    const condition = await repository.create({ patientId: patient.id, name: 'Asma', status: 'ACTIVE' })
    await patientsRepository.softDelete(patient.id)

    expect(await repository.findById(condition.id, 'clinic-1')).toBeNull()
  })

  it('update não sobrescreve campos undefined e atualiza updatedAt', async () => {
    const patient = await patientsRepository.create({ name: 'Rex', species: 'CANINE', sex: 'MALE', tutorId: 't', clinicId: 'clinic-1' })
    const condition = await repository.create({ patientId: patient.id, name: 'Asma', status: 'ACTIVE', observations: 'obs' })
    const createdUpdatedAt = condition.updatedAt

    const updated = await repository.update(condition.id, { status: 'RESOLVED', name: undefined })

    expect(updated.name).toBe('Asma')
    expect(updated.observations).toBe('obs')
    expect(updated.status).toBe('RESOLVED')
    expect(updated.updatedAt.getTime()).toBeGreaterThanOrEqual(createdUpdatedAt.getTime())
  })
})
