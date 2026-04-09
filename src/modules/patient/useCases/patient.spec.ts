import { describe, it, expect, beforeEach } from 'vitest'
import { CreatePatientUseCase } from './createPatientUseCase'
import { GetPatientUseCase } from './getPatientUseCase'
import { ListPatientsUseCase } from './listPatientsUseCase'
import { UpdatePatientUseCase } from './updatePatientUseCase'
import { InMemoryPatientsRepository } from '../repositories/in-memory/InMemoryPatientsRepository'
import { InMemoryTutorsRepository } from '../../tutor/repositories/in-memory/InMemoryTutorsRepository'

const makeInput = (overrides = {}) => ({
  name: 'Rex', tutorId: 'tutor-fixo', species: 'Cachorro', breed: 'Labrador', ...overrides,
})

describe('CreatePatientUseCase', () => {
  it('deve criar paciente quando o tutor existe', async () => {
    const patientsRepo = new InMemoryPatientsRepository()
    const tutorsRepo = new InMemoryTutorsRepository()
    const tutor = await tutorsRepo.create({ fullName: 'Maria', cpf: '12345678901', phone: '61999' })
    const sut = new CreatePatientUseCase(patientsRepo, tutorsRepo)

    const patient = await sut.execute(makeInput({ tutorId: tutor.id }))
    expect(patient.id).toBeDefined()
    expect(patient.name).toBe('Rex')
  })

  it('deve lançar 404 quando tutorId não existe', async () => {
    const sut = new CreatePatientUseCase(new InMemoryPatientsRepository(), new InMemoryTutorsRepository())
    await expect(sut.execute(makeInput())).rejects.toMatchObject({ statusCode: 404 })
  })
})

describe('GetPatientUseCase', () => {
  let patientsRepo: InMemoryPatientsRepository

  beforeEach(async () => {
    patientsRepo = new InMemoryPatientsRepository()
    await patientsRepo.create(makeInput())
  })

  it('deve retornar o paciente com tutor incluído', async () => {
    const sut = new GetPatientUseCase(patientsRepo)
    const patient = await sut.execute(patientsRepo.items[0].id)
    expect(patient.name).toBe('Rex')
    expect(patient.tutor).toBeDefined()
  })

  it('deve lançar 404 para id inexistente', async () => {
    await expect(new GetPatientUseCase(patientsRepo).execute('id-fake')).rejects.toMatchObject({ statusCode: 404 })
  })
})

describe('ListPatientsUseCase', () => {
  let patientsRepo: InMemoryPatientsRepository

  beforeEach(async () => {
    patientsRepo = new InMemoryPatientsRepository()
    await patientsRepo.create(makeInput({ name: 'Rex', tutorId: 'tutor-1' }))
    await patientsRepo.create(makeInput({ name: 'Mel', tutorId: 'tutor-1' }))
    await patientsRepo.create(makeInput({ name: 'Bob', tutorId: 'tutor-2' }))
  })

  it('deve listar todos os pacientes', async () => {
    const result = await new ListPatientsUseCase(patientsRepo).execute({})
    expect(result.total).toBe(3)
  })

  it('deve filtrar por nome (search)', async () => {
    const result = await new ListPatientsUseCase(patientsRepo).execute({ search: 'rex' })
    expect(result.total).toBe(1)
    expect(result.patients[0].name).toBe('Rex')
  })

  it('deve filtrar por tutorId', async () => {
    const result = await new ListPatientsUseCase(patientsRepo).execute({ tutorId: 'tutor-1' })
    expect(result.total).toBe(2)
  })
})

describe('UpdatePatientUseCase', () => {
  it('deve atualizar o nome do paciente', async () => {
    const patientsRepo = new InMemoryPatientsRepository()
    const tutorsRepo = new InMemoryTutorsRepository()
    const tutor = await tutorsRepo.create({ fullName: 'Maria', cpf: '12345678901', phone: '61999' })
    const created = await patientsRepo.create(makeInput({ tutorId: tutor.id }))
    const updated = await new UpdatePatientUseCase(patientsRepo, tutorsRepo).execute({ id: created.id, name: 'Rex Jr.' })
    expect(updated.name).toBe('Rex Jr.')
  })

  it('deve atualizar dados do tutor ao editar paciente', async () => {
    const patientsRepo = new InMemoryPatientsRepository()
    const tutorsRepo = new InMemoryTutorsRepository()
    const tutor = await tutorsRepo.create({ fullName: 'Maria', cpf: '12345678901', phone: '61999' })
    const created = await patientsRepo.create(makeInput({ tutorId: tutor.id }))
    
    const updated = await new UpdatePatientUseCase(patientsRepo, tutorsRepo).execute({
      id: created.id,
      tutor: { fullName: 'Maria Silva', phone: '61988888888' }
    })
    
    expect(updated.tutor.fullName).toBe('Maria Silva')
    expect(updated.tutor.phone).toBe('61988888888')
  })

  it('deve lançar 404 para paciente inexistente', async () => {
    const tutorsRepo = new InMemoryTutorsRepository()
    await expect(new UpdatePatientUseCase(new InMemoryPatientsRepository(), tutorsRepo).execute({ id: 'id-fake' })).rejects.toMatchObject({ statusCode: 404 })
  })
})
