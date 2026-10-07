import { beforeEach, describe, expect, it } from 'vitest'
import { InMemoryPatientsRepository } from '../repositories/in-memory/InMemoryPatientsRepository'
import { DeletePatientUseCase } from './deletePatientUseCase'
import { AppError } from '../../../shared/errors/app-error'

let patientsRepository: InMemoryPatientsRepository
let sut: DeletePatientUseCase

describe('DeletePatientUseCase', () => {
  beforeEach(() => {
    patientsRepository = new InMemoryPatientsRepository()
    sut = new DeletePatientUseCase(patientsRepository)
  })

  it('deve realizar exclusão lógica de um paciente', async () => {
    const patient = await patientsRepository.create({
      name: 'Rex',
      species: 'Canina',
      tutorId: 'tutor-1',
      clinicId: 'clinic-1',
    })

    await sut.execute({ id: patient.id, clinicId: 'clinic-1' })

    const found = await patientsRepository.findById(patient.id, 'clinic-1')
    expect(found).toBeNull()

    const raw = patientsRepository.items.find(p => p.id === patient.id)
    expect(raw?.deletedAt).toBeInstanceOf(Date)
  })

  it('não deve deletar um paciente inexistente', async () => {
    await expect(sut.execute({ id: 'fake-id', clinicId: 'clinic-1' }))
      .rejects.toBeInstanceOf(AppError)
  })

  it('não deve deletar paciente de outra clínica', async () => {
    const patient = await patientsRepository.create({
      name: 'Rex',
      species: 'Canina',
      tutorId: 'tutor-1',
      clinicId: 'clinic-1',
    })

    await expect(sut.execute({ id: patient.id, clinicId: 'clinic-2' }))
      .rejects.toBeInstanceOf(AppError)
  })
})

