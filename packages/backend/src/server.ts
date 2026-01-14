import express, { type Express } from 'express'
import cors from 'cors'
import helmet from 'helmet'
import { errorHandler } from './middleware/error-handler.js'
import { requestLogger } from './middleware/logger.js'
import { createRouter } from './routes/index.js'

export interface ServerOptions {
  enableLogging?: boolean
}

export function createApp(options: ServerOptions = {}): Express {
  const app = express()

  // Security middleware
  app.use(helmet())
  app.use(cors())

  // Body parsing
  app.use(express.json())

  // Logging
  if (options.enableLogging !== false) {
    app.use(requestLogger)
  }

  // Health check
  app.get('/health', (_req, res) => {
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString()
    })
  })

  // API routes
  app.use('/api', createRouter())

  // Error handling
  app.use(errorHandler)

  return app
}
