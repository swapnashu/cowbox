export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    try {
      const { initializeDatabase } = await import('@/lib/db');
      const { startBackgroundWorker } = await import('@/lib/worker');
      const { ensureTraefikRunning } = await import('@/lib/docker');

      await initializeDatabase();
      startBackgroundWorker();

      // Ensure Traefik proxy is initialized and running on startup
      ensureTraefikRunning().catch((err: any) => {
        console.warn("[Instrumentation] Traefik auto-start notice:", err?.message || err);
      });
    } catch (e) {
      console.error("[Instrumentation] Error during server startup initialization:", e);
    }
  }
}

