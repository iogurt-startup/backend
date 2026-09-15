export interface SendMailData {
  to: string
  subject: string
  html: string
}

export interface IMailProvider {
  sendMail(data: SendMailData): Promise<void>
}
