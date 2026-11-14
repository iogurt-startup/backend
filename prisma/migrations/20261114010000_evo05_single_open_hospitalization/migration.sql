-- EVO-05 — Garante no banco que cada paciente tenha no maximo uma internacao
-- em aberto.
--
-- O caso de uso checa antes de criar, mas check-then-write nao e atomico: dois
-- envios simultaneos passam os dois pela checagem e criam duas internacoes
-- abertas para o mesmo animal. O indice parcial abaixo e a garantia real; o
-- repositorio traduz a violacao (P2002) para 409.
--
-- Escrito a mao porque o Prisma nao modela indice parcial com WHERE no schema.
-- Por isso ele tambem nao aparece no `prisma migrate diff`: o schema.prisma
-- nao declara este indice, e nao ha drift a reportar.

CREATE UNIQUE INDEX "hospitalizations_one_open_per_patient"
  ON "hospitalizations" ("patient_id")
  WHERE "status" IN ('ADMITTED', 'CRITICAL');
