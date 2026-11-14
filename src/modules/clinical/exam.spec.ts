import { describe, it, expect, beforeEach } from 'vitest'
import { InMemoryPatientsRepository } from '../patient/repositories/in-memory/InMemoryPatientsRepository'
import { InMemoryExamFilesRepository } from './repositories/in-memory/InMemoryExamFilesRepository'
import { UploadExamFileUseCase } from './useCases/exams/uploadExamFileUseCase'
import { ListPatientExamsUseCase } from './useCases/exams/listPatientExamsUseCase'

describe('Exam Files Use Cases', () => {
  let patientsRepository: InMemoryPatientsRepository
  let examFilesRepository: InMemoryExamFilesRepository
  let uploadUseCase: UploadExamFileUseCase
  let listUseCase: ListPatientExamsUseCase

  beforeEach(() => {
    patientsRepository = new InMemoryPatientsRepository()
    examFilesRepository = new InMemoryExamFilesRepository()

    uploadUseCase = new UploadExamFileUseCase(examFilesRepository, patientsRepository)
    listUseCase = new ListPatientExamsUseCase(examFilesRepository)
  })

  it('should upload an exam file without clinicalType (legacy)', async () => {
    const patient = await patientsRepository.create({
      name: 'Luna',
      species: 'FELINE',
      sex: 'FEMALE',
      tutorId: 'tutor-xyz',
      clinicId: 'clinic-1',
    })

    const file = await uploadUseCase.execute({
      patientId: patient.id,
      clinicId: 'clinic-1',
      fileName: 'exam_result.pdf',
      fileUrl: '/uploads/abc-def.pdf',
      fileType: 'pdf',
    })

    expect(file.id).toBeDefined()
    expect(file.fileUrl).toBe('/uploads/abc-def.pdf')
    expect(file.clinicalType).toBeNull()
  })

  it('should upload an exam file with clinicalType', async () => {
    const patient = await patientsRepository.create({
      name: 'Luna',
      species: 'FELINE',
      sex: 'FEMALE',
      tutorId: 'tutor-xyz',
      clinicId: 'clinic-1',
    })

    const file = await uploadUseCase.execute({
      patientId: patient.id,
      clinicId: 'clinic-1',
      fileName: 'hemograma.pdf',
      fileUrl: '/uploads/hemograma.pdf',
      fileType: 'pdf',
      clinicalType: 'HEMOGRAMA',
    })

    expect(file.id).toBeDefined()
    expect(file.fileUrl).toBe('/uploads/hemograma.pdf')
    expect(file.clinicalType).toBe('HEMOGRAMA')
  })

  it('should not allow upload for non-existent patient', async () => {
    await expect(uploadUseCase.execute({
      patientId: 'invalid-id',
      clinicId: 'clinic-1',
      fileName: 'image.png',
      fileUrl: '/uploads/img.png',
      fileType: 'image',
    })).rejects.toThrow('Paciente não encontrado')
  })

  it('should list all patient exam files and filter by clinicalType', async () => {
    const patient = await patientsRepository.create({
      name: 'Luna',
      species: 'FELINE',
      sex: 'FEMALE',
      tutorId: 'tutor-xyz',
      clinicId: 'clinic-1',
    })

    await uploadUseCase.execute({
      patientId: patient.id,
      clinicId: 'clinic-1',
      fileName: 'blood_test.pdf',
      fileUrl: '/uploads/blood.pdf',
      fileType: 'pdf',
      clinicalType: 'HEMOGRAMA',
    })

    await uploadUseCase.execute({
      patientId: patient.id,
      clinicId: 'clinic-1',
      fileName: 'xray.png',
      fileUrl: '/uploads/xray.png',
      fileType: 'image',
      clinicalType: 'RAIO_X',
    })

    await uploadUseCase.execute({
      patientId: patient.id,
      clinicId: 'clinic-1',
      fileName: 'legacy.pdf',
      fileUrl: '/uploads/legacy.pdf',
      fileType: 'pdf',
    })

    // List all
    const allExams = await listUseCase.execute({ patientId: patient.id })
    expect(allExams.length).toBe(3)

    // Filter by HEMOGRAMA
    const hemogramas = await listUseCase.execute({ patientId: patient.id, clinicalType: 'HEMOGRAMA' })
    expect(hemogramas.length).toBe(1)
    expect(hemogramas[0].fileName).toBe('blood_test.pdf')
    expect(hemogramas[0].clinicalType).toBe('HEMOGRAMA')

    // Filter by RAIO_X
    const raiosX = await listUseCase.execute({ patientId: patient.id, clinicalType: 'RAIO_X' })
    expect(raiosX.length).toBe(1)
    expect(raiosX[0].fileName).toBe('xray.png')
    expect(raiosX[0].clinicalType).toBe('RAIO_X')

    // Filter by ULTRASSOM (none)
    const ultrassons = await listUseCase.execute({ patientId: patient.id, clinicalType: 'ULTRASSOM' })
    expect(ultrassons.length).toBe(0)
  })
})
