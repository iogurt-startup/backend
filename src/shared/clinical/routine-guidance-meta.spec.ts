import { describe, it, expect } from 'vitest'
import {
  clinicalObservationsToPlainText,
  parseRoutineGuidanceMeta,
  resolveClinicalObservations,
  routineGuidanceToPlainText,
} from './routine-guidance-meta'

const PREFIX = '__IOUGURT_META__:'

function legacy(observations: string, additionalObservations: string): string {
  return PREFIX + JSON.stringify({ observations, additionalObservations })
}

describe('parseRoutineGuidanceMeta', () => {
  it('devolve campos vazios para null e string vazia', () => {
    expect(parseRoutineGuidanceMeta(null)).toEqual({ observations: '', additionalObservations: '' })
    expect(parseRoutineGuidanceMeta('')).toEqual({ observations: '', additionalObservations: '' })
  })

  it('separa os dois campos do formato improvisado', () => {
    expect(parseRoutineGuidanceMeta(legacy('Tosse seca', 'Retorno em 15 dias'))).toEqual({
      observations: 'Tosse seca',
      additionalObservations: 'Retorno em 15 dias',
    })
  })

  it('trata texto sem prefixo como orientação simples', () => {
    expect(parseRoutineGuidanceMeta('Retorno em 15 dias')).toEqual({
      observations: '',
      additionalObservations: 'Retorno em 15 dias',
    })
  })

  it('preserva o texto cru quando o JSON está corrompido', () => {
    // Não podemos perder o que o veterinário escreveu só porque o payload quebrou.
    const broken = `${PREFIX}{isso nao e json`

    expect(parseRoutineGuidanceMeta(broken)).toEqual({
      observations: '',
      additionalObservations: broken,
    })
  })
})

describe('resolveClinicalObservations', () => {
  it('prefere o campo próprio quando ele está preenchido', () => {
    const resolved = resolveClinicalObservations({
      observations: 'Campo novo',
      routineGuidance: legacy('Campo legado', 'Retorno em 15 dias'),
    })

    expect(resolved.observations).toBe('Campo novo')
    expect(resolved.additionalObservations).toBe('Retorno em 15 dias')
  })

  it('cai para o formato legado quando o campo próprio está vazio', () => {
    // Registro gravado por um cliente antigo, antes da migração.
    const resolved = resolveClinicalObservations({
      observations: null,
      routineGuidance: legacy('Campo legado', 'Retorno em 15 dias'),
    })

    expect(resolved.observations).toBe('Campo legado')
  })

  it('ignora campo próprio só com espaços', () => {
    const resolved = resolveClinicalObservations({
      observations: '   ',
      routineGuidance: legacy('Campo legado', ''),
    })

    expect(resolved.observations).toBe('Campo legado')
  })

  it('funciona com o estado pós-migração, sem JSON nenhum', () => {
    const resolved = resolveClinicalObservations({
      observations: 'Tosse seca',
      routineGuidance: 'Retorno em 15 dias',
    })

    expect(resolved).toEqual({
      observations: 'Tosse seca',
      additionalObservations: 'Retorno em 15 dias',
    })
  })

  it('devolve vazio quando não há nada gravado', () => {
    expect(resolveClinicalObservations({ observations: null, routineGuidance: null })).toEqual({
      observations: '',
      additionalObservations: '',
    })
  })
})

describe('clinicalObservationsToPlainText', () => {
  it('junta as duas seções com linha em branco', () => {
    const text = clinicalObservationsToPlainText({
      observations: 'Tosse seca',
      routineGuidance: 'Retorno em 15 dias',
    })

    expect(text).toBe('Tosse seca\n\nRetorno em 15 dias')
  })

  it('não deixa vazar prefixo nem JSON para o texto impresso', () => {
    const text = clinicalObservationsToPlainText({
      observations: null,
      routineGuidance: legacy('Tosse seca', 'Retorno em 15 dias'),
    })

    expect(text).not.toContain(PREFIX)
    expect(text).not.toContain('{')
    expect(text).toBe('Tosse seca\n\nRetorno em 15 dias')
  })

  it('omite a seção ausente em vez de deixar linhas sobrando', () => {
    expect(
      clinicalObservationsToPlainText({ observations: 'Tosse seca', routineGuidance: null })
    ).toBe('Tosse seca')
  })

  it('devolve string vazia quando não há conteúdo', () => {
    expect(clinicalObservationsToPlainText({ observations: '', routineGuidance: '' })).toBe('')
  })
})

describe('routineGuidanceToPlainText', () => {
  it('segue funcionando para quem só tem o campo legado', () => {
    expect(routineGuidanceToPlainText(legacy('Tosse seca', 'Retorno em 15 dias'))).toBe(
      'Tosse seca\n\nRetorno em 15 dias'
    )
  })
})
