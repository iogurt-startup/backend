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

describe("Fluxo de Cadastro de Veterinário com Banco PostgreSQL Real (QA-04)", () => {
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

  it("executa o ciclo completo: cadastro de Owner, consulta da sigla, cadastro de Vet e login do Vet", async () => {
    // 1. Cadastra um Owner criando a clínica e gerando o código único
    const ownerRes = await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: {
        name: "Dr. Dono Real",
        email: "dono.real@clinica.com",
        password: "senhaSegura123",
        clinicName: "Hospital Pet Real",
      },
    });

    expect(ownerRes.statusCode).toBe(201);
    const ownerData = ownerRes.json().user;
    expect(ownerData.clinicCode).toBeDefined();
    const clinicCode = ownerData.clinicCode;

    // 2. Consulta pública da clínica pela sigla gerada
    const clinicByCodeRes = await app.inject({
      method: "GET",
      url: `/clinics/code/${clinicCode}`,
    });

    expect(clinicByCodeRes.statusCode).toBe(200);
    expect(clinicByCodeRes.json().clinic).toEqual({
      id: ownerData.clinicId,
      name: "Hospital Pet Real",
      code: clinicCode,
    });

    // 3. Autocadastro de um Médico Veterinário com CRMV e a sigla da clínica
    const vetRes = await app.inject({
      method: "POST",
      url: "/auth/register/vet",
      payload: {
        name: "Dra. Camila Real",
        email: "camila.vet@clinica.com",
        password: "senhaVetSegura123",
        crmv: "CRMV-DF 99887",
        clinicCode: clinicCode,
      },
    });

    expect(vetRes.statusCode).toBe(201);
    const vetData = vetRes.json().user;
    expect(vetData.role).toBe(ROLE.VET);
    expect(vetData.crmv).toBe("CRMV-DF 99887");
    expect(vetData.clinicId).toBe(ownerData.clinicId);

    // 4. Veterinário realiza login com e-mail e senha
    const loginRes = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: {
        email: "camila.vet@clinica.com",
        password: "senhaVetSegura123",
      },
    });

    expect(loginRes.statusCode).toBe(200);
    const loginData = loginRes.json();
    expect(loginData.accessToken).toBeDefined();
    expect(loginData.user.role).toBe(ROLE.VET);

    // 5. Cadastra um segundo veterinário na mesma clínica
    const vet2Res = await app.inject({
      method: "POST",
      url: "/auth/register/vet",
      payload: {
        name: "Dr. Lucas Real",
        email: "lucas.vet@clinica.com",
        password: "senhaVetSegura123",
        crmv: "CRMV-DF 66554",
        clinicCode: clinicCode.toLowerCase(), // testa case-insensitive
      },
    });

    expect(vet2Res.statusCode).toBe(201);
    expect(vet2Res.json().user.clinicId).toBe(ownerData.clinicId);

    // 6. Verifica no banco real que a clínica possui 1 OWNER e 2 VETs
    const usersInClinic = await prisma.user.findMany({
      where: { clinicId: ownerData.clinicId },
      select: { email: true, role: true },
    });

    expect(usersInClinic).toHaveLength(3);
    expect(usersInClinic.filter((u) => u.role === "OWNER")).toHaveLength(1);
    expect(usersInClinic.filter((u) => u.role === "VET")).toHaveLength(2);
  });

  it("impede cadastro de veterinário quando a clínica é inexistente ou não possui owner", async () => {
    // Código não existente
    const notFoundRes = await app.inject({
      method: "POST",
      url: "/auth/register/vet",
      payload: {
        name: "Dr. Fantasma",
        email: "fantasma@vet.com",
        password: "senhaSegura123",
        crmv: "CRMV-DF 00000",
        clinicCode: "FANTASMA-999",
      },
    });
    expect(notFoundRes.statusCode).toBe(404);

    // Cria clínica órfã sem nenhum OWNER no banco real
    const orphanClinic = await prisma.clinic.create({
      data: {
        name: "Clínica Órfã",
        code: "ORFA-888",
      },
    });

    const orphanRes = await app.inject({
      method: "POST",
      url: "/auth/register/vet",
      payload: {
        name: "Dr. Órfão",
        email: "orfao@vet.com",
        password: "senhaSegura123",
        crmv: "CRMV-DF 11111",
        clinicCode: orphanClinic.code,
      },
    });

    expect(orphanRes.statusCode).toBe(400);
    expect(orphanRes.json().error).toContain("responsável (Owner) ativo");
  });
});
