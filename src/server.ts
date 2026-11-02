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
