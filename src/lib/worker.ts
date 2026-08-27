export let workerStarted = false;

export function startBackgroundWorker() {
  if (workerStarted) return;
  workerStarted = true;
  
  if (typeof window !== "undefined") return; // Only run on server

  console.log("🚀 [Cowbox Daemon] Starting Background Worker (Cron & Status Monitors)...");

  // Run Status Monitors every 60 seconds
  setInterval(() => {
    fetch("http://127.0.0.1:9999/api/status/check", { method: "POST" })
      .catch(() => {});
  }, 60000);

  // Note: For fully implemented Cron jobs, we would query the database here
  // and evaluate standard cron expressions. For now, since the route requires
  // the ID of the cron job to run manually, we will assume true cron requires
  // a library like node-cron.
}
