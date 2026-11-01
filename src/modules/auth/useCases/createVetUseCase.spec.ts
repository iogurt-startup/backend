import { describe, it, expect, vi, beforeEach } from 'vitest'
import { CreateVetUseCase } from './createVetUseCase'
import { InMemoryUsersRepository } from '../repositories/in-memory/InMemoryUsersRepository'
import type { IHashProvider } from '../providers/IHashProvider'
import { prisma } from '@config/prisma'
import { AppError } from '../../../shared/errors/app-error'

vi.mock('@config/prisma', () => ({
  prisma: {
    clinic: {
      findUnique: vi.fn(),
    },
  },
}))

class FakeHashProvider implements IHashProvider {
  async hash(plain: string) { return `hashed:${plain}` }
  async compare(plain: string, hashed: string) { return hashed === `hashed:${plain}` }
}

describe('CreateVetUseCase', () => {
  let usersRepository: InMemoryUsersRepository
  let hashProvider: FakeHashProvider
  let sut: CreateVetUseCase

  beforeEach(() => {
    vi.clearAllMocks()
    usersRepository = new InMemoryUsersRepository()
    hashProvider = new FakeHashProvider()
    sut = new CreateVetUseCase(usersRepository, hashProvider)
  })

  it('deve criar um veterinário com sucesso vinculado à clínica pelo código', async () => {
    vi.mocked(prisma.clinic.findUnique).mockResolvedValue({
      id: 'clinic-1',
      name: 'Clínica PetLife',
      code: 'PETLIFE-7A2',
      users: [{ id: 'owner-1' }],
    } as any)

    const result = await sut.execute({
      name: 'Dra. Beatriz',
      email: 'beatriz@vet.com',
      password: 'senhaSegura123',
      crmv: 'CRMV-SP 12345',
      clinicCode: 'petlife-7a2',
    })

    expect(result.id).toBeDefined()
    expect(result.email).toBe('beatriz@vet.com')
    expect(result.role).toBe('VET')
    expect(result.crmv).toBe('CRMV-SP 12345')
    expect(result.clinicId).toBe('clinic-1')
    expect(result.clinicName).toBe('Clínica PetLife')

    const savedUser = usersRepository.items[0]
    expect(savedUser.passwordHash).toBe('hashed:senhaSegura123')
    expect(savedUser.role).toBe('VET')
    expect(savedUser.clinicId).toBe('clinic-1')
  })

  it('não deve criar veterinário com e-mail duplicado (409 Conflict)', async () => {
    await usersRepository.create({
      name: 'Existente',
      email: 'beatriz@vet.com',
      passwordHash: 'hash',
      role: 'VET',
      clinicId: 'clinic-1',
      crmv: 'CRMV-1',
    })

    await expect(
      sut.execute({
        name: 'Dra. Beatriz',
        email: 'beatriz@vet.com',
        password: 'senhaSegura123',
        crmv: 'CRMV-SP 12345',
        clinicCode: 'PETLIFE-7A2',
      }),
    ).rejects.toMatchObject({
      statusCode: 409,
      message: 'E-mail já cadastrado',
    })
  })

  it('deve lançar 404 quando o código da clínica não for encontrado', async () => {
    vi.mocked(prisma.clinic.findUnique).mockResolvedValue(null)

    await expect(
      sut.execute({
        name: 'Dra. Beatriz',
        email: 'beatriz@vet.com',
        password: 'senhaSegura123',
        crmv: 'CRMV-SP 12345',
        clinicCode: 'INVALID-999',
      }),
    ).rejects.toMatchObject({
      statusCode: 404,
      message: expect.stringContaining('não encontrada'),
    })
  })

  it('deve lançar 400 quando a clínica existir mas não possuir nenhum OWNER ativo', async () => {
    vi.mocked(prisma.clinic.findUnique).mockResolvedValue({
      id: 'clinic-1',
      name: 'Clínica Sem Dono',
      code: 'SEMDONO-111',
      users: [],
    } as any)

    await expect(
      sut.execute({
        name: 'Dra. Beatriz',
        email: 'beatriz@vet.com',
        password: 'senhaSegura123',
        crmv: 'CRMV-SP 12345',
        clinicCode: 'SEMDONO-111',
      }),
    ).rejects.toMatchObject({
      statusCode: 400,
      message: expect.stringContaining('responsável (Owner) ativo'),
    })
  })
})
