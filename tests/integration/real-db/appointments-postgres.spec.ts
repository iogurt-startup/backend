import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";

import { ROLE } from "../../utils/constants";
import { TestApp } from "../../utils/app-builder";
import { prisma } from "@config/prisma";

async function resetDatabase() {
  const dbName = new URL(process.env.DATABASE_URL ?? "").pathname.slice(1);
  if (!dbName.includes("test")) {
    throw new Error(
      `Recusando limpar o banco "${dbName}": use um banco de teste (nome contendo "test").`,
    );
  }

  const tables = await prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables
    WHERE schemaname = current_schema() AND tablename <> '_prisma_migrations'
  `;
  if (tables.length === 0) return;

  const list = tables.map(({ tablename }) => `"${tablename}"`).join(", ");
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE`);
}

describe("PostgreSQL integration tests", () => {
  let app: TestApp;

  beforeEach(async () => {
    await resetDatabase();
    app = await TestApp.build();
  });

  afterEach(async () => {
    await app?.close();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  async function createClinicData() {
    const clinicA = await prisma.clinic.create({
      data: {
        name: "Clínica A",
        code: "CLINICA-001",
        cnpj: "11444777000161",
        address: "Rua A, 100",
        phone: "11999990000",
      },
    });

    const clinicB = await prisma.clinic.create({
      data: {
        name: "Clínica B",
        code: "CLINICB-002",
        cnpj: "85424588000104",
        address: "Rua B, 200",
        phone: "11999990001",
      },
    });

    const ownerA = await prisma.user.create({
      data: {
        email: "owner-a@iougurt.com",
        passwordHash: "hash-owner-a",
        name: "Dono A",
        role: ROLE.OWNER,
        clinicId: clinicA.id,
      },
    });

    const vetA = await prisma.user.create({
      data: {
        email: "vet-a@iougurt.com",
        passwordHash: "hash-vet-a",
        name: "Veterinário A",
        role: ROLE.VET,
        clinicId: clinicA.id,
      },
    });

    const vetB = await prisma.user.create({
      data: {
        email: "vet-b@iougurt.com",
        passwordHash: "hash-vet-b",
        name: "Veterinário B",
        role: ROLE.VET,
        clinicId: clinicB.id,
      },
    });

    const tutorA = await prisma.tutor.create({
      data: {
        clinicId: clinicA.id,
        fullName: "Tutor A",
        cpf: "52998224725",
        phone: "11999990002",
        email: "tutor-a@iougurt.com",
      },
    });

    const tutorB = await prisma.tutor.create({
      data: {
        clinicId: clinicB.id,
        fullName: "Tutor B",
        cpf: "07036912086",
        phone: "11999990003",
        email: "tutor-b@iougurt.com",
      },
    });

    const patientA = await prisma.patient.create({
      data: {
        name: "Rex",
        species: "Canino",
        breed: "SRD",
        tutorId: tutorA.id,
        clinicId: clinicA.id,
      },
    });

    const patientB = await prisma.patient.create({
      data: {
        name: "Luna",
        species: "Felino",
        breed: "Persa",
        tutorId: tutorB.id,
        clinicId: clinicB.id,
      },
    });

    return { clinicA, clinicB, ownerA, vetA, vetB, patientA, patientB };
  }

  it("cria e reagenda uma consulta na mesma clínica", async () => {
    const { clinicA, ownerA, vetA, patientA } = await createClinicData();

    const createResponse = await app.injectAuth(
      {
        method: "POST",
        url: "/appointments",
        payload: {
          patientId: patientA.id,
          vetId: vetA.id,
          dateTime: "2099-06-01T10:00:00.000Z",
          endDateTime: "2099-06-01T10:30:00.000Z",
          category: "OBSERVATION",
          observation: "Consulta de rotina",
        },
      },
      { userId: ownerA.id, role: ROLE.OWNER, clinicId: clinicA.id },
    );

    expect(createResponse.statusCode).toBe(201);
    const created = createResponse.json().appointment;
    expect(created.patientId).toBe(patientA.id);
    expect(created.vetId).toBe(vetA.id);

    const rescheduleResponse = await app.injectAuth(
      {
        method: "PATCH",
        url: `/appointments/${created.id}/reschedule`,
        payload: {
          dateTime: "2099-06-02T11:00:00.000Z",
          endDateTime: "2099-06-02T11:30:00.000Z",
        },
      },
      { userId: ownerA.id, role: ROLE.OWNER, clinicId: clinicA.id },
    );

    expect(rescheduleResponse.statusCode).toBe(200);
    expect(rescheduleResponse.json().dateTime).toBe("2099-06-02T11:00:00.000Z");

    const appointmentInDb = await prisma.appointment.findUnique({
      where: { id: created.id },
    });
    expect(appointmentInDb?.dateTime.toISOString()).toBe(
      "2099-06-02T11:00:00.000Z",
    );
  });

  it("rejeita criação de consulta para paciente de outra clínica", async () => {
    const { clinicA, clinicB, ownerA, vetA, patientB } =
      await createClinicData();

    const response = await app.injectAuth(
      {
        method: "POST",
        url: "/appointments",
        payload: {
          patientId: patientB.id,
          vetId: vetA.id,
          dateTime: "2099-06-01T10:00:00.000Z",
          endDateTime: "2099-06-01T10:30:00.000Z",
          category: "OBSERVATION",
        },
      },
      { userId: ownerA.id, role: ROLE.OWNER, clinicId: clinicA.id },
    );

    expect(response.statusCode).toBe(404);
    expect(await prisma.appointment.count()).toBe(0);
    expect(patientB.clinicId).toBe(clinicB.id);
  });

  it("impede duplicidade por clínica e mantém a restrição única do tutor", async () => {
    const { clinicA, clinicB } = await createClinicData();

    await prisma.tutor.create({
      data: {
        clinicId: clinicA.id,
        fullName: "Tutor Duplicado",
        cpf: "11144477735",
        phone: "11999990004",
        email: "duplicado-a@iougurt.com",
      },
    });

    await expect(
      prisma.tutor.create({
        data: {
          clinicId: clinicA.id,
          fullName: "Tutor Duplicado 2",
          cpf: "11144477735",
          phone: "11999990005",
          email: "duplicado-b@iougurt.com",
        },
      }),
    ).rejects.toMatchObject({ code: "P2002" });

    const tutorCrossClinic = await prisma.tutor.create({
      data: {
        clinicId: clinicB.id,
        fullName: "Tutor Duplicado 3",
        cpf: "11144477735",
        phone: "11999990006",
        email: "duplicado-c@iougurt.com",
      },
    });

    expect(tutorCrossClinic.clinicId).toBe(clinicB.id);
  });

  it("faz rollback de transação quando a criação falha por constraint", async () => {
    const { clinicA } = await createClinicData();

    const beforeCount = await prisma.user.count({
      where: { clinicId: clinicA.id },
    });

    await expect(
      prisma.$transaction(async (tx) => {
        await tx.user.create({
          data: {
            email: "owner-rollback@iougurt.com",
            passwordHash: "hash-rollback-1",
            name: "Dono Rollback",
            role: ROLE.OWNER,
            clinicId: clinicA.id,
          },
        });

        await tx.user.create({
          data: {
            email: "owner-rollback@iougurt.com",
            passwordHash: "hash-rollback-2",
            name: "Dono Rollback Duplicate",
            role: ROLE.OWNER,
            clinicId: clinicA.id,
          },
        });
      }),
    ).rejects.toMatchObject({ code: "P2002" });

    const afterCount = await prisma.user.count({
      where: { clinicId: clinicA.id },
    });
    expect(afterCount).toBe(beforeCount);
  });
});
