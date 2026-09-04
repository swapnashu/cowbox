import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "./schema";
import * as fs from "fs";
import * as path from "path";

const dataDir = path.join(process.cwd(), "data");
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Support seamless migration from dekployer.db to cowbox.db if existing
const oldDbPath = path.join(dataDir, "dekployer.db");
const dbPath = path.join(dataDir, "cowbox.db");

if (fs.existsSync(oldDbPath) && !fs.existsSync(dbPath)) {
  try {
    fs.copyFileSync(oldDbPath, dbPath);
  } catch (e) {}
}

const client = createClient({
  url: `file:${dbPath}`,
});

export const db = drizzle(client, { schema });

// Auto-run schema initialization for tables if not present
export async function initializeDatabase() {
  await client.execute("PRAGMA foreign_keys = ON;");

  await client.execute(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      name TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'admin',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await client.execute(`
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await client.execute(`
    CREATE TABLE IF NOT EXISTS applications (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      description TEXT,
      app_type TEXT NOT NULL DEFAULT 'image',
      git_repository TEXT,
      git_branch TEXT DEFAULT 'main',
      build_path TEXT DEFAULT '/',
      build_pack TEXT,
      dockerfile TEXT,
      docker_image TEXT,
      exposed_port INTEGER,
      container_port INTEGER NOT NULL DEFAULT 80,
      env_vars TEXT DEFAULT '',
      replicas INTEGER NOT NULL DEFAULT 1,
      status TEXT NOT NULL DEFAULT 'stopped',
      container_id TEXT,
      memory_limit TEXT,
      cpu_limit TEXT,
      restart_policy TEXT NOT NULL DEFAULT 'unless-stopped',
      auto_deploy INTEGER NOT NULL DEFAULT 0,
      basic_auth_enabled INTEGER NOT NULL DEFAULT 0,
      basic_auth_users TEXT DEFAULT '',
      health_check_path TEXT DEFAULT '/',
      force_https INTEGER NOT NULL DEFAULT 1,
      ip_whitelist TEXT DEFAULT '',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await client.execute(`
    CREATE TABLE IF NOT EXISTS databases (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      version TEXT NOT NULL DEFAULT 'latest',
      root_password TEXT NOT NULL,
      database_name TEXT NOT NULL,
      database_user TEXT,
      database_password TEXT,
      exposed_port INTEGER,
      internal_port INTEGER NOT NULL,
      container_id TEXT,
      status TEXT NOT NULL DEFAULT 'stopped',
      volume_name TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await client.execute(`
    CREATE TABLE IF NOT EXISTS compose_stacks (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      description TEXT,
      compose_yaml TEXT NOT NULL,
      env_vars TEXT DEFAULT '',
      status TEXT NOT NULL DEFAULT 'stopped',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await client.execute(`
    CREATE TABLE IF NOT EXISTS domains (
      id TEXT PRIMARY KEY,
      application_id TEXT NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
      domain TEXT NOT NULL,
      https INTEGER NOT NULL DEFAULT 1,
      certificate_resolver TEXT NOT NULL DEFAULT 'letsencrypt',
      path_prefix TEXT DEFAULT '/',
      strip_prefix INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await client.execute(`
    CREATE TABLE IF NOT EXISTS volumes (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      driver TEXT NOT NULL DEFAULT 'local',
      size TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await client.execute(`
    CREATE TABLE IF NOT EXISTS app_volumes (
      id TEXT PRIMARY KEY,
      application_id TEXT NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
      volume_name TEXT NOT NULL REFERENCES volumes(name) ON DELETE CASCADE,
      mount_path TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await client.execute(`
    CREATE TABLE IF NOT EXISTS deployments (
      id TEXT PRIMARY KEY,
      application_id TEXT NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'queued',
      commit_hash TEXT,
      commit_message TEXT,
      image_tag TEXT,
      logs TEXT DEFAULT '',
      duration_seconds INTEGER DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await client.execute(`
    CREATE TABLE IF NOT EXISTS metrics (
      id TEXT PRIMARY KEY,
      container_id TEXT NOT NULL,
      cpu_percent TEXT NOT NULL,
      memory_used_bytes INTEGER NOT NULL,
      memory_total_bytes INTEGER NOT NULL,
      network_rx_bytes INTEGER NOT NULL,
      network_tx_bytes INTEGER NOT NULL,
      timestamp TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await client.execute(`
    CREATE TABLE IF NOT EXISTS status_monitors (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      url TEXT,
      type TEXT NOT NULL,
      container_id TEXT,
      expected_status_code INTEGER DEFAULT 200,
      interval_seconds INTEGER NOT NULL DEFAULT 60,
      status TEXT NOT NULL DEFAULT 'unknown',
      last_check TEXT,
      response_time_ms INTEGER,
      enabled INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await client.execute(`
    CREATE TABLE IF NOT EXISTS status_incidents (
      id TEXT PRIMARY KEY,
      monitor_id TEXT NOT NULL REFERENCES status_monitors(id) ON DELETE CASCADE,
      status TEXT NOT NULL DEFAULT 'investigating',
      message TEXT NOT NULL,
      started_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      resolved_at TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await client.execute(`
    CREATE TABLE IF NOT EXISTS cron_jobs (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      schedule TEXT NOT NULL,
      target_type TEXT NOT NULL DEFAULT 'shell',
      command TEXT NOT NULL,
      enabled INTEGER NOT NULL DEFAULT 1,
      last_run TEXT,
      last_status TEXT NOT NULL DEFAULT 'never',
      logs TEXT DEFAULT '',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await client.execute(`
    CREATE TABLE IF NOT EXISTS api_keys (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      key_prefix TEXT NOT NULL,
      key_hash TEXT NOT NULL,
      permissions TEXT NOT NULL DEFAULT 'full_access',
      last_used_at TEXT,
      expires_at TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await client.execute(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      action TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id TEXT,
      details TEXT,
      ip_address TEXT,
      status TEXT NOT NULL DEFAULT 'success',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await client.execute(`
    CREATE TABLE IF NOT EXISTS server_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await client.execute(`
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token TEXT NOT NULL UNIQUE,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await client.execute(`
    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      channel TEXT NOT NULL,
      name TEXT NOT NULL,
      webhook_url TEXT NOT NULL,
      enabled INTEGER NOT NULL DEFAULT 1,
      events TEXT NOT NULL DEFAULT 'deploy:success,deploy:failed,container:stopped',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);
}
