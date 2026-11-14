import { describe, it, expect, beforeEach } from 'vitest'
import { randomUUID } from 'crypto'
import { InMemoryPatientsRepository } from '../../../patient/repositories/in-memory/InMemoryPatientsRepository'
import { InMemoryChronicConditionsRepository } from '../../repositories/in-memory/InMemoryChronicConditionsRepository'
import { ListPatientChronicConditionsUseCase } from './listPatientChronicConditionsUseCase'

const CLINIC_ID = 'clinic-1'
const OTHER_CLINIC_ID = 'clinic-2'

describe('ListPatientChronicConditionsUseCase', () => {
  let patientsRepository: InMemoryPatientsRepository
  let chronicConditionsRepository: InMemoryChronicConditionsRepository
  let useCase: ListPatientChronicConditionsUseCase

  async function createPatient(clinicId = CLINIC_ID) {
    return patientsRepository.create({ name: 'Rex', species: 'CANINE', sex: 'MALE', tutorId: 'tutor-1', clinicId })
  }

  beforeEach(() => {
    patientsRepository = new InMemoryPatientsRepository()
    chronicConditionsRepository = new InMemoryChronicConditionsRepository(patientsRepository)
    useCase = new ListPatientChronicConditionsUseCase(chronicConditionsRepository, patientsRepository)
  })

  it('lista somente as patologias do paciente solicitado', async () => {
    const rex = await createPatient()
    const mia = await createPatient()
    await chronicConditionsRepository.create({ patientId: rex.id, name: 'Diabetes', status: 'ACTIVE' })
    await chronicConditionsRepository.create({ patientId: rex.id, name: 'Asma', status: 'RESOLVED' })
    await chronicConditionsRepository.create({ patientId: mia.id, name: 'Artrose', status: 'ACTIVE' })

    const items = await useCase.execute({ patientId: rex.id, clinicId: CLINIC_ID })

    expect(items.map(item => item.name).sort()).toEqual(['Asma', 'Diabetes'])
  })

  it('retorna lista vazia quando o paciente não tem patologias', async () => {
    const patient = await createPatient()

    const items = await useCase.execute({ patientId: patient.id, clinicId: CLINIC_ID })

    expect(items).toEqual([])
  })

  it('ordena da mais recente para a mais antiga', async () => {
    const patient = await createPatient()
    const older = await chronicConditionsRepository.create({ patientId: patient.id, name: 'Antiga', status: 'ACTIVE' })
    const newer = await chronicConditionsRepository.create({ patientId: patient.id, name: 'Recente', status: 'ACTIVE' })
    older.createdAt = new Date('2026-01-01T00:00:00.000Z')
    newer.createdAt = new Date('2026-02-01T00:00:00.000Z')

    const items = await useCase.execute({ patientId: patient.id, clinicId: CLINIC_ID })

    expect(items.map(item => item.name)).toEqual(['Recente', 'Antiga'])
  })

  it('retorna 404 quando o paciente não existe', async () => {
    await expect(
      useCase.execute({ patientId: randomUUID(), clinicId: CLINIC_ID })
    ).rejects.toMatchObject({ statusCode: 404, message: 'Paciente não encontrado.' })
  })

  it('retorna 404 para paciente de outra clínica sem listar seus dados', async () => {
    const foreign = await createPatient(OTHER_CLINIC_ID)
    await chronicConditionsRepository.create({ patientId: foreign.id, name: 'Diabetes', status: 'ACTIVE' })

    await expect(
      useCase.execute({ patientId: foreign.id, clinicId: CLINIC_ID })
    ).rejects.toMatchObject({ statusCode: 404, message: 'Paciente não encontrado.' })
  })

  it('retorna 404 para paciente excluído logicamente', async () => {
    const patient = await createPatient()
    await chronicConditionsRepository.create({ patientId: patient.id, name: 'Diabetes', status: 'ACTIVE' })
    await patientsRepository.softDelete(patient.id)

    await expect(
      useCase.execute({ patientId: patient.id, clinicId: CLINIC_ID })
    ).rejects.toMatchObject({ statusCode: 404 })
  })
})
