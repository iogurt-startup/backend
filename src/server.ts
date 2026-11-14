import { app } from './app'
import { env } from './config/env'
import {
  startAppointmentReminderJob,
  type AppointmentReminderJobHandle,
} from './modules/schedule/infra/jobs/appointmentReminderJob'

let reminderJob: AppointmentReminderJobHandle | null = null

if (env.NODE_ENV !== 'test') {
  app.addHook('onClose', async () => {
    reminderJob?.stop()
  })
}

app.listen({ port: env.PORT, host: '0.0.0.0' }, (err) => {
  if (err) {
    app.log.error(err)
    process.exit(1)
  }
  console.log(`IOUGURT API rodando na porta ${env.PORT}`)

  if (env.NODE_ENV !== 'test') {
    reminderJob = startAppointmentReminderJob({ logger: app.log })
  }
})

let shuttingDown = false
async function shutdown(signal: NodeJS.Signals) {
  if (shuttingDown) return
  shuttingDown = true
  app.log.info({ signal }, 'Encerrando servidor...')
  try {
    await app.close()
    process.exit(0)
  } catch (err) {
    app.log.error({ err }, 'Erro durante o encerramento gracioso')
    process.exit(1)
  }
}

process.once('SIGTERM', () => {
  void shutdown('SIGTERM')
})
process.once('SIGINT', () => {
  void shutdown('SIGINT')
})
