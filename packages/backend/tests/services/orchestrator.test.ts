import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { Orchestrator, getOrchestrator, resetOrchestrator } from '../../src/services/orchestrator.js'

// Mock child_process
vi.mock('child_process', () => {
  const EventEmitter = require('events')

  return {
    spawn: vi.fn(() => {
      const mockProcess = new EventEmitter()
      mockProcess.pid = 12345
      mockProcess.stdout = new EventEmitter()
      mockProcess.stderr = new EventEmitter()
      mockProcess.kill = vi.fn(() => {
        mockProcess.emit('exit', 0)
        return true
      })

      // Emit exit after a short delay by default
      setTimeout(() => {
        mockProcess.stdout.emit('data', Buffer.from('test output'))
        mockProcess.emit('exit', 0)
      }, 10)

      return mockProcess
    })
  }
})

describe('Orchestrator', () => {
  let orchestrator: Orchestrator

  beforeEach(() => {
    orchestrator = new Orchestrator()
  })

  afterEach(() => {
    orchestrator.killAll()
  })

  describe('spawn', () => {
    it('should spawn a process and track it', async () => {
      const onStdout = vi.fn()
      const onExit = vi.fn()

      const process = orchestrator.spawn({
        cwd: '/test/path',
        prompt: 'test prompt',
        onStdout,
        onExit
      })

      expect(process).toBeDefined()
      expect(process.pid).toBe(12345)

      // Wait for the mock to emit events
      await new Promise(resolve => setTimeout(resolve, 20))

      expect(onStdout).toHaveBeenCalledWith('test output')
      expect(onExit).toHaveBeenCalledWith(0)
    })

    it('should call onStderr when stderr is emitted', async () => {
      const { spawn } = await import('child_process')
      const EventEmitter = require('events')

      const mockProcess = new EventEmitter()
      mockProcess.pid = 12346
      mockProcess.stdout = new EventEmitter()
      mockProcess.stderr = new EventEmitter()
      mockProcess.kill = vi.fn()

      vi.mocked(spawn).mockReturnValueOnce(mockProcess as any)

      const onStderr = vi.fn()

      orchestrator.spawn({
        cwd: '/test/path',
        prompt: 'test',
        onStderr
      })

      mockProcess.stderr.emit('data', Buffer.from('error output'))
      expect(onStderr).toHaveBeenCalledWith('error output')
    })
  })

  describe('kill', () => {
    it('should return false for non-existent process', () => {
      const result = orchestrator.kill(99999)
      expect(result).toBe(false)
    })
  })

  describe('isRunning', () => {
    it('should return false for non-tracked process', () => {
      const result = orchestrator.isRunning(99999)
      expect(result).toBe(false)
    })
  })

  describe('getRunningProcesses', () => {
    it('should return empty array initially', () => {
      const processes = orchestrator.getRunningProcesses()
      expect(processes).toEqual([])
    })
  })
})

describe('Singleton functions', () => {
  afterEach(() => {
    resetOrchestrator()
  })

  it('should return same instance from getOrchestrator', () => {
    const instance1 = getOrchestrator()
    const instance2 = getOrchestrator()
    expect(instance1).toBe(instance2)
  })

  it('should create new instance after reset', () => {
    const instance1 = getOrchestrator()
    resetOrchestrator()
    const instance2 = getOrchestrator()
    expect(instance1).not.toBe(instance2)
  })
})
