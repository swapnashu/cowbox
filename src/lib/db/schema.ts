import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  name: text("name").notNull(),
  role: text("role", { enum: ["admin", "member", "viewer"] }).default("admin").notNull(),
  createdAt: text("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: text("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const projects = sqliteTable("projects", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  createdAt: text("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: text("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const applications = sqliteTable("applications", {
  id: text("id").primaryKey(),
  projectId: text("project_id").references(() => projects.id, { onDelete: "cascade" }).notNull(),
  name: text("name").notNull(),
  description: text("description"),
  appType: text("app_type", { enum: ["git", "dockerfile", "image", "nixpacks"] }).default("image").notNull(),
  
  // Git / Source configuration
  gitRepository: text("git_repository"),
  gitBranch: text("git_branch").default("main"),
  buildPath: text("build_path").default("/"),
  buildPack: text("build_pack"),
  dockerfile: text("dockerfile"),
  dockerImage: text("docker_image"),
  
  // Container Networking & Ports
  exposedPort: integer("exposed_port"),
  containerPort: integer("container_port").default(80).notNull(),
  
  // Environment variables & Secrets
  envVars: text("env_vars").default(""),
  
  // Container resource & runtime configs
  replicas: integer("replicas").default(1).notNull(),
  status: text("status", { enum: ["running", "stopped", "building", "error"] }).default("stopped").notNull(),
  containerId: text("container_id"),
  memoryLimit: text("memory_limit"),
  cpuLimit: text("cpu_limit"),
  restartPolicy: text("restart_policy").default("unless-stopped").notNull(),
  autoDeploy: integer("auto_deploy", { mode: "boolean" }).default(false).notNull(),
  
  // Security & Dokploy / Easypanel Features
  basicAuthEnabled: integer("basic_auth_enabled", { mode: "boolean" }).default(false).notNull(),
  basicAuthUsers: text("basic_auth_users").default(""), // e.g. "admin:password"
  healthCheckPath: text("health_check_path").default("/"),
  forceHttps: integer("force_https", { mode: "boolean" }).default(true).notNull(),
  ipWhitelist: text("ip_whitelist").default(""), // comma separated CIDRs
  
  createdAt: text("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: text("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const databases = sqliteTable("databases", {
  id: text("id").primaryKey(),
  projectId: text("project_id").references(() => projects.id, { onDelete: "cascade" }).notNull(),
  name: text("name").notNull(),
  type: text("type", { enum: ["postgres", "mysql", "redis", "mongodb", "mariadb", "clickhouse"] }).notNull(),
  version: text("version").default("latest").notNull(),
  
  // Credentials
  rootPassword: text("root_password").notNull(),
  databaseName: text("database_name").notNull(),
  databaseUser: text("database_user"),
  databasePassword: text("database_password"),
  
  // Networking
  exposedPort: integer("exposed_port"),
  internalPort: integer("internal_port").notNull(),
  
  // State
  containerId: text("container_id"),
  status: text("status", { enum: ["running", "stopped", "error"] }).default("stopped").notNull(),
  volumeName: text("volume_name"),
  
  createdAt: text("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: text("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const composeStacks = sqliteTable("compose_stacks", {
  id: text("id").primaryKey(),
  projectId: text("project_id").references(() => projects.id, { onDelete: "cascade" }).notNull(),
  name: text("name").notNull(),
  description: text("description"),
  composeYaml: text("compose_yaml").notNull(),
  envVars: text("env_vars").default(""),
  status: text("status", { enum: ["running", "stopped", "error"] }).default("stopped").notNull(),
  createdAt: text("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: text("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const domains = sqliteTable("domains", {
  id: text("id").primaryKey(),
  applicationId: text("application_id").references(() => applications.id, { onDelete: "cascade" }).notNull(),
  domain: text("domain").notNull(),
  https: integer("https", { mode: "boolean" }).default(true).notNull(),
  certificateResolver: text("certificate_resolver").default("letsencrypt").notNull(),
  pathPrefix: text("path_prefix").default("/"),
  stripPrefix: integer("strip_prefix", { mode: "boolean" }).default(false).notNull(),
  createdAt: text("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const volumes = sqliteTable("volumes", {
  id: text("id").primaryKey(),
  name: text("name").notNull().unique(),
  driver: text("driver").default("local").notNull(),
  size: text("size"),
  createdAt: text("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const appVolumes = sqliteTable("app_volumes", {
  id: text("id").primaryKey(),
  applicationId: text("application_id").references(() => applications.id, { onDelete: "cascade" }).notNull(),
  volumeName: text("volume_name").references(() => volumes.name, { onDelete: "cascade" }).notNull(),
  mountPath: text("mount_path").notNull(),
  createdAt: text("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const deployments = sqliteTable("deployments", {
  id: text("id").primaryKey(),
  applicationId: text("application_id").references(() => applications.id, { onDelete: "cascade" }).notNull(),
  title: text("title").notNull(),
  status: text("status", { enum: ["queued", "building", "running", "failed", "cancelled"] }).default("queued").notNull(),
  commitHash: text("commit_hash"),
  commitMessage: text("commit_message"),
  imageTag: text("image_tag"),
  logs: text("logs").default(""),
  durationSeconds: integer("duration_seconds").default(0),
  createdAt: text("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: text("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const metrics = sqliteTable("metrics", {
  id: text("id").primaryKey(),
  containerId: text("container_id").notNull(),
  cpuPercent: text("cpu_percent").notNull(),
  memoryUsedBytes: integer("memory_used_bytes").notNull(),
  memoryTotalBytes: integer("memory_total_bytes").notNull(),
  networkRxBytes: integer("network_rx_bytes").notNull(),
  networkTxBytes: integer("network_tx_bytes").notNull(),
  timestamp: text("timestamp").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const statusMonitors = sqliteTable("status_monitors", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  url: text("url"),
  type: text("type", { enum: ["http", "tcp", "container"] }).notNull(),
  containerId: text("container_id"),
  expectedStatusCode: integer("expected_status_code").default(200),
  intervalSeconds: integer("interval_seconds").default(60).notNull(),
  status: text("status", { enum: ["up", "down", "degraded", "unknown"] }).default("unknown").notNull(),
  lastCheck: text("last_check"),
  responseTimeMs: integer("response_time_ms"),
  enabled: integer("enabled", { mode: "boolean" }).default(true).notNull(),
  createdAt: text("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: text("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const statusIncidents = sqliteTable("status_incidents", {
  id: text("id").primaryKey(),
  monitorId: text("monitor_id").references(() => statusMonitors.id, { onDelete: "cascade" }).notNull(),
  status: text("status", { enum: ["investigating", "identified", "monitoring", "resolved"] }).default("investigating").notNull(),
  message: text("message").notNull(),
  startedAt: text("started_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  resolvedAt: text("resolved_at"),
  createdAt: text("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: text("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const cronJobs = sqliteTable("cron_jobs", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  schedule: text("schedule").notNull(), // e.g. "0 0 * * *"
  targetType: text("target_type", { enum: ["shell", "backup", "http"] }).default("shell").notNull(),
  command: text("command").notNull(),
  enabled: integer("enabled", { mode: "boolean" }).default(true).notNull(),
  lastRun: text("last_run"),
  lastStatus: text("last_status", { enum: ["success", "failed", "running", "never"] }).default("never").notNull(),
  logs: text("logs").default(""),
  createdAt: text("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// Bulletproof API Keys with Granular Permissions
export const apiKeys = sqliteTable("api_keys", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  keyPrefix: text("key_prefix").notNull(), // e.g. "cbx_live_a1b2..."
  keyHash: text("key_hash").notNull(),     // SHA-256 hash of secret key
  permissions: text("permissions").default("full_access").notNull(), // e.g. "deploy:write,apps:read"
  lastUsedAt: text("last_used_at"),
  expiresAt: text("expires_at"),
  createdAt: text("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// Real-time Audit Logs for Bulletproof Security
export const auditLogs = sqliteTable("audit_logs", {
  id: text("id").primaryKey(),
  action: text("action").notNull(), // e.g. "APP_DEPLOY", "API_KEY_CREATED", "CONTAINER_RESTART"
  entityType: text("entity_type").notNull(), // e.g. "application", "database", "api_key"
  entityId: text("entity_id"),
  details: text("details"),
  ipAddress: text("ip_address"),
  status: text("status", { enum: ["success", "failed", "unauthorized"] }).default("success").notNull(),
  createdAt: text("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const serverSettings = sqliteTable("server_settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: text("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const sessions = sqliteTable("sessions", {
  id: text("id").primaryKey(),
  userId: text("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  token: text("token").notNull().unique(),
  expiresAt: text("expires_at").notNull(),
  createdAt: text("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const notifications = sqliteTable("notifications", {
  id: text("id").primaryKey(),
  channel: text("channel", { enum: ["discord", "telegram", "slack", "webhook"] }).notNull(),
  name: text("name").notNull(),
  webhookUrl: text("webhook_url").notNull(),
  enabled: integer("enabled", { mode: "boolean" }).default(true).notNull(),
  events: text("events").default("deploy:success,deploy:failed,container:stopped").notNull(),
  createdAt: text("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});
