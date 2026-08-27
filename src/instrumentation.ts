export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const cron = require('node-cron');
    
    console.log("🚀 [Cowbox Daemon] Starting Background Worker (Cron & Status Monitors)...");

    // Auto-setup admin user from environment variables if passed (e.g. from Python CLI)
    setTimeout(async () => {
      try {
        await fetch('http://127.0.0.1:9999/api/auth/setup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: "Admin",
            email: process.env.ADMIN_EMAIL || "cowbox@cowbox.io",
            password: process.env.ADMIN_PASSWORD || "cowbox#1234"
          })
        });
      } catch(e) {}
    }, 5000);

    // Status Checker - Runs every minute
    cron.schedule('* * * * *', async () => {
      try {
        await fetch('http://127.0.0.1:9999/api/status/check', { method: 'POST' });
      } catch (e) {
        // Ignore fetch errors during boot
      }
    });

    // We can also poll DB for user-defined cron jobs and evaluate them here, 
    // but a 1-minute interval is a good standard heartbeat.
    cron.schedule('* * * * *', async () => {
      // In a full implementation, you would fetch all cron jobs from DB
      // and check if they should run using cron.validate() and current time.
      // For simplicity, we just trigger a generic tick if needed.
    });
  }
}
