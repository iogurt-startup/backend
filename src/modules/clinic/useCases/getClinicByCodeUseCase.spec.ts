import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GetClinicByCodeUseCase } from './getClinicByCodeUseCase'
import { prisma } from '@config/prisma'
import { AppError } from '../../../shared/errors/app-error'

vi.mock('@config/prisma', () => ({
  prisma: {
    clinic: {
      findUnique: vi.fn(),
    },
  },
}))

describe('GetClinicByCodeUseCase', () => {
  let sut: GetClinicByCodeUseCase

  beforeEach(() => {
    vi.clearAllMocks()
    sut = new GetClinicByCodeUseCase()
  })

  it('deve retornar os dados da clínica quando o código existe e possui OWNER ativo', async () => {
    vi.mocked(prisma.clinic.findUnique).mockResolvedValue({
      id: 'clinic-1',
      name: 'Pet Clinic',
      code: 'PETCLIN-123',
      users: [{ id: 'owner-1' }],
    } as any)

    const result = await sut.execute('petclin-123')

    expect(prisma.clinic.findUnique).toHaveBeenCalledWith({
      where: { code: 'PETCLIN-123' },
      select: {
        id: true,
        name: true,
        code: true,
        users: {
          where: { role: 'OWNER' },
          select: { id: true },
        },
      },
    })
    expect(result).toEqual({
      id: 'clinic-1',
      name: 'Pet Clinic',
      code: 'PETCLIN-123',
    })
  })

  it('deve lançar AppError 404 quando a clínica não for encontrada', async () => {
    vi.mocked(prisma.clinic.findUnique).mockResolvedValue(null)

    await expect(sut.execute('INVALID-999')).rejects.toMatchObject({
      message: 'Clínica não encontrada.',
      statusCode: 404,
    })
  })

  it('deve lançar AppError 400 quando a clínica existir mas não possuir nenhum OWNER', async () => {
    vi.mocked(prisma.clinic.findUnique).mockResolvedValue({
      id: 'clinic-1',
      name: 'Pet Clinic',
      code: 'PETCLIN-123',
      users: [],
    } as any)

    await expect(sut.execute('PETCLIN-123')).rejects.toMatchObject({
      message: 'Esta clínica não possui um responsável (Owner) ativo cadastrado.',
      statusCode: 400,
    })
  })
})
