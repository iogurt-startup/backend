import { randomUUID } from 'crypto'
import type {
  IPatientPhotosRepository,
  CreatePatientPhotoDTO,
  PatientPhoto,
} from '../IPatientPhotosRepository'

export class InMemoryPatientPhotosRepository implements IPatientPhotosRepository {
  public items: PatientPhoto[] = []

  async create(data: CreatePatientPhotoDTO): Promise<PatientPhoto> {
    const photo: PatientPhoto = {
      id: randomUUID(),
      patientId: data.patientId,
      photoUrl: data.photoUrl,
      description: data.description ?? null,
      takenAt: data.takenAt ?? new Date(),
      createdAt: new Date(),
    }
    this.items.push(photo)
    return photo
  }

  async listByPatient(patientId: string): Promise<PatientPhoto[]> {
    // Ordem cronológica crescente: a galeria é uma linha do tempo da evolução
    // do paciente, então a foto mais antiga vem primeiro.
    return this.items
      .filter(photo => photo.patientId === patientId)
      .sort((a, b) => a.takenAt.getTime() - b.takenAt.getTime())
  }

  async findById(id: string): Promise<PatientPhoto | null> {
    return this.items.find(photo => photo.id === id) ?? null
  }

  async delete(id: string): Promise<void> {
    const index = this.items.findIndex(photo => photo.id === id)
    if (index >= 0) {
      this.items.splice(index, 1)
    }
  }
}
