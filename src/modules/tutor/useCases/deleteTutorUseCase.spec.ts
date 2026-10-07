import { beforeEach, describe, expect, it } from 'vitest'
import { InMemoryTutorsRepository } from '../repositories/in-memory/InMemoryTutorsRepository'
import { InMemoryPatientsRepository } from '../../patient/repositories/in-memory/InMemoryPatientsRepository'
import { DeleteTutorUseCase } from './deleteTutorUseCase'
import { AppError } from '../../../shared/errors/app-error'

let tutorsRepository: InMemoryTutorsRepository
let patientsRepository: InMemoryPatientsRepository
let sut: DeleteTutorUseCase

describe('DeleteTutorUseCase', () => {
  beforeEach(() => {
    tutorsRepository = new InMemoryTutorsRepository()
    patientsRepository = new InMemoryPatientsRepository()
    sut = new DeleteTutorUseCase(tutorsRepository, patientsRepository)
  })

  it('deve realizar exclusão lógica de um tutor sem pacientes ativos', async () => {
    const tutor = await tutorsRepository.create({
      clinicId: 'clinic-1',
      fullName: 'João Silva',
      cpf: '12345678900',
      phone: '11999999999',
    })

    await sut.execute({ id: tutor.id, clinicId: 'clinic-1' })

    const found = await tutorsRepository.findById(tutor.id, 'clinic-1')
    expect(found).toBeNull()

    const raw = tutorsRepository.items.find(t => t.id === tutor.id)
    expect(raw?.deletedAt).toBeInstanceOf(Date)
  })

  it('não deve deletar um tutor inexistente', async () => {
    await expect(sut.execute({ id: 'fake-id', clinicId: 'clinic-1' }))
      .rejects.toBeInstanceOf(AppError)
  })

  it('não deve deletar tutor de outra clínica', async () => {
    const tutor = await tutorsRepository.create({
      clinicId: 'clinic-1',
      fullName: 'João Silva',
      cpf: '12345678900',
      phone: '11999999999',
    })

    await expect(sut.execute({ id: tutor.id, clinicId: 'clinic-2' }))
      .rejects.toBeInstanceOf(AppError)
  })

  it('não deve permitir exclusão de tutor que possui pacientes ativos', async () => {
    const tutor = await tutorsRepository.create({
      clinicId: 'clinic-1',
      fullName: 'João Silva',
      cpf: '12345678900',
      phone: '11999999999',
    })

    await patientsRepository.create({
      clinicId: 'clinic-1',
      tutorId: tutor.id,
      name: 'Rex',
      species: 'Dog',
    })

    await expect(sut.execute({ id: tutor.id, clinicId: 'clinic-1' }))
      .rejects.toBeInstanceOf(AppError)
      .catch(err => expect(err.message).toBe('Não é possível excluir um tutor que possui pacientes ativos.'))
  })

  it('deve permitir exclusão se os pacientes do tutor já estiverem excluídos', async () => {
    const tutor = await tutorsRepository.create({
      clinicId: 'clinic-1',
      fullName: 'João Silva',
      cpf: '12345678900',
      phone: '11999999999',
    })

    const patient = await patientsRepository.create({
      clinicId: 'clinic-1',
      tutorId: tutor.id,
      name: 'Rex',
      species: 'Dog',
    })

    // Exclui o paciente primeiro
    await patientsRepository.softDelete(patient.id)

    // Agora o tutor deve poder ser excluído sem erros
    await sut.execute({ id: tutor.id, clinicId: 'clinic-1' })

    const found = await tutorsRepository.findById(tutor.id, 'clinic-1')
    expect(found).toBeNull()
  })
})

