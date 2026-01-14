import { describe, it, expect } from 'vitest'
import {
  MissionStatus,
  TaskStatus,
  LogLevel,
  isMissionStatus,
  isTaskStatus,
  isLogLevel
} from '../src/index.js'

describe('Enums', () => {
  describe('MissionStatus', () => {
    it('should have all expected values', () => {
      expect(MissionStatus.DRAFT).toBe('draft')
      expect(MissionStatus.GENERATING_PRD).toBe('generating_prd')
      expect(MissionStatus.PRD_REVIEW).toBe('prd_review')
      expect(MissionStatus.PREPARING_TASKS).toBe('preparing_tasks')
      expect(MissionStatus.TASKS_REVIEW).toBe('tasks_review')
      expect(MissionStatus.IN_PROGRESS).toBe('in_progress')
      expect(MissionStatus.COMPLETED_SUCCESS).toBe('completed_success')
      expect(MissionStatus.COMPLETED_FAILED).toBe('completed_failed')
    })
  })

  describe('TaskStatus', () => {
    it('should have all expected values', () => {
      expect(TaskStatus.PENDING).toBe('pending')
      expect(TaskStatus.IN_PROGRESS).toBe('in_progress')
      expect(TaskStatus.COMPLETED).toBe('completed')
      expect(TaskStatus.FAILED).toBe('failed')
      expect(TaskStatus.SKIPPED).toBe('skipped')
    })
  })

  describe('LogLevel', () => {
    it('should have all expected values', () => {
      expect(LogLevel.DEBUG).toBe('debug')
      expect(LogLevel.INFO).toBe('info')
      expect(LogLevel.WARN).toBe('warn')
      expect(LogLevel.ERROR).toBe('error')
    })
  })
})

describe('Type Guards', () => {
  describe('isMissionStatus', () => {
    it('should return true for valid mission status', () => {
      expect(isMissionStatus('draft')).toBe(true)
      expect(isMissionStatus('generating_prd')).toBe(true)
      expect(isMissionStatus('completed_success')).toBe(true)
    })

    it('should return false for invalid mission status', () => {
      expect(isMissionStatus('invalid')).toBe(false)
      expect(isMissionStatus('')).toBe(false)
      expect(isMissionStatus('DRAFT')).toBe(false)
    })
  })

  describe('isTaskStatus', () => {
    it('should return true for valid task status', () => {
      expect(isTaskStatus('pending')).toBe(true)
      expect(isTaskStatus('in_progress')).toBe(true)
      expect(isTaskStatus('completed')).toBe(true)
    })

    it('should return false for invalid task status', () => {
      expect(isTaskStatus('invalid')).toBe(false)
      expect(isTaskStatus('')).toBe(false)
    })
  })

  describe('isLogLevel', () => {
    it('should return true for valid log level', () => {
      expect(isLogLevel('debug')).toBe(true)
      expect(isLogLevel('info')).toBe(true)
      expect(isLogLevel('error')).toBe(true)
    })

    it('should return false for invalid log level', () => {
      expect(isLogLevel('invalid')).toBe(false)
      expect(isLogLevel('DEBUG')).toBe(false)
    })
  })
})
