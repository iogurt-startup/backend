-- CLI-01 — Migracao de dados (nao altera estrutura).
--
-- Antes desta sprint, as observacoes do atendimento nao tinham campo proprio:
-- o frontend serializava um JSON com o prefixo "__IOUGURT_META__:" e salvava
-- tudo dentro de clinical_records.routine_guidance, que existe para outra
-- finalidade. A coluna "observations" ja foi criada na migracao
-- 20261105232153_sprint4_clinical_records_evolution; aqui so movemos os dados
-- antigos para ela e deixamos routine_guidance com texto limpo.
--
-- Formato legado:
--   routine_guidance = '__IOUGURT_META__:{"observations":"...","additionalObservations":"..."}'
-- Depois:
--   observations     = valor de "observations"
--   routine_guidance = valor de "additionalObservations"
--
-- Linhas com JSON corrompido sao deixadas como estao: o parser do frontend
-- trata esse caso exibindo o texto cru, entao nada desaparece da tela.

DO $$
DECLARE
  meta_prefix CONSTANT text := '__IOUGURT_META__:';
  rec RECORD;
  payload jsonb;
BEGIN
  FOR rec IN
    SELECT id, routine_guidance
    FROM clinical_records
    WHERE left(routine_guidance, length(meta_prefix)) = meta_prefix
  LOOP
    BEGIN
      payload := substring(rec.routine_guidance FROM length(meta_prefix) + 1)::jsonb;
    EXCEPTION
      WHEN others THEN
        CONTINUE;
    END;

    UPDATE clinical_records
    SET
      -- Nao sobrescreve observacao que ja tenha sido gravada no campo novo.
      observations = CASE
        WHEN COALESCE(observations, '') = ''
          THEN NULLIF(COALESCE(payload ->> 'observations', ''), '')
        ELSE observations
      END,
      routine_guidance = NULLIF(COALESCE(payload ->> 'additionalObservations', ''), '')
    WHERE id = rec.id;
  END LOOP;
END $$;
