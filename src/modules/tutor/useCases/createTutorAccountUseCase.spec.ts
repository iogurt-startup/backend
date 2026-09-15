import { describe, it, expect, vi, beforeEach } from 'vitest'
import { CreateTutorAccountUseCase } from './createTutorAccountUseCase'
import { prisma } from '../../../config/prisma'
import { SendFirstAccessInviteUseCase } from '../../auth/useCases/sendFirstAccessInviteUseCase'

vi.mock('../../../config/prisma', () => ({
  prisma: {
    tutor: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
  },
}))

describe('CreateTutorAccountUseCase', () => {
  let sendInviteMock: SendFirstAccessInviteUseCase

  beforeEach(() => {
    vi.clearAllMocks()
    sendInviteMock = {
      execute: vi.fn().mockResolvedValue({
        token: 'fake-jwt-token',
        firstAccessUrl: 'http://localhost:3000/primeiro-acesso?token=fake-jwt-token',
      }),
    } as unknown as SendFirstAccessInviteUseCase
  })

  it('deve criar conta de tutor e disparar o convite de primeiro acesso com sucesso', async () => {
    const tutorId = 'tutor-1'
    const email = 'tutor.maria@exemplo.com'

    vi.mocked(prisma.tutor.findUnique).mockResolvedValue({
      id: tutorId,
      fullName: 'Maria Silva',
      cpf: '52998224725',
      phone: '61999990000',
      email: null,
      userId: null,
      clinicId: 'clinic-1',
      clinic: { id: 'clinic-1', name: 'Clínica Vet' },
    } as never)

    vi.mocked(prisma.user.findUnique).mockResolvedValue(null)
    vi.mocked(prisma.user.create).mockResolvedValue({
      id: 'user-1',
      email,
      name: 'Maria Silva',
      role: 'TUTOR',
      clinicId: 'clinic-1',
    } as never)

    const sut = new CreateTutorAccountUseCase(sendInviteMock)
    const result = await sut.execute({ tutorId, email })

    expect(result).toEqual({
      userId: 'user-1',
      email,
    })
    expect(result).not.toHaveProperty('temporaryPassword')

    expect(prisma.tutor.update).toHaveBeenCalledWith({
      where: { id: tutorId },
      data: { email },
    })

    expect(sendInviteMock.execute).toHaveBeenCalledWith({
      userId: 'user-1',
      clinicName: 'Clínica Vet',
    })
  })

  it('deve rejeitar se o e-mail não for informado', async () => {
    const sut = new CreateTutorAccountUseCase(sendInviteMock)
    await expect(sut.execute({ tutorId: 'tutor-1', email: '' })).rejects.toMatchObject({
      statusCode: 400,
      message: 'E-mail é obrigatório para criar a conta de acesso.',
    })
  })

  it('deve lançar erro 404 se tutor não for encontrado', async () => {
    vi.mocked(prisma.tutor.findUnique).mockResolvedValue(null)

    const sut = new CreateTutorAccountUseCase(sendInviteMock)
    await expect(
      sut.execute({ tutorId: 'tutor-inexistente', email: 'tutor@exemplo.com' }),
    ).rejects.toMatchObject({
      statusCode: 404,
      message: 'Tutor não encontrado.',
    })
  })

  it('deve lançar erro 400 se o tutor já possuir conta', async () => {
    vi.mocked(prisma.tutor.findUnique).mockResolvedValue({
      id: 'tutor-1',
      userId: 'user-existente',
    } as never)

    const sut = new CreateTutorAccountUseCase(sendInviteMock)
    await expect(
      sut.execute({ tutorId: 'tutor-1', email: 'tutor@exemplo.com' }),
    ).rejects.toMatchObject({
      statusCode: 400,
      message: 'Este tutor já possui uma conta de acesso ao portal.',
    })
  })

  it('deve lançar erro 400 se o e-mail já estiver em uso', async () => {
    vi.mocked(prisma.tutor.findUnique).mockResolvedValue({
      id: 'tutor-1',
      userId: null,
    } as never)
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ id: 'outro-user' } as never)

    const sut = new CreateTutorAccountUseCase(sendInviteMock)
    await expect(
      sut.execute({ tutorId: 'tutor-1', email: 'existente@exemplo.com' }),
    ).rejects.toMatchObject({
      statusCode: 400,
      message: 'Este e-mail já está em uso.',
    })
  })
})
