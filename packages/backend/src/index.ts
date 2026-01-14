// Server
export { createApp, type ServerOptions } from './server.js'

// Database
export { getDatabase, closeDatabase, setDatabase, resetDatabase, type DatabaseOptions } from './database/connection.js'
export { initSchema, dropAllTables } from './database/schema.js'

// Services
export { Orchestrator, getOrchestrator, resetOrchestrator, type OrchestratorOptions, type RunningProcess } from './services/orchestrator.js'
export { MissionExecutor, getMissionExecutor, resetMissionExecutor } from './services/mission-executor.js'

// Middleware
export { AppError, NotFoundError, ValidationError, ConflictError, errorHandler } from './middleware/error-handler.js'
export { requestLogger } from './middleware/logger.js'

// Start server if run directly
const isMainModule = process.argv[1]?.includes('index')
if (isMainModule) {
  const { createApp } = await import('./server.js')
  const { getDatabase } = await import('./database/connection.js')

  const PORT = process.env.PORT || 3001

  // Initialize database
  getDatabase()

  const app = createApp()
  app.listen(PORT, () => {
    console.log(`Ralphy backend server running on port ${PORT}`)
  })
}
