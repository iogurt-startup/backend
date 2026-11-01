import { prisma } from '@config/prisma'
import { Errors } from '../../../core/errors'
import type { IHashProvider } from '../providers/IHashProvider'
import type { Role } from '@prisma/client'
import { generateClinicCode } from '../../../shared/utils/generateClinicCode'

interface CreateOwnerInput {
  email: string
  password: string
  name: string
  clinicName: string
  clinicCnpj?: string
  clinicAddress?: string
  clinicPhone?: string
  crmv?: string
}

interface CreateOwnerOutput {
  id: string
  email: string
  name: string
  role: string
  clinicId: string
  clinicName: string
  clinicCode: string
}

export class CreateOwnerUseCase {
  constructor(private hashProvider: IHashProvider) {}

  async execute(input: CreateOwnerInput): Promise<CreateOwnerOutput> {
    const exists = await prisma.user.findUnique({ where: { email: input.email.toLowerCase().trim() } })
    if (exists) throw Errors.conflict('E-mail já cadastrado')

    const passwordHash = await this.hashProvider.hash(input.password)

    // Cria clínica + owner numa transação atômica com tentativa de retry em caso de colisão de código
    let attempts = 0
    while (attempts < 5) {
      attempts++
      const clinicCode = generateClinicCode(input.clinicName)
      try {
        const result = await prisma.$transaction(async (tx) => {
          const clinic = await tx.clinic.create({
            data: {
              name: input.clinicName.trim(),
              code: clinicCode,
              cnpj: input.clinicCnpj?.trim() || null,
              address: input.clinicAddress?.trim() || null,
              phone: input.clinicPhone?.trim() || null,
            },
          })

          const user = await tx.user.create({
            data: {
              email: input.email.toLowerCase().trim(),
              passwordHash,
              name: input.name.trim(),
              role: 'OWNER' as Role,
              clinicId: clinic.id,
              crmv: input.crmv?.trim() || null,
            },
          })

          return { user, clinic }
        })

        return {
          id: result.user.id,
          email: result.user.email,
          name: result.user.name,
          role: result.user.role,
          clinicId: result.clinic.id,
          clinicName: result.clinic.name,
          clinicCode: result.clinic.code,
        }
      } catch (err: any) {
        // Se for erro de violação de unicidade da sigla da clínica, tenta novamente gerando novo sufixo
        if (err?.code === 'P2002' && err?.meta?.target?.includes('code') && attempts < 5) {
          continue
        }
        throw err
      }
    }

    throw Errors.internal('Falha ao gerar código único para a clínica.')
  }
}
