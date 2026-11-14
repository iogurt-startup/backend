import type {
  HospitalizationWithPatient,
  IHospitalizationsRepository,
} from '../../repositories/IHospitalizationsRepository'

interface ListActiveHospitalizationsRequest {
  clinicId: string
}

export class ListActiveHospitalizationsUseCase {
  constructor(private hospitalizationsRepository: IHospitalizationsRepository) {}

  async execute({
    clinicId,
  }: ListActiveHospitalizationsRequest): Promise<HospitalizationWithPatient[]> {
    const hospitalizations = await this.hospitalizationsRepository.listActiveByClinic(clinicId)

    // Pacientes críticos primeiro — é o que o plantão precisa ver no topo do
    // painel. Dentro do mesmo status mantemos a ordem cronológica que o
    // repositório já devolveu, então quem está internado há mais tempo vem
    // antes. `sort` do V8 é estável, então essa ordem não se perde.
    return [...hospitalizations].sort((a, b) => rank(b.status) - rank(a.status))
  }
}

function rank(status: string) {
  return status === 'CRITICAL' ? 1 : 0
}
