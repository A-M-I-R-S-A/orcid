import 'server-only'

const LOCAL_HOSTS = ['localhost', '127.0.0.1', '::1']

function isLocal(): boolean {
  try {
    return LOCAL_HOSTS.includes(new URL(process.env.APP_URL ?? 'http://localhost').hostname)
  } catch {
    return false
  }
}

export interface EnvProblem {
  variable: string
  message: string
}

export function unsafeForDeployment(): EnvProblem[] {
  if (isLocal()) return []

  const problems: EnvProblem[] = []

  if (process.env.SMS_DRIVER === 'null') {
    problems.push({
      variable: 'SMS_DRIVER',
      message:
        'SMS_DRIVER=null discards every message while reporting success — OTP, order confirmations and payment notices would all silently fail. Unset it.',
    })
  }

  const appUrl = process.env.APP_URL
  if (appUrl && !appUrl.startsWith('https://')) {
    problems.push({
      variable: 'APP_URL',
      message:
        `APP_URL="${appUrl}" is not https. Canonicals, the sitemap, Open Graph and structured data all derive from it, and CSP upgrades the absolute URLs it produces — an http origin advertises the wrong site and can hang pages. Use the https origin, even though the app itself sits behind the host's TLS.`,
    })
  }

  const uploadDir = process.env.UPLOAD_DIR
  if (uploadDir && !/^([A-Za-z]:[\\/]|[\\/])/.test(uploadDir)) {
    problems.push({
      variable: 'UPLOAD_DIR',
      message:
        `UPLOAD_DIR="${uploadDir}" is relative. server.js calls process.chdir(__dirname), so a relative path resolves inside the application directory: media 404s and uploads are destroyed by the next deploy. Use an absolute path outside it.`,
    })
  }

  return problems
}

export function assertDeploymentSafe(): void {
  const problems = unsafeForDeployment()
  if (problems.length === 0) return

  throw new Error(
    'Refusing to start with development settings on a deployment:\n' +
      problems.map((p) => `  · ${p.variable}: ${p.message}`).join('\n'),
  )
}
