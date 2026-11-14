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

describe("Budgets — PostgreSQL integration tests (EVO-01)", () => {
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

  async function createClinicWithPatient(code: string, cpf: string) {
    const clinic = await prisma.clinic.create({ data: { name: `Clínica ${code}`, code } });
    const tutor = await prisma.tutor.create({
      data: { clinicId: clinic.id, fullName: "Maria Silva", cpf, phone: "11999990000" },
    });
    const patient = await prisma.patient.create({
      data: { clinicId: clinic.id, tutorId: tutor.id, name: "Rex", species: "CANINE" },
    });
    return { clinic, tutor, patient };
  }

  const asOwner = (clinicId: string) => ({ role: ROLE.OWNER, clinicId });

  async function createBudget(data: { clinic: { id: string }; tutor: { id: string }; patient: { id: string } }) {
    const response = await app.injectAuth(
      {
        method: "POST",
        url: `/clinics/${data.clinic.id}/budgets`,
        payload: {
          patientId: data.patient.id,
          tutorId: data.tutor.id,
          items: [
            { description: "Vacina", quantity: 3, unitPrice: 19.99 },
            { description: "Seringa", quantity: 1, unitPrice: 0.1 },
          ],
          discount: 10.5,
          notes: "Pacote de vacinação",
        },
      },
      asOwner(data.clinic.id),
    );
    return response;
  }

  it("persiste orçamento e itens com totais exatos e permite listar e detalhar", async () => {
    const a = await createClinicWithPatient("CLINICA-A", "52998224725");

    const created = await createBudget(a);
    expect(created.statusCode).toBe(201);
    const { budget } = created.json();
    expect(budget).toMatchObject({ status: "DRAFT", discount: 10.5, totalAmount: 49.57 });
    expect(budget.items.map((i: { subtotal: number }) => i.subtotal).sort()).toEqual([0.1, 59.97]);

    const stored = await prisma.budget.findUniqueOrThrow({
      where: { id: budget.id },
      include: { items: true },
    });
    expect(stored.totalAmount.toString()).toBe("49.57");
    expect(stored.discount.toString()).toBe("10.5");
    expect(stored.items).toHaveLength(2);

    const list = await app.injectAuth(
      { method: "GET", url: `/clinics/${a.clinic.id}/budgets?page=1&limit=10` },
      asOwner(a.clinic.id),
    );
    expect(list.statusCode).toBe(200);
    expect(list.json().total).toBe(1);

    const pending = await app.injectAuth(
      { method: "GET", url: `/clinics/${a.clinic.id}/budgets?status=PENDING` },
      asOwner(a.clinic.id),
    );
    expect(pending.json().total).toBe(0);

    const details = await app.injectAuth(
      { method: "GET", url: `/clinics/${a.clinic.id}/budgets/${budget.id}` },
      asOwner(a.clinic.id),
    );
    expect(details.statusCode).toBe(200);
    expect(details.json().budget.patient.id).toBe(a.patient.id);
    expect(details.json().budget.tutor.id).toBe(a.tutor.id);
    expect(details.json().budget.items).toHaveLength(2);
  });

  it("isola orçamentos entre clínicas", async () => {
    const a = await createClinicWithPatient("CLINICA-A", "52998224725");
    const b = await createClinicWithPatient("CLINICA-B", "39053344705");
    const { budget } = (await createBudget(a)).json();

    const otherClinicDetails = await app.injectAuth(
      { method: "GET", url: `/clinics/${b.clinic.id}/budgets/${budget.id}` },
      asOwner(b.clinic.id),
    );
    expect(otherClinicDetails.statusCode).toBe(404);

    const otherClinicUrl = await app.injectAuth(
      { method: "GET", url: `/clinics/${a.clinic.id}/budgets/${budget.id}` },
      asOwner(b.clinic.id),
    );
    expect(otherClinicUrl.statusCode).toBe(403);

    const otherClinicList = await app.injectAuth(
      { method: "GET", url: `/clinics/${b.clinic.id}/budgets` },
      asOwner(b.clinic.id),
    );
    expect(otherClinicList.json().total).toBe(0);

    const crossPatient = await app.injectAuth(
      {
        method: "POST",
        url: `/clinics/${b.clinic.id}/budgets`,
        payload: {
          patientId: a.patient.id,
          tutorId: a.tutor.id,
          items: [{ description: "Consulta", quantity: 1, unitPrice: 100 }],
        },
      },
      asOwner(b.clinic.id),
    );
    expect(crossPatient.statusCode).toBe(404);
  });

  it("bloqueia qualquer alteração de status após APPROVED", async () => {
    const a = await createClinicWithPatient("CLINICA-A", "52998224725");
    const { budget } = (await createBudget(a)).json();
    const patchStatus = (status: string) =>
      app.injectAuth(
        { method: "PATCH", url: `/clinics/${a.clinic.id}/budgets/${budget.id}/status`, payload: { status } },
        asOwner(a.clinic.id),
      );

    expect((await patchStatus("PENDING")).statusCode).toBe(200);
    expect((await patchStatus("APPROVED")).statusCode).toBe(200);
    expect((await patchStatus("REJECTED")).statusCode).toBe(409);
    expect((await patchStatus("DRAFT")).statusCode).toBe(409);

    const stored = await prisma.budget.findUniqueOrThrow({ where: { id: budget.id } });
    expect(stored.status).toBe("APPROVED");
  });

  it("resolve transições concorrentes sem sobrescrever o resultado", async () => {
    const a = await createClinicWithPatient("CLINICA-A", "52998224725");
    const { budget } = (await createBudget(a)).json();
    await prisma.budget.update({ where: { id: budget.id }, data: { status: "PENDING" } });

    const patchStatus = (status: string) =>
      app.injectAuth(
        { method: "PATCH", url: `/clinics/${a.clinic.id}/budgets/${budget.id}/status`, payload: { status } },
        asOwner(a.clinic.id),
      );

    const [approve, reject] = await Promise.all([patchStatus("APPROVED"), patchStatus("REJECTED")]);
    const codes = [approve.statusCode, reject.statusCode];

    expect(codes.filter((code) => code === 200)).toHaveLength(1);
    expect(codes.find((code) => code !== 200)).toBeGreaterThanOrEqual(400);

    const stored = await prisma.budget.findUniqueOrThrow({ where: { id: budget.id } });
    expect(stored.status).toBe(approve.statusCode === 200 ? "APPROVED" : "REJECTED");
  });

  it("filtra a listagem por busca de nome, paciente e intervalo de datas", async () => {
    const a = await createClinicWithPatient("CLINICA-A", "52998224725");
    const { budget } = (await createBudget(a)).json();
    const luna = await prisma.patient.create({
      data: { clinicId: a.clinic.id, tutorId: a.tutor.id, name: "Luna", species: "FELINE" },
    });
    await app.injectAuth(
      {
        method: "POST",
        url: `/clinics/${a.clinic.id}/budgets`,
        payload: {
          patientId: luna.id,
          tutorId: a.tutor.id,
          items: [{ description: "Consulta", quantity: 1, unitPrice: 80 }],
        },
      },
      asOwner(a.clinic.id),
    );
    const list = (query: string) =>
      app.injectAuth({ method: "GET", url: `/clinics/${a.clinic.id}/budgets?${query}` }, asOwner(a.clinic.id));

    const byPatient = (await list("search=luna")).json();
    expect(byPatient.total).toBe(1);
    expect(byPatient.budgets[0].patient.name).toBe("Luna");

    expect((await list("search=maria")).json().total).toBe(2);
    expect((await list(`patientId=${a.patient.id}`)).json()).toMatchObject({
      total: 1,
      budgets: [{ id: budget.id }],
    });

    const now = Date.now();
    const around = await list(
      `from=${new Date(now - 60_000).toISOString()}&to=${new Date(now + 60_000).toISOString()}`,
    );
    expect(around.json().total).toBe(2);

    const tomorrow = await list(`from=${new Date(now + 86_400_000).toISOString()}`);
    expect(tomorrow.json().total).toBe(0);
  });

  it("remove os itens em cascata ao excluir o orçamento", async () => {
    const a = await createClinicWithPatient("CLINICA-A", "52998224725");
    const { budget } = (await createBudget(a)).json();
    expect(await prisma.budgetItem.count({ where: { budgetId: budget.id } })).toBe(2);

    await prisma.budget.delete({ where: { id: budget.id } });

    expect(await prisma.budgetItem.count({ where: { budgetId: budget.id } })).toBe(0);
  });

  it("limpeza de clínica de teste remove orçamentos sem violar FKs", async () => {
    const a = await createClinicWithPatient("CLINICA-A", "52998224725");
    await createBudget(a);

    const response = await app.inject({
      method: "DELETE",
      url: `/test/clinics/${a.clinic.id}`,
      headers: { "x-e2e-secret": process.env.E2E_TEST_SECRET ?? "" },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().deleted.budgets).toBe(1);
    expect(await prisma.budget.count()).toBe(0);
    expect(await prisma.budgetItem.count()).toBe(0);
    expect(await prisma.clinic.count()).toBe(0);
  });
});
