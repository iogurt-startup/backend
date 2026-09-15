import { Errors } from '../../../core/errors'
import { prisma } from '../../../config/prisma'
import { makeSendFirstAccessInviteUseCase } from '../../auth/useCases/factories/makeSendFirstAccessInviteUseCase'
import type { SendFirstAccessInviteUseCase } from '../../auth/useCases/sendFirstAccessInviteUseCase'

interface ResendInviteRequest {
  tutorId: string
  userClinicId: string
  userRole: string
}

interface ResendInviteResponse {
  message: string
}

export class ResendInviteUseCase {
  constructor(
    private sendFirstAccessInviteUseCase?: SendFirstAccessInviteUseCase,
  ) {}

  async execute({ tutorId, userClinicId, userRole }: ResendInviteRequest): Promise<ResendInviteResponse> {
    if (userRole !== 'VET' && userRole !== 'OWNER') {
      throw Errors.forbidden('Apenas veterinários ou donos da clínica podem reenviar convites.')
    }

    const tutor = await prisma.tutor.findUnique({
      where: { id: tutorId },
      include: { clinic: true },
    })

    if (!tutor) {
      throw Errors.notFound('Tutor não encontrado.')
    }

    if (tutor.clinicId !== userClinicId) {
      throw Errors.forbidden('Acesso negado: Tutor pertence a outra clínica.')
    }

    if (!tutor.userId) {
      throw Errors.badRequest('Este tutor ainda não possui uma conta de acesso criada.')
    }

    // Valida se o tutor já ativou a conta / definiu senha
    const activatedToken = await prisma.passwordToken.findFirst({
      where: {
        userId: tutor.userId,
        type: 'FIRST_ACCESS',
        usedAt: { not: null },
      },
    })

    if (activatedToken) {
      throw Errors.badRequest('O tutor já definiu sua senha e ativou a conta.')
    }

    const sendInviteUseCase =
      this.sendFirstAccessInviteUseCase ?? makeSendFirstAccessInviteUseCase()

    await sendInviteUseCase.execute({
      userId: tutor.userId,
      clinicName: tutor.clinic?.name,
    })

    return {
      message: 'Convite reenviado com sucesso.',
    }
  }
}
