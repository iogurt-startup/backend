import { app } from './app'
import { env } from './config/env'
import { startAppointmentReminderJob } from './modules/schedule/infra/jobs/appointmentReminderJob'

app.listen({ port: env.PORT, host: '0.0.0.0' }, (err) => {
  if (err) {
    app.log.error(err)
    process.exit(1)
  }
  console.log(`IOUGURT API rodando na porta ${env.PORT}`)

  if (env.NODE_ENV !== 'test') {
    const reminderJob = startAppointmentReminderJob({ logger: app.log })
    app.addHook('onClose', async () => {
      reminderJob.stop()
    })
  }
})
