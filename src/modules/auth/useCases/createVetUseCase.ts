import { prisma } from '@config/prisma'
import { Errors } from '../../../core/errors'
import type { IUsersRepository } from '../repositories/IUsersRepository'
import type { IHashProvider } from '../providers/IHashProvider'

export interface CreateVetInput {
  email: string
  password: string
  name: string
  crmv: string
  clinicCode: string
}

export interface CreateVetOutput {
  id: string
  email: string
  name: string
  role: string
  crmv: string | null
  clinicId: string
  clinicName: string
}

export class CreateVetUseCase {
  constructor(
    private usersRepository: IUsersRepository,
    private hashProvider: IHashProvider,
  ) {}

  async execute(input: CreateVetInput): Promise<CreateVetOutput> {
    const exists = await this.usersRepository.existsByEmail(input.email.toLowerCase().trim())
    if (exists) throw Errors.conflict('E-mail já cadastrado')

    const normalizedCode = input.clinicCode.trim().toUpperCase()
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
      throw Errors.notFound('Clínica não encontrada para o código informado.')
    }

    if (!clinic.users || clinic.users.length === 0) {
      throw Errors.badRequest('Esta clínica não possui um responsável (Owner) ativo cadastrado.')
    }

    const passwordHash = await this.hashProvider.hash(input.password)
    const user = await this.usersRepository.create({
      email: input.email.toLowerCase().trim(),
      passwordHash,
      name: input.name.trim(),
      role: 'VET',
      clinicId: clinic.id,
      crmv: input.crmv.trim(),
    })

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      crmv: user.crmv,
      clinicId: clinic.id,
      clinicName: clinic.name,
    }
  }
}
