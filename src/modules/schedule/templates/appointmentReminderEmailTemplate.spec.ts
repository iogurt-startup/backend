import { describe, expect, it } from 'vitest'
import { renderAppointmentReminderEmail } from './appointmentReminderEmailTemplate'

describe('renderAppointmentReminderEmail', () => {
  it('deve renderizar os dados da consulta, paciente, tutor e clínica corretamente', () => {
    const html = renderAppointmentReminderEmail({
      tutorName: 'Carlos Eduardo',
      patientName: 'Thor',
      dateTime: new Date('2026-10-28T14:30:00-03:00'),
      category: 'VACCINATION',
      vetName: 'Dra. Juliana',
      clinicName: 'Clínica PetVida',
      clinicAddress: 'Av. Paulista, 1000',
      clinicPhone: '(11) 98888-7777',
      portalUrl: 'http://localhost:5173/portal',
    })

    expect(html).toContain('Olá, Carlos Eduardo!')
    expect(html).toContain('Thor')
    expect(html).toContain('Clínica PetVida')
    expect(html).toContain('Vacinação')
    expect(html).toContain('28/10/2026')
    expect(html).toContain('14:30')
    expect(html).toContain('Dra. Juliana')
    expect(html).toContain('Av. Paulista, 1000')
    expect(html).toContain('(11) 98888-7777')
    expect(html).toContain('href="http://localhost:5173/portal"')
  })

  it('deve utilizar valores padrão quando veterinário ou dados opcionais da clínica não forem informados', () => {
    const html = renderAppointmentReminderEmail({
      tutorName: 'Fernanda',
      patientName: 'Mia',
      dateTime: new Date('2026-10-28T10:00:00-03:00'),
      category: 'OBSERVATION',
    })

    expect(html).toContain('Olá, Fernanda!')
    expect(html).toContain('sua clínica veterinária')
    expect(html).toContain('Equipe Veterinária')
    expect(html).toContain('Consulta / Observação')
    expect(html).not.toContain('Endereço:')
    expect(html).not.toContain('Contato:')
  })

  it('deve escapar caracteres HTML maliciosos nos campos interpolados', () => {
    const html = renderAppointmentReminderEmail({
      tutorName: '<script>alert("xss")</script>',
      patientName: 'Rex <b>Bold</b>',
      dateTime: new Date('2026-10-28T10:00:00-03:00'),
      category: 'EXAM',
      clinicName: 'Clínica "Top" & Cia',
      portalUrl: 'http://localhost:5173/portal?a=1&b="2"',
    })

    expect(html).not.toContain('<script>')
    expect(html).toContain('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;')
    expect(html).toContain('Rex &lt;b&gt;Bold&lt;/b&gt;')
    expect(html).toContain('Clínica &quot;Top&quot; &amp; Cia')
    expect(html).toContain('href="http://localhost:5173/portal?a=1&amp;b=&quot;2&quot;"')
  })
})

