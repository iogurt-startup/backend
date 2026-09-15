import { describe, expect, it } from 'vitest'
import { renderFirstAccessEmail } from './firstAccessEmailTemplate'

describe('renderFirstAccessEmail', () => {
  it('deve renderizar o template com o nome do tutor e a URL do primeiro acesso', () => {
    const html = renderFirstAccessEmail({
      tutorName: 'Maria Silva',
      firstAccessUrl: 'http://localhost:5173/primeiro-acesso?token=secret-token-123',
      clinicName: 'Clínica Patinhas Felizes',
    })

    expect(html).toContain('Olá, Maria Silva!')
    expect(html).toContain('Clínica Patinhas Felizes')
    expect(html).toContain('href="http://localhost:5173/primeiro-acesso?token=secret-token-123"')
    expect(html).toContain('Definir Minha Senha')
    expect(html).toContain('48 horas')
  })

  it('deve usar o valor padrão para a clínica caso não seja informado', () => {
    const html = renderFirstAccessEmail({
      tutorName: 'João Santos',
      firstAccessUrl: 'http://localhost:5173/primeiro-acesso?token=abc',
    })

    expect(html).toContain('Olá, João Santos!')
    expect(html).toContain('sua clínica veterinária')
  })
})
