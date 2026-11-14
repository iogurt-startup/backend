import { describe, it, expect, beforeEach } from 'vitest'
import { CreatePatientUseCase } from './createPatientUseCase'
import { GetPatientUseCase } from './getPatientUseCase'
import { ListPatientsUseCase } from './listPatientsUseCase'
import { UpdatePatientUseCase } from './updatePatientUseCase'
import { InMemoryPatientsRepository } from '../repositories/in-memory/InMemoryPatientsRepository'
import { InMemoryTutorsRepository } from '../../tutor/repositories/in-memory/InMemoryTutorsRepository'

const CLINIC_ID = 'clinic-1'

const CPF_MARIA = '52998224725'
const CPF_JOAO = '39053344705'

const makeTutorInput = (overrides = {}) => ({
  clinicId: CLINIC_ID, fullName: 'Maria', cpf: CPF_MARIA, phone: '61999990000', ...overrides,
})

const makeInput = (overrides = {}) => ({
  clinicId: CLINIC_ID,
  name: 'Rex',
  tutorId: 'tutor-fixo',
  species: 'CANINE' as const,
  sex: 'MALE' as const,
  breed: 'Labrador',
  ...overrides,
})

describe('CreatePatientUseCase', () => {
  it('deve criar paciente quando o tutor existe', async () => {
    const patientsRepo = new InMemoryPatientsRepository()
    const tutorsRepo = new InMemoryTutorsRepository()
    const tutor = await tutorsRepo.create(makeTutorInput())
    const sut = new CreatePatientUseCase(patientsRepo, tutorsRepo)

    const patient = await sut.execute(makeInput({ tutorId: tutor.id }))
    expect(patient.id).toBeDefined()
    expect(patient.name).toBe('Rex')
    expect(patient.species).toBe('CANINE')
    expect(patient.sex).toBe('MALE')
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
    const patient = await sut.execute({ id: patientsRepo.items[0].id, clinicId: CLINIC_ID })
    expect(patient.name).toBe('Rex')
    expect(patient.tutor).toBeDefined()
  })

  it('deve lançar 404 para id inexistente', async () => {
    await expect(new GetPatientUseCase(patientsRepo).execute({ id: 'id-fake', clinicId: CLINIC_ID })).rejects.toMatchObject({ statusCode: 404 })
  })
})

describe('ListPatientsUseCase', () => {
  let patientsRepo: InMemoryPatientsRepository

  beforeEach(async () => {
    patientsRepo = new InMemoryPatientsRepository()
    await patientsRepo.create(makeInput({ name: 'Rex', tutorId: 'tutor-1' }))
    await patientsRepo.create(makeInput({ name: 'Mel', tutorId: 'tutor-1' }))
    await patientsRepo.create(makeInput({ name: 'Bob', tutorId: 'tutor-2' }))
    // Paciente de outra clínica — não deve aparecer
    await patientsRepo.create(makeInput({ name: 'Alien', tutorId: 'tutor-3', clinicId: 'clinic-2' }))

    patientsRepo.items[0].tutor = { ...patientsRepo.items[0].tutor, fullName: 'Maria Silva', cpf: CPF_MARIA }
    patientsRepo.items[1].tutor = { ...patientsRepo.items[1].tutor, fullName: 'Maria Silva', cpf: CPF_MARIA }
    patientsRepo.items[2].tutor = { ...patientsRepo.items[2].tutor, fullName: 'Joao Santos', cpf: CPF_JOAO }
  })

  it('deve listar apenas pacientes da clínica correta', async () => {
    const result = await new ListPatientsUseCase(patientsRepo).execute({ clinicId: CLINIC_ID })
    expect(result.total).toBe(3)
  })

  it('deve filtrar por nome (search)', async () => {
    const result = await new ListPatientsUseCase(patientsRepo).execute({ clinicId: CLINIC_ID, search: 'rex' })
    expect(result.total).toBe(1)
    expect(result.patients[0].name).toBe('Rex')
  })

  it('deve filtrar por tutorId', async () => {
    const result = await new ListPatientsUseCase(patientsRepo).execute({ clinicId: CLINIC_ID, tutorId: 'tutor-1' })
    expect(result.total).toBe(2)
  })

  it('deve filtrar pelo nome do tutor sem diferenciar maiusculas e minusculas', async () => {
    const result = await new ListPatientsUseCase(patientsRepo).execute({ clinicId: CLINIC_ID, search: 'MARIA' })
    expect(result.total).toBe(2)
    expect(result.patients.map(patient => patient.name)).toEqual(['Rex', 'Mel'])
  })

  it('deve filtrar pelo CPF do tutor com ou sem mascara', async () => {
    const sut = new ListPatientsUseCase(patientsRepo)
    const unmasked = await sut.execute({ clinicId: CLINIC_ID, search: CPF_JOAO })
    const masked = await sut.execute({ clinicId: CLINIC_ID, search: '390.533.447-05' })

    expect(unmasked.patients.map(patient => patient.name)).toEqual(['Bob'])
    expect(masked.patients.map(patient => patient.name)).toEqual(['Bob'])
  })

  it('deve retornar lista vazia quando nao houver correspondencias', async () => {
    const result = await new ListPatientsUseCase(patientsRepo).execute({ clinicId: CLINIC_ID, search: 'inexistente' })
    expect(result).toEqual({ patients: [], total: 0 })
  })
})

describe('UpdatePatientUseCase', () => {
  it('deve atualizar o nome do paciente', async () => {
    const patientsRepo = new InMemoryPatientsRepository()
    const tutorsRepo = new InMemoryTutorsRepository()
    const tutor = await tutorsRepo.create(makeTutorInput())
    await patientsRepo.create(makeInput({ tutorId: tutor.id }))
    const updated = await new UpdatePatientUseCase(patientsRepo, tutorsRepo)
      .execute({ id: patientsRepo.items[0].id, clinicId: CLINIC_ID, name: 'Rex Jr.' })
    expect(updated.name).toBe('Rex Jr.')
  })

  it('deve atualizar condicao reprodutiva e descricao de pelagem', async () => {
    const patientsRepo = new InMemoryPatientsRepository()
    const tutorsRepo = new InMemoryTutorsRepository()
    const tutor = await tutorsRepo.create(makeTutorInput())
    await patientsRepo.create(makeInput({ tutorId: tutor.id }))

    const updated = await new UpdatePatientUseCase(patientsRepo, tutorsRepo).execute({
      id: patientsRepo.items[0].id,
      clinicId: CLINIC_ID,
      reproductiveCondition: 'NEUTERED',
      coatDescription: 'Caramelo, pelo curto',
    })

    expect(updated.reproductiveCondition).toBe('NEUTERED')
    expect(updated.coatDescription).toBe('Caramelo, pelo curto')
  })

  it('deve atualizar dados do tutor junto com o paciente', async () => {
    const patientsRepo = new InMemoryPatientsRepository()
    const tutorsRepo = new InMemoryTutorsRepository()
    const tutor = await tutorsRepo.create(makeTutorInput())
    await patientsRepo.create(makeInput({ tutorId: tutor.id }))

    const updated = await new UpdatePatientUseCase(patientsRepo, tutorsRepo).execute({
      id: patientsRepo.items[0].id,
      clinicId: CLINIC_ID,
      observations: 'Alergia a cenoura',
      tutor: { fullName: 'Maria Souza', phone: '61988887777' },
    })

    expect(updated.observations).toBe('Alergia a cenoura')
    expect(updated.tutor.fullName).toBe('Maria Souza')
    expect(updated.tutor.phone).toBe('61988887777')
  })

  it('deve lançar 409 ao atualizar tutor com CPF já existente', async () => {
    const patientsRepo = new InMemoryPatientsRepository()
    const tutorsRepo = new InMemoryTutorsRepository()

    const tutorDoPaciente = await tutorsRepo.create(makeTutorInput())
    await tutorsRepo.create(makeTutorInput({ fullName: 'João', cpf: CPF_JOAO }))
    await patientsRepo.create(makeInput({ tutorId: tutorDoPaciente.id }))

    await expect(
      new UpdatePatientUseCase(patientsRepo, tutorsRepo).execute({
        id: patientsRepo.items[0].id,
        clinicId: CLINIC_ID,
        tutor: { cpf: CPF_JOAO },
      }),
    ).rejects.toMatchObject({ statusCode: 409 })
  })

  it('deve lançar 404 para paciente inexistente', async () => {
    await expect(
      new UpdatePatientUseCase(new InMemoryPatientsRepository(), new InMemoryTutorsRepository())
        .execute({ id: 'id-fake', clinicId: CLINIC_ID }),
    ).rejects.toMatchObject({ statusCode: 404 })
  })
})
