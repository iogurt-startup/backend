import { prisma } from '@config/prisma'
import { Errors } from '../../../core/errors'

export interface GetClinicByCodeOutput {
  id: string
  name: string
  code: string
}

export class GetClinicByCodeUseCase {
  async execute(code: string): Promise<GetClinicByCodeOutput> {
    const normalizedCode = code.trim().toUpperCase()

    const clinic = await prisma.clinic.findUnique({
      where: { code: normalizedCode },
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

    if (!clinic) {
      throw Errors.notFound('Clínica não encontrada.')
    }

    if (!clinic.users || clinic.users.length === 0) {
      throw Errors.badRequest('Esta clínica não possui um responsável (Owner) ativo cadastrado.')
    }

    return {
      id: clinic.id,
      name: clinic.name,
      code: clinic.code,
    }
  }
}
