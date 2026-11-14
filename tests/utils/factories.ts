import { Decimal } from '@prisma/client/runtime/library'
import { SEED, FAKE, ROLE } from './constants'

const NOW = new Date('2026-01-15T10:00:00.000Z')
const FUTURE = new Date('2026-12-31T10:00:00.000Z')

type Overrides<T> = Partial<T>

export class Factory {
  static clinic(overrides: Overrides<Record<string, unknown>> = {}) {
    return {
      id: SEED.CLINIC_ID,
      name: 'Clínica IOUGURT',
      cnpj: FAKE.CNPJ_VALID,
      address: 'Rua Vet, 100',
      phone: FAKE.PHONE,
      createdAt: NOW,
      updatedAt: NOW,
      ...overrides,
    }
  }

  static owner(overrides: Overrides<Record<string, unknown>> = {}) {
    return {
      id: SEED.OWNER_ID,
      email: FAKE.EMAIL,
      passwordHash: FAKE.PASSWORD_HASH,
      name: 'Dr. Dono',
      avatarUrl: null,
      crmv: 'CRMV-12345',
      role: ROLE.OWNER,
      clinicId: SEED.CLINIC_ID,
      createdAt: NOW,
      updatedAt: NOW,
      ...overrides,
    }
  }

  static vet(overrides: Overrides<Record<string, unknown>> = {}) {
    return Factory.owner({
      id: SEED.VET_ID,
      email: 'vet@iougurt.com',
      name: 'Dra. Veterinária',
      role: ROLE.VET,
      ...overrides,
    })
  }

  static tutorUser(overrides: Overrides<Record<string, unknown>> = {}) {
    return Factory.owner({
      id: SEED.TUTOR_USER_ID,
      email: 'tutor@iougurt.com',
      name: 'Tutor Pessoa',
      role: ROLE.TUTOR,
      crmv: null,
      ...overrides,
    })
  }

  static tutor(overrides: Overrides<Record<string, unknown>> = {}) {
    return {
      id: SEED.TUTOR_ID,
      userId: null,
      clinicId: SEED.CLINIC_ID,
      fullName: 'Tutor Exemplo',
      cpf: FAKE.CPF_VALID,
      phone: FAKE.PHONE,
      email: 'tutor.contato@iougurt.com',
      address: 'Rua Tutor, 200',
      insurance: null,
      alternateContacts: null,
      createdAt: NOW,
      updatedAt: NOW,
      ...overrides,
    }
  }

  static patient(overrides: Overrides<Record<string, unknown>> = {}) {
    return {
      id: SEED.PATIENT_ID,
      name: 'Rex',
      photoUrl: null,
      birthDate: new Date('2020-05-10T00:00:00.000Z'),
      sex: 'MALE',
      reproductiveCondition: 'NEUTERED',
      coatDescription: 'Caramelo, pelo curto',
      weightKg: new Decimal('12.50'),
      observations: null,
      microchip: null,
      allergies: null,
      species: 'Canino',
      breed: 'SRD',
      tutorId: SEED.TUTOR_ID,
      clinicId: SEED.CLINIC_ID,
      createdAt: NOW,
      updatedAt: NOW,
      deletedAt: null,
      ...overrides,
    }
  }

  static appointment(overrides: Overrides<Record<string, unknown>> = {}) {
    return {
      id: SEED.APPOINTMENT_ID,
      patientId: SEED.PATIENT_ID,
      vetId: SEED.OWNER_ID,
      dateTime: FUTURE,
      endDateTime: new Date(FUTURE.getTime() + 30 * 60_000),
      category: 'OBSERVATION',
      status: 'SCHEDULED',
      observation: null,
      cancelReason: null,
      createdAt: NOW,
      updatedAt: NOW,
      ...overrides,
    }
  }

  static clinicalRecord(overrides: Overrides<Record<string, unknown>> = {}) {
    return {
      id: SEED.RECORD_ID,
      patientId: SEED.PATIENT_ID,
      vetId: SEED.OWNER_ID,
      appointmentId: SEED.APPOINTMENT_ID,
      weightKg: new Decimal('12.50'),
      clinicalNotes: null,
      diagnosis: null,
      pendingDiagnosis: null,
      prescriptions: null,
      breathingNotes: null,
      routineGuidance: null,
      observations: null,
      aiSummary: null,
      finalized: false,
      createdAt: NOW,
      updatedAt: NOW,
      ...overrides,
    }
  }

  static vaccination(overrides: Overrides<Record<string, unknown>> = {}) {
    return {
      id: SEED.VACCINATION_ID,
      patientId: SEED.PATIENT_ID,
      vaccineName: 'V8',
      appliedAt: NOW,
      nextDoseAt: FUTURE,
      status: 'UP_TO_DATE',
      createdAt: NOW,
      ...overrides,
    }
  }

  static examFile(overrides: Overrides<Record<string, unknown>> = {}) {
    return {
      id: SEED.EXAM_ID,
      patientId: SEED.PATIENT_ID,
      clinicalRecordId: null,
      fileName: 'hemograma.pdf',
      fileUrl: '/uploads/hemograma.pdf',
      fileType: 'pdf',
      clinicalType: null,
      uploadedAt: NOW,
      ...overrides,
    }
  }

  static patientPhoto(overrides: Overrides<Record<string, unknown>> = {}) {
    return {
      id: 'photo-1',
      patientId: SEED.PATIENT_ID,
      photoUrl: '/uploads/foto.png',
      description: 'Lesão na pata direita',
      takenAt: NOW,
      createdAt: NOW,
      ...overrides,
    }
  }

  static chronicCondition(overrides: Overrides<Record<string, unknown>> = {}) {
    return {
      id: SEED.CHRONIC_CONDITION_ID,
      patientId: SEED.PATIENT_ID,
      name: 'Diabetes mellitus',
      diagnosedAt: NOW,
      status: 'ACTIVE',
      observations: null,
      createdAt: NOW,
      updatedAt: NOW,
      ...overrides,
    }
  }

  static hospitalization(overrides: Overrides<Record<string, unknown>> = {}) {
    return {
      id: SEED.HOSPITALIZATION_ID,
      clinicId: SEED.CLINIC_ID,
      patientId: SEED.PATIENT_ID,
      admittedByVetId: SEED.OWNER_ID,
      bedIdentifier: 'Baia 03',
      reason: 'Pós-operatório de castração',
      status: 'ADMITTED',
      admittedAt: NOW,
      dischargedAt: null,
      dischargeNotes: null,
      createdAt: NOW,
      updatedAt: NOW,
      ...overrides,
    }
  }

  static hospitalizationEvolution(overrides: Overrides<Record<string, unknown>> = {}) {
    return {
      id: SEED.HOSPITALIZATION_EVOLUTION_ID,
      hospitalizationId: SEED.HOSPITALIZATION_ID,
      recordedByVetId: SEED.OWNER_ID,
      temperature: 38.5,
      heartRate: 90,
      respiratoryRate: 24,
      mucousMembranes: 'Normocoradas',
      notes: 'Aceitou ração, hidratação mantida',
      recordedAt: NOW,
      ...overrides,
    }
  }

  static refreshToken(overrides: Overrides<Record<string, unknown>> = {}) {
    return {
      id: 'refresh-1',
      token: FAKE.REFRESH_TOKEN,
      userId: SEED.OWNER_ID,
      expiresAt: FUTURE,
      createdAt: NOW,
      ...overrides,
    }
  }
}
