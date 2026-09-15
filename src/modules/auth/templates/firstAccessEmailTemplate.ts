export interface FirstAccessEmailTemplateData {
  tutorName: string
  firstAccessUrl: string
  clinicName?: string
}

export function renderFirstAccessEmail({
  tutorName,
  firstAccessUrl,
  clinicName = 'sua clínica veterinária',
}: FirstAccessEmailTemplateData): string {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Primeiro Acesso - Portal do Tutor</title>
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
      margin-bottom: 24px;
    }
    .cta-container {
      text-align: center;
      margin: 32px 0;
    }
    .cta-button {
      background-color: #2563eb;
      color: #ffffff !important;
      text-decoration: none;
      padding: 14px 28px;
      font-size: 16px;
      font-weight: 600;
      border-radius: 6px;
      display: inline-block;
      box-shadow: 0 2px 4px rgba(37, 99, 235, 0.2);
    }
    .notice {
      font-size: 13px;
      color: #6b7280;
      background-color: #f9fafb;
      padding: 14px;
      border-left: 4px solid #3b82f6;
      border-radius: 4px;
      margin-top: 24px;
    }
    .fallback {
      margin-top: 20px;
      font-size: 12px;
      color: #9ca3af;
      word-break: break-all;
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
        A equipe de <strong>${clinicName}</strong> cadastrou seu acesso ao <strong>Portal do Tutor</strong>.
      </p>
      <p class="message">
        No portal, você poderá acompanhar consultas, vacinas e o prontuário dos seus pets em um só lugar. Para começar, defina sua senha de acesso clicando no botão abaixo:
      </p>
      <div class="cta-container">
        <a href="${firstAccessUrl}" class="cta-button" target="_blank" rel="noopener noreferrer">
          Definir Minha Senha
        </a>
      </div>
      <div class="notice">
        <strong>Atenção:</strong> Este link é de uso único e expira em 48 horas. Caso expire ou você não consiga utilizá-lo, solicite um novo envio à clínica.
      </div>
      <div class="fallback">
        Se o botão acima não funcionar, copie e cole o seguinte endereço em seu navegador:<br>
        <a href="${firstAccessUrl}" style="color: #2563eb;">${firstAccessUrl}</a>
      </div>
    </div>
    <div class="footer">
      Esta é uma mensagem automática gerada pelo sistema IOUGURT. Se você não reconhece esta solicitação, por favor desconsidere este e-mail.
    </div>
  </div>
</body>
</html>`
}
