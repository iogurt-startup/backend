import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ResendInviteUseCase } from './resendInviteUseCase'
import { prisma } from '../../../config/prisma'
import { SendFirstAccessInviteUseCase } from '../../auth/useCases/sendFirstAccessInviteUseCase'

vi.mock('../../../config/prisma', () => ({
  prisma: {
    tutor: {
      findUnique: vi.fn(),
    },
    passwordToken: {
      findFirst: vi.fn(),
    },
  },
}))

describe('ResendInviteUseCase', () => {
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

  it('deve reenviar o convite de primeiro acesso com sucesso', async () => {
    vi.mocked(prisma.tutor.findUnique).mockResolvedValue({
      id: 'tutor-1',
      userId: 'user-tutor-1',
      clinicId: 'clinic-1',
      clinic: { id: 'clinic-1', name: 'Clínica Iougurt' },
    } as never)

    vi.mocked(prisma.passwordToken.findFirst).mockResolvedValue(null)

    const sut = new ResendInviteUseCase(sendInviteMock)
    const result = await sut.execute({
      tutorId: 'tutor-1',
      userClinicId: 'clinic-1',
      userRole: 'VET',
    })

    expect(result).toEqual({ message: 'Convite reenviado com sucesso.' })
    expect(sendInviteMock.execute).toHaveBeenCalledWith({
      userId: 'user-tutor-1',
      clinicName: 'Clínica Iougurt',
    })
  })

  it('deve rejeitar se o papel do usuário não for VET ou OWNER', async () => {
    const sut = new ResendInviteUseCase(sendInviteMock)
    await expect(
      sut.execute({ tutorId: 'tutor-1', userClinicId: 'clinic-1', userRole: 'TUTOR' }),
    ).rejects.toMatchObject({
      statusCode: 403,
      message: 'Apenas veterinários ou donos da clínica podem reenviar convites.',
    })
  })

  it('deve lançar erro 404 se o tutor não for encontrado', async () => {
    vi.mocked(prisma.tutor.findUnique).mockResolvedValue(null)

    const sut = new ResendInviteUseCase(sendInviteMock)
    await expect(
      sut.execute({ tutorId: 'tutor-fake', userClinicId: 'clinic-1', userRole: 'VET' }),
    ).rejects.toMatchObject({
      statusCode: 404,
      message: 'Tutor não encontrado.',
    })
  })

  it('deve lançar erro 403 se o tutor for de outra clínica', async () => {
    vi.mocked(prisma.tutor.findUnique).mockResolvedValue({
      id: 'tutor-1',
      clinicId: 'outra-clinica',
    } as never)

    const sut = new ResendInviteUseCase(sendInviteMock)
    await expect(
      sut.execute({ tutorId: 'tutor-1', userClinicId: 'clinic-1', userRole: 'VET' }),
    ).rejects.toMatchObject({
      statusCode: 403,
      message: 'Acesso negado: Tutor pertence a outra clínica.',
    })
  })

  it('deve lançar erro 400 se o tutor ainda não tiver conta criada', async () => {
    vi.mocked(prisma.tutor.findUnique).mockResolvedValue({
      id: 'tutor-1',
      userId: null,
      clinicId: 'clinic-1',
    } as never)

    const sut = new ResendInviteUseCase(sendInviteMock)
    await expect(
      sut.execute({ tutorId: 'tutor-1', userClinicId: 'clinic-1', userRole: 'VET' }),
    ).rejects.toMatchObject({
      statusCode: 400,
      message: 'Este tutor ainda não possui uma conta de acesso criada.',
    })
  })

  it('deve lançar erro 400 se o tutor já tiver ativado a conta/definido senha', async () => {
    vi.mocked(prisma.tutor.findUnique).mockResolvedValue({
      id: 'tutor-1',
      userId: 'user-tutor-1',
      clinicId: 'clinic-1',
    } as never)

    vi.mocked(prisma.passwordToken.findFirst).mockResolvedValue({
      id: 'token-usado',
      usedAt: new Date(),
    } as never)

    const sut = new ResendInviteUseCase(sendInviteMock)
    await expect(
      sut.execute({ tutorId: 'tutor-1', userClinicId: 'clinic-1', userRole: 'VET' }),
    ).rejects.toMatchObject({
      statusCode: 400,
      message: 'O tutor já definiu sua senha e ativou a conta.',
    })
  })
})
