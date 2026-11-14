import { AppError } from "../../../shared/errors/app-error";
import { prisma } from "../../../config/prisma";
import { resolveClinicalObservations } from "../../../shared/clinical/routine-guidance-meta";

interface GetTutorPatientHistoryRequest {
  userId: string;
  patientId: string;
}

export class GetTutorPatientHistoryUseCase {
  async execute({ userId, patientId }: GetTutorPatientHistoryRequest) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        tutorAccount: { include: { patients: { select: { id: true } } } },
      },
    });

    if (!user || user.role !== "TUTOR") {
      throw new AppError("Acesso restrito ao portal do tutor.", 403);
    }

    const tutor = user.tutorAccount;
    if (!tutor) {
      throw new AppError("Conta de tutor não encontrada.", 404);
    }

    // Segurança: só pode ver pets que pertencem ao tutor logado
    const ownsPet = tutor.patients.some((p) => p.id === patientId);
    if (!ownsPet) {
      throw new AppError(
        "Você não tem permissão para acessar os dados deste animal.",
        403,
      );
    }

    const patient = await prisma.patient.findUnique({
      where: { id: patientId },
    });

    // Histórico de prontuários (leitura) — sem dados de edição
    const storedRecords = await prisma.clinicalRecord.findMany({
      where: { patientId, finalized: true },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        createdAt: true,
        diagnosis: true,
        prescriptions: true,
        routineGuidance: true,
        observations: true,
        aiSummary: true,
        weightKg: true,
        finalized: true,
        vet: { select: { name: true, crmv: true } },
      },
    });

    // CLI-01 — o tutor nunca deve ver o JSON do formato improvisado. Aqui
    // normalizamos: observations no campo próprio, routineGuidance só texto.
    const clinicalRecords = storedRecords.map(record => {
      const { observations, additionalObservations } = resolveClinicalObservations(record);
      return {
        ...record,
        observations: observations || null,
        routineGuidance: additionalObservations || null,
      };
    });

    // Vacinas
    const vaccinations = await prisma.vaccination.findMany({
      where: { patientId },
      orderBy: { createdAt: "desc" },
    });

    // Exames
    const examFiles = await prisma.examFile.findMany({
      where: { patientId },
      orderBy: { uploadedAt: "desc" },
    });

    return {
      patient,
      clinicalRecords,
      vaccinations,
      examFiles,
    };
  }
}
