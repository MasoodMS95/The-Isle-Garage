export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { assertProductionConfig } = await import('./lib/server/config');
    if (process.env.NEXT_PHASE !== 'phase-production-build')
      assertProductionConfig();
    const { startMailWorker } = await import('./lib/server/mail');
    startMailWorker();
  }
}
