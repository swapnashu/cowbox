import { startBackgroundWorker } from "@/lib/worker";
import { initializeDatabase } from "@/lib/db";

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    try {
      await initializeDatabase();
      startBackgroundWorker();
    } catch (e) {
      console.error("[Instrumentation] Error initializing background worker:", e);
    }
  }
}

