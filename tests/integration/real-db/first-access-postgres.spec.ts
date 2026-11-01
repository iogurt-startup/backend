import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";

import { ROLE } from "../../utils/constants";
import { TestApp } from "../../utils/app-builder";
import { prisma } from "@config/prisma";

const TUTOR_EMAIL = "tutor-primeiro-acesso@iougurt.com";
const TUTOR_PASSWORD = "Tutor@123456";
const E2E_HEADERS = { "x-e2e-secret": "test-e2e-secret" };

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

describe("Primeiro acesso do tutor (PostgreSQL real)", () => {
  let app: TestApp;

  beforeEach(async () => {
    await resetDatabase();
    app = await TestApp.build();

    const clinic = await prisma.clinic.create({
      data: {
        name: "Clínica Primeiro Acesso",
        code: "PRIMEIRO-001",
        cnpj: "11444777000161",
        address: "Rua Primeiro Acesso, 1",
        phone: "11999990010",
      },
    });

    await prisma.user.create({
      data: {
        email: TUTOR_EMAIL,
        passwordHash: "hash-inicial-descartavel",
        name: "Tutor Primeiro Acesso",
        role: ROLE.TUTOR,
        clinicId: clinic.id,
      },
    });
  });

  afterEach(async () => {
    await app?.close();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("gera token, define a senha e permite o login do tutor", async () => {
    const tokenRes = await app.inject({
      method: "POST",
      url: "/test/first-access-token",
      headers: E2E_HEADERS,
      payload: { email: TUTOR_EMAIL },
    });
    expect(tokenRes.statusCode).toBe(201);
    const { token } = tokenRes.json<{ token: string }>();
    expect(token).toEqual(expect.any(String));

    const setRes = await app.inject({
      method: "POST",
      url: "/auth/set-password",
      payload: { token, newPassword: TUTOR_PASSWORD },
    });
    expect(setRes.statusCode).toBe(204);

    const loginRes = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: { email: TUTOR_EMAIL, password: TUTOR_PASSWORD },
    });
    expect(loginRes.statusCode).toBe(200);
    expect(loginRes.json<{ accessToken: string }>().accessToken).toEqual(expect.any(String));
  });

  it("não permite reutilizar o token de primeiro acesso", async () => {
    const tokenRes = await app.inject({
      method: "POST",
      url: "/test/first-access-token",
      headers: E2E_HEADERS,
      payload: { email: TUTOR_EMAIL },
    });
    const { token } = tokenRes.json<{ token: string }>();

    const first = await app.inject({
      method: "POST",
      url: "/auth/set-password",
      payload: { token, newPassword: TUTOR_PASSWORD },
    });
    expect(first.statusCode).toBe(204);

    const second = await app.inject({
      method: "POST",
      url: "/auth/set-password",
      payload: { token, newPassword: "Outra@123456" },
    });
    expect(second.statusCode).not.toBe(204);
  });

  it("retorna 404 quando o e-mail não pertence a uma conta de tutor", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/test/first-access-token",
      headers: E2E_HEADERS,
      payload: { email: "inexistente@iougurt.com" },
    });
    expect(res.statusCode).toBe(404);
  });
});
