import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { assertDeploymentSafe, unsafeForDeployment } from '@/lib/env-guard'

describe('deployment env guard', () => {
  const original = { ...process.env }

  beforeEach(() => {
    delete process.env.SMS_DRIVER
    delete process.env.UPLOAD_DIR
  })

  afterEach(() => {
    process.env = { ...original }
  })

  describe('on a developer machine', () => {
    beforeEach(() => {
      process.env.APP_URL = 'http://localhost:3100'
    })

    it('permits the null SMS driver — that is what it is for', () => {
      process.env.SMS_DRIVER = 'null'
      expect(unsafeForDeployment()).toEqual([])
      expect(() => assertDeploymentSafe()).not.toThrow()
    })

    it('permits a relative upload directory', () => {
      process.env.UPLOAD_DIR = './storage'
      expect(unsafeForDeployment()).toEqual([])
    })
  })

  describe('on a deployment', () => {
    beforeEach(() => {
      process.env.APP_URL = 'https://orchid.example.ir'
    })

    it('refuses an http canonical origin', () => {
      process.env.APP_URL = 'http://orchid.example.ir'
      const problems = unsafeForDeployment()

      expect(problems.map((p) => p.variable)).toContain('APP_URL')
      expect(() => assertDeploymentSafe()).toThrow(/APP_URL/)
    })

    it('accepts an https canonical origin', () => {
      process.env.APP_URL = 'https://orchid.example.ir'
      expect(unsafeForDeployment()).toEqual([])
    })

    it('refuses the null SMS driver', () => {
      process.env.SMS_DRIVER = 'null'
      const problems = unsafeForDeployment()

      expect(problems).toHaveLength(1)
      expect(problems[0]!.variable).toBe('SMS_DRIVER')
      expect(() => assertDeploymentSafe()).toThrow(/SMS_DRIVER/)
    })

    it('refuses a relative upload directory', () => {
      process.env.UPLOAD_DIR = './storage'
      expect(unsafeForDeployment()[0]!.variable).toBe('UPLOAD_DIR')
    })

    it('accepts an absolute POSIX upload directory', () => {
      process.env.UPLOAD_DIR = '/home/orchid/orchid-storage'
      expect(unsafeForDeployment()).toEqual([])
    })

    it('accepts an absolute Windows upload directory', () => {
      process.env.UPLOAD_DIR = 'C:/Users/x/orchid-storage'
      expect(unsafeForDeployment()).toEqual([])
    })

    it('reports every problem at once rather than one per boot', () => {
      process.env.SMS_DRIVER = 'null'
      process.env.UPLOAD_DIR = 'storage'

      const problems = unsafeForDeployment()
      expect(problems.map((p) => p.variable).sort()).toEqual(['SMS_DRIVER', 'UPLOAD_DIR'])
    })

    it('is silent when nothing is misconfigured', () => {
      process.env.UPLOAD_DIR = '/home/orchid/storage'
      expect(() => assertDeploymentSafe()).not.toThrow()
    })
  })

  it('treats an unparseable APP_URL as a deployment, not as local', () => {
    process.env.APP_URL = 'not a url'
    process.env.SMS_DRIVER = 'null'

    const problems = unsafeForDeployment()
    expect(problems.map((p) => p.variable).sort()).toEqual(['APP_URL', 'SMS_DRIVER'])
  })
})
