import { Errors } from '../../../core/errors'
import type { IPatientsRepository, UpdatePatientDTO, UpdatePatientTutorDTO, PatientWithTutor } from '../repositories/IPatientsRepository'
import type { ITutorsRepository } from '../../tutor/repositories/ITutorsRepository'

interface UpdatePatientInput extends UpdatePatientDTO {
  id: string
  tutor?: UpdatePatientTutorDTO
}

export class UpdatePatientUseCase {
  constructor(
    private patientsRepository: IPatientsRepository,
    private tutorsRepository: ITutorsRepository,
  ) {}

  async execute({ id, tutor, ...patientData }: UpdatePatientInput): Promise<PatientWithTutor> {
    const patient = await this.patientsRepository.findById(id)
    if (!patient) throw Errors.notFound('Paciente não encontrado')

    // Atualizar dados do tutor se fornecidos
    if (tutor) {
      await this.tutorsRepository.update(patient.tutorId, tutor)
    }

    // Retornar paciente com tutor atualizado
    return this.patientsRepository.update(id, patientData)
  }
}
