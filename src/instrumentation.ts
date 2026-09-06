export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return

  const { assertDeploymentSafe } = await import('./lib/env-guard')
  assertDeploymentSafe()
}
