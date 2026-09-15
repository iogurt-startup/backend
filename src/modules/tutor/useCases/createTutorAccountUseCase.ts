import { randomBytes } from 'crypto'
import bcrypt from 'bcryptjs'
import { Errors } from '../../../core/errors'
import { prisma } from '../../../config/prisma'
import { makeSendFirstAccessInviteUseCase } from '../../auth/useCases/factories/makeSendFirstAccessInviteUseCase'
import type { SendFirstAccessInviteUseCase } from '../../auth/useCases/sendFirstAccessInviteUseCase'

interface CreateTutorAccountRequest {
  tutorId: string   // ID do tutor já cadastrado
  email: string     // email de login que o vet define
}

interface CreateTutorAccountResponse {
  userId: string
  email: string
}

export class CreateTutorAccountUseCase {
  constructor(
    private sendFirstAccessInviteUseCase?: SendFirstAccessInviteUseCase,
  ) {}

  async execute({ tutorId, email }: CreateTutorAccountRequest): Promise<CreateTutorAccountResponse> {
    if (!email || !email.trim()) {
      throw Errors.badRequest('E-mail é obrigatório para criar a conta de acesso.')
    }

    const tutor = await prisma.tutor.findUnique({
      where: { id: tutorId },
      include: { clinic: true },
    })

    if (!tutor) {
      throw Errors.notFound('Tutor não encontrado.')
    }

    if (tutor.userId) {
      throw Errors.badRequest('Este tutor já possui uma conta de acesso ao portal.')
    }

    const existingUser = await prisma.user.findUnique({ where: { email } })
    if (existingUser) {
      throw Errors.badRequest('Este e-mail já está em uso.')
    }

    // Gera um hash seguro para a senha inicial (a senha definitiva será definida no Primeiro Acesso)
    const randomPassword = randomBytes(16).toString('hex')
    const passwordHash = await bcrypt.hash(randomPassword, 8)

    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        name: tutor.fullName,
        role: 'TUTOR',
        clinicId: tutor.clinicId,
        tutorAccount: {
          connect: { id: tutorId },
        },
      },
    })

    // Sincroniza o e-mail no cadastro do Tutor se não estiver preenchido
    if (!tutor.email) {
      await prisma.tutor.update({
        where: { id: tutorId },
        data: { email },
      })
    }

    const sendInviteUseCase =
      this.sendFirstAccessInviteUseCase ?? makeSendFirstAccessInviteUseCase()

    await sendInviteUseCase.execute({
      userId: user.id,
      clinicName: tutor.clinic?.name,
    })

    return {
      userId: user.id,
      email: user.email,
    }
  }
}
