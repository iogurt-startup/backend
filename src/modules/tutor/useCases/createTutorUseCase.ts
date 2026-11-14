import { Errors } from '../../../core/errors'
import type { CreateTutorDTO, ITutorsRepository } from '../repositories/ITutorsRepository'
import type { Tutor } from '@prisma/client'

type CreateTutorInput = CreateTutorDTO

export class CreateTutorUseCase {
  constructor(private tutorsRepository: ITutorsRepository) {}

  async execute(input: CreateTutorInput): Promise<Tutor> {
    const existingCpf = await this.tutorsRepository.findByCpf(input.cpf, input.clinicId)
    if (existingCpf) throw Errors.conflict('CPF já cadastrado nesta clínica')

    if (input.email) {
      const existingEmail = await this.tutorsRepository.findByEmail(input.email, input.clinicId)
      if (existingEmail) throw Errors.conflict('E-mail já cadastrado nesta clínica')
    }

    return this.tutorsRepository.create(input)
  }
}
