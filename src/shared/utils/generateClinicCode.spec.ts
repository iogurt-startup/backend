import { describe, it, expect } from 'vitest'
import { generateClinicCode } from './generateClinicCode'

describe('generateClinicCode utility', () => {
  it('should generate a code with prefix and 5-char random suffix', () => {
    const code = generateClinicCode('PetLife Clínica')
    expect(code).toMatch(/^[A-Z0-9]{3,8}-[A-Z0-9]{5}$/)
    expect(code.startsWith('PETLIFE')).toBe(true)
  })

  it('should remove accents and special characters', () => {
    const code = generateClinicCode('Clínica São José & Cão')
    expect(code).toMatch(/^[A-Z0-9]{3,8}-[A-Z0-9]{5}$/)
    expect(code.startsWith('SAOJOSE')).toBe(true)
  })

  it('should handle names with only generic stop words', () => {
    const code = generateClinicCode('Clínica Veterinária')
    expect(code).toMatch(/^[A-Z0-9]{3,8}-[A-Z0-9]{5}$/)
    // Deve recorrer aos tokens disponíveis
    expect(code.startsWith('CLINIC')).toBe(true)
  })

  it('should pad short names to at least 3 chars in prefix', () => {
    const code = generateClinicCode('Oi')
    expect(code).toMatch(/^[A-Z0-9]{3,8}-[A-Z0-9]{5}$/)
    expect(code.startsWith('OIX')).toBe(true)
  })

  it('should handle empty or invalid inputs gracefully', () => {
    const codeEmpty = generateClinicCode('')
    expect(codeEmpty).toMatch(/^CLINIC-[A-Z0-9]{5}$/)

    // @ts-expect-error testando entrada inválida em runtime
    const codeNull = generateClinicCode(null)
    expect(codeNull).toMatch(/^CLINIC-[A-Z0-9]{5}$/)
  })

  it('should avoid visually ambiguous characters in suffix (0, O, 1, I)', () => {
    for (let i = 0; i < 50; i++) {
      const code = generateClinicCode('PetCare')
      const [, suffix] = code.split('-')
      expect(suffix).not.toMatch(/[0O1I]/)
    }
  })
})
