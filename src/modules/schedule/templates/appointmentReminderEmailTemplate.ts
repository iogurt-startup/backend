import type { AppointmentCategory } from '@prisma/client'

export interface AppointmentReminderEmailTemplateData {
  tutorName: string
  patientName: string
  dateTime: Date
  category: AppointmentCategory
  vetName?: string | null
  clinicName?: string | null
  clinicAddress?: string | null
  clinicPhone?: string | null
  portalUrl?: string
}

const HTML_ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, char => HTML_ESCAPES[char])
}

const CATEGORY_LABELS: Record<AppointmentCategory, string> = {
  VACCINATION: 'Vacinação',
  OBSERVATION: 'Consulta / Observação',
  EXAM: 'Exame',
  SURGICAL: 'Procedimento Cirúrgico',
}

function formatDateBR(date: Date): string {
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date)
}

function formatTimeBR(date: Date): string {
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

export function renderAppointmentReminderEmail(
  data: AppointmentReminderEmailTemplateData,
): string {
  const tutorName = escapeHtml(data.tutorName)
  const patientName = escapeHtml(data.patientName)
  const clinicName = escapeHtml(data.clinicName || 'sua clínica veterinária')
  const vetName = escapeHtml(data.vetName || 'Equipe Veterinária')
  const categoryLabel = escapeHtml(CATEGORY_LABELS[data.category] ?? data.category)
  const formattedDate = formatDateBR(data.dateTime)
  const formattedTime = formatTimeBR(data.dateTime)
  const clinicAddress = data.clinicAddress ? escapeHtml(data.clinicAddress) : null
  const clinicPhone = data.clinicPhone ? escapeHtml(data.clinicPhone) : null
  const portalUrl = data.portalUrl ? escapeHtml(data.portalUrl) : null

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Lembrete de Consulta - IOUGURT</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      background-color: #f4f6f8;
      margin: 0;
      padding: 0;
      color: #333333;
    }
    .container {
      max-width: 600px;
      margin: 30px auto;
      background: #ffffff;
      border-radius: 8px;
      overflow: hidden;
      box-shadow: 0 2px 8px rgba(0,0,0,0.06);
    }
    .header {
      background-color: #1e3a8a;
      padding: 24px;
      text-align: center;
      color: #ffffff;
    }
    .header h1 {
      margin: 0;
      font-size: 22px;
      letter-spacing: 0.5px;
    }
    .content {
      padding: 32px 28px;
      line-height: 1.6;
    }
    .greeting {
      font-size: 18px;
      font-weight: 600;
      margin-bottom: 16px;
      color: #111827;
    }
    .message {
      font-size: 15px;
      color: #4b5563;
      margin-bottom: 20px;
    }
    .details-card {
      background-color: #f9fafb;
      border: 1px solid #e5e7eb;
      border-left: 4px solid #2563eb;
      border-radius: 6px;
      padding: 18px 20px;
      margin: 24px 0;
      font-size: 14px;
      color: #1f2937;
    }
    .details-card p {
      margin: 6px 0;
    }
    .cta-container {
      text-align: center;
      margin: 28px 0;
    }
    .cta-button {
      background-color: #2563eb;
      color: #ffffff !important;
      text-decoration: none;
      padding: 12px 24px;
      font-size: 15px;
      font-weight: 600;
      border-radius: 6px;
      display: inline-block;
    }
    .footer {
      background-color: #f9fafb;
      padding: 18px;
      text-align: center;
      font-size: 12px;
      color: #9ca3af;
      border-top: 1px solid #e5e7eb;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>IOUGURT Veterinária</h1>
    </div>
    <div class="content">
      <div class="greeting">Olá, ${tutorName}!</div>
      <p class="message">
        Passando para lembrar que o atendimento de <strong>${patientName}</strong> em <strong>${clinicName}</strong> está agendado para as próximas 24 horas.
      </p>
      <div class="details-card">
        <p><strong>Paciente:</strong> ${patientName}</p>
        <p><strong>Categoria:</strong> ${categoryLabel}</p>
        <p><strong>Data:</strong> ${formattedDate}</p>
        <p><strong>Horário:</strong> ${formattedTime}</p>
        <p><strong>Profissional:</strong> ${vetName}</p>
        ${clinicAddress ? `<p><strong>Endereço:</strong> ${clinicAddress}</p>` : ''}
        ${clinicPhone ? `<p><strong>Contato:</strong> ${clinicPhone}</p>` : ''}
      </div>
      ${
        portalUrl
          ? `<div class="cta-container">
        <a href="${portalUrl}" class="cta-button" target="_blank" rel="noopener noreferrer">
          Acessar Portal do Tutor
        </a>
      </div>`
          : ''
      }
      <p class="message">
        Caso precise reagendar ou cancelar, entre em contato com a clínica com antecedência.
      </p>
    </div>
    <div class="footer">
      Esta é uma mensagem automática enviada pelo sistema IOUGURT.
    </div>
  </div>
</body>
</html>`
}

