import { describe, it, expect, beforeEach } from 'vitest'
import { CreateTutorUseCase } from './createTutorUseCase'
import { GetTutorUseCase } from './getTutorUseCase'
import { ListTutorsUseCase } from './listTutorsUseCase'
import { UpdateTutorUseCase } from './updateTutorUseCase'
import { InMemoryTutorsRepository } from '../repositories/in-memory/InMemoryTutorsRepository'

const CLINIC_ID = 'clinic-1'

/** CPFs válidos (dígitos verificadores corretos) para fixtures dos testes */
const CPF_MARIA = '52998224725'
const CPF_JOAO = '39053344705'
const CPF_CARLOS = '11144477735'
const CPF_OUTRA_CLINICA = '85351346893'

const makeInput = (overrides = {}) => ({
  clinicId: CLINIC_ID,
  fullName: 'Maria Silva', cpf: CPF_MARIA, phone: '61999990000', ...overrides,
})

describe('CreateTutorUseCase', () => {
  it('deve criar tutor com sucesso', async () => {
    const repo = new InMemoryTutorsRepository()
    const tutor = await new CreateTutorUseCase(repo).execute(makeInput())
    expect(tutor.id).toBeDefined()
    expect(tutor.fullName).toBe('Maria Silva')
  })

  it('não deve criar tutor com CPF duplicado na mesma clínica (409)', async () => {
    const repo = new InMemoryTutorsRepository()
    const sut = new CreateTutorUseCase(repo)
    await sut.execute(makeInput())
    await expect(sut.execute(makeInput())).rejects.toMatchObject({ statusCode: 409 })
  })

  it('deve permitir mesmo CPF em clínicas diferentes', async () => {
    const repo = new InMemoryTutorsRepository()
    const sut = new CreateTutorUseCase(repo)
    await sut.execute(makeInput({ clinicId: 'clinic-1' }))
    const tutor2 = await sut.execute(makeInput({ clinicId: 'clinic-2' }))
    expect(tutor2.id).toBeDefined()
  })

  it('deve criar tutor com contatos alternativos', async () => {
    const repo = new InMemoryTutorsRepository()
    const alternateContacts = [
      { name: 'João Silva', phone: '61999991111', relationship: 'Cônjuge', hasWhatsApp: true },
      { name: 'Ana Silva', phone: '61988882222', relationship: 'Irmã', hasWhatsApp: false },
    ]

    const tutor = await new CreateTutorUseCase(repo).execute(makeInput({ alternateContacts }))

    expect(tutor.alternateContacts).toEqual(alternateContacts)
  })
})

describe('GetTutorUseCase', () => {
  it('deve retornar o tutor pelo id', async () => {
    const repo = new InMemoryTutorsRepository()
    const created = await repo.create(makeInput())
    const tutor = await new GetTutorUseCase(repo).execute({ id: created.id, clinicId: CLINIC_ID })
    expect(tutor.id).toBe(created.id)
  })

  it('deve lançar 404 para id inexistente', async () => {
    await expect(new GetTutorUseCase(new InMemoryTutorsRepository()).execute({ id: 'id-fake', clinicId: CLINIC_ID })).rejects.toMatchObject({ statusCode: 404 })
  })
})

describe('ListTutorsUseCase', () => {
  let repo: InMemoryTutorsRepository

  beforeEach(async () => {
    repo = new InMemoryTutorsRepository()
    await repo.create(makeInput({ fullName: 'Maria Silva', cpf: CPF_MARIA }))
    await repo.create(makeInput({ fullName: 'João Santos', cpf: CPF_JOAO }))
    await repo.create(makeInput({ fullName: 'Carlos Oliveira', cpf: CPF_CARLOS }))
    // Tutor em outra clínica — não deve aparecer nas listagens da clinic-1
    await repo.create(makeInput({ fullName: 'Outro Clinic', cpf: CPF_OUTRA_CLINICA, clinicId: 'clinic-2' }))
  })

  it('deve listar apenas tutores da clínica correta', async () => {
    const result = await new ListTutorsUseCase(repo).execute({ clinicId: CLINIC_ID })
    expect(result.total).toBe(3)
    expect(result.tutors).toHaveLength(3)
  })

  it('deve filtrar por nome (search case-insensitive)', async () => {
    const result = await new ListTutorsUseCase(repo).execute({ clinicId: CLINIC_ID, search: 'maria' })
    expect(result.total).toBe(1)
    expect(result.tutors[0].fullName).toBe('Maria Silva')
  })
})

describe('UpdateTutorUseCase', () => {
  it('deve atualizar o telefone do tutor', async () => {
    const repo = new InMemoryTutorsRepository()
    const created = await repo.create(makeInput())
    const updated = await new UpdateTutorUseCase(repo).execute({ id: created.id, clinicId: CLINIC_ID, phone: '61988880000' })
    expect(updated.phone).toBe('61988880000')
  })

  it('deve lançar 409 ao atualizar para CPF já cadastrado na mesma clínica', async () => {
    const repo = new InMemoryTutorsRepository()
    const tutorA = await repo.create(makeInput({ cpf: CPF_MARIA }))
    await repo.create(makeInput({ cpf: CPF_JOAO }))

    await expect(
      new UpdateTutorUseCase(repo).execute({ id: tutorA.id, clinicId: CLINIC_ID, cpf: CPF_JOAO }),
    ).rejects.toMatchObject({ statusCode: 409 })
  })

  it('deve lançar 404 para tutor inexistente', async () => {
    await expect(new UpdateTutorUseCase(new InMemoryTutorsRepository()).execute({ id: 'id-fake', clinicId: CLINIC_ID })).rejects.toMatchObject({ statusCode: 404 })
  })

  it('deve substituir e limpar os contatos alternativos', async () => {
    const repo = new InMemoryTutorsRepository()
    const created = await repo.create(makeInput())
    const alternateContacts = [
      { name: 'João Silva', phone: '61999991111', relationship: 'Cônjuge', hasWhatsApp: true },
    ]
    const sut = new UpdateTutorUseCase(repo)

    const updated = await sut.execute({ id: created.id, clinicId: CLINIC_ID, alternateContacts })
    expect(updated.alternateContacts).toEqual(alternateContacts)

    const cleared = await sut.execute({ id: created.id, clinicId: CLINIC_ID, alternateContacts: [] })
    expect(cleared.alternateContacts).toEqual([])
  })
})
