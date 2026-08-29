import Docker from "dockerode";
import os from "os";
import { db } from "@/lib/db";
import { domains, appVolumes } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

// Detect Docker socket based on OS or environment variable
export function getDockerClient(): Docker {
  if (process.env.DOCKER_HOST) {
    return new Docker({ host: process.env.DOCKER_HOST });
  }

  if (os.platform() === "win32") {
    return new Docker({ socketPath: "//./pipe/docker_engine" });
  }

  return new Docker({ socketPath: "/var/run/docker.sock" });
}

export const docker = getDockerClient();
export const COWBOX_NETWORK = "cowbox-network";

/**
 * Ensure the internal bridge network exists for inter-container routing & Traefik
 */
export async function ensureCowboxNetwork(): Promise<string> {
  try {
    const networks = await docker.listNetworks();
    const existing = networks.find((n) => n.Name === COWBOX_NETWORK || n.Name === "dekployer-network");
    if (existing) {
      return existing.Id;
    }

    const network = await docker.createNetwork({
      Name: COWBOX_NETWORK,
      Driver: "bridge",
      CheckDuplicate: true,
      Labels: {
        "cowbox.managed": "true",
      },
    });
    return network.id;
  } catch (error) {
    console.error("Failed to ensure Cowbox network:", error);
    throw error;
  }
}

// Backward compatibility alias
export const ensureDekployerNetwork = ensureCowboxNetwork;
export const DEKPLOYER_NETWORK = COWBOX_NETWORK;

/**
 * Test Docker connection status
 */
export async function checkDockerConnection(): Promise<{
  connected: boolean;
  version?: string;
  containers?: number;
  images?: number;
  error?: string;
}> {
  try {
    const ping = await docker.ping();
    if (ping.toString() === "OK" || ping) {
      const versionInfo = await docker.version();
      const info = await docker.info();
      return {
        connected: true,
        version: versionInfo.Version,
        containers: info.Containers,
        images: info.Images,
      };
    }
    return { connected: false, error: "Ping returned non-OK" };
  } catch (error: any) {
    return {
      connected: false,
      error: error.message || "Cannot connect to Docker daemon",
    };
  }
}

/**
 * Generate Traefik labels for routing domains to containers
 */
export function buildTraefikLabels(params: {
  appName: string;
  domains: Array<{ domain: string; https: boolean; certificateResolver: string; pathPrefix?: string }>;
  containerPort: number;
}): Record<string, string> {
  const { appName, domains, containerPort } = params;
  const routerPrefix = `traefik.http.routers.${appName}`;
  const servicePrefix = `traefik.http.services.${appName}`;

  const labels: Record<string, string> = {
    "traefik.enable": "true",
    "cowbox.managed": "true",
    "cowbox.app": appName,
    [`${servicePrefix}.loadbalancer.server.port`]: containerPort.toString(),
  };

  if (domains.length > 0) {
    const hostRules = domains.map((d) => `Host(\`${d.domain}\`)`).join(" || ");
    labels[`${routerPrefix}.rule`] = hostRules;
    labels[`${routerPrefix}.entrypoints`] = "web,websecure";
    
    // Check if any domain requires HTTPS
    const hasHttps = domains.some((d) => d.https);
    if (hasHttps) {
      labels[`${routerPrefix}.tls`] = "true";
      labels[`${routerPrefix}.tls.certresolver`] = domains[0].certificateResolver || "letsencrypt";
    }
  }

  return labels;
}

/**
 * Create and run an application container
 */
export async function deployAppContainer(options: {
  applicationId: string;
  appName: string;
  image: string;
  containerPort: number;
  exposedPort?: number;
  envVars: string[];
  labels?: Record<string, string>;
  memoryLimit?: string;
  cpuLimit?: string;
  restartPolicy?: string;
}): Promise<Docker.Container> {
  await ensureCowboxNetwork();

  // Fetch domains
  const appDomains = await db.select().from(domains).where(eq(domains.applicationId, options.applicationId));
  
  // Fetch volumes
  const volumesList = await db.select().from(appVolumes).where(eq(appVolumes.applicationId, options.applicationId));
  
  const labels: Record<string, string> = {
    ...(options.labels || {}),
    "traefik.enable": "true",
    "cowbox.managed": "true",
    "cowbox.app": options.appName,
    [`traefik.http.services.${options.appName}.loadbalancer.server.port`]: options.containerPort.toString(),
  };

  appDomains.forEach((d) => {
    // e.g. traefik.http.routers.app123-mydomain-com.rule=Host("mydomain.com")
    const safeDomain = d.domain.replace(/[^a-zA-Z0-9]/g, "-");
    const routerName = `${options.applicationId}-${safeDomain}`;
    labels[`traefik.http.routers.${routerName}.rule`] = `Host(\`${d.domain}\`)`;
    labels[`traefik.http.routers.${routerName}.entrypoints`] = "web,websecure";
    if (d.https) {
      labels[`traefik.http.routers.${routerName}.tls`] = "true";
      labels[`traefik.http.routers.${routerName}.tls.certresolver`] = d.certificateResolver || "letsencrypt";
    }
  });

  const binds = volumesList.map(v => `${v.volumeName}:${v.mountPath}`);

  // Parse memory limit to bytes if provided (e.g. 512m -> 536870912)
  let memoryBytes = 0;
  if (options.memoryLimit) {
    const match = options.memoryLimit.match(/^(\d+)([kmg]?)$/i);
    if (match) {
      const val = parseInt(match[1], 10);
      const unit = match[2].toLowerCase();
      if (unit === "k") memoryBytes = val * 1024;
      else if (unit === "m") memoryBytes = val * 1024 * 1024;
      else if (unit === "g") memoryBytes = val * 1024 * 1024 * 1024;
      else memoryBytes = val;
    }
  }

  // Parse CPU limit (e.g. 0.5 -> NanoCpus: 500000000)
  let nanoCpus = 0;
  if (options.cpuLimit) {
    const cpus = parseFloat(options.cpuLimit);
    if (!isNaN(cpus) && cpus > 0) {
      nanoCpus = Math.floor(cpus * 1e9);
    }
  }

  // Exposed port mapping if custom external port requested
  const portBindings: Record<string, Array<{ HostPort: string }>> = {};
  if (options.exposedPort) {
    portBindings[`${options.containerPort}/tcp`] = [{ HostPort: options.exposedPort.toString() }];
  }

  const container = await docker.createContainer({
    Image: options.image,
    name: `cowbox-${options.appName}-${Date.now().toString().slice(-6)}`,
    Env: options.envVars,
    Labels: labels,
    HostConfig: {
      NetworkMode: COWBOX_NETWORK,
      PortBindings: portBindings,
      RestartPolicy: {
        Name: options.restartPolicy || "unless-stopped",
      },
      Memory: memoryBytes > 0 ? memoryBytes : undefined,
      NanoCpus: nanoCpus > 0 ? nanoCpus : undefined,
      Binds: binds.length > 0 ? binds : undefined,
    },
  });

  await container.start();
  return container;
}

/**
 * Create and run a managed database container
 */
export async function deployDatabaseContainer(params: {
  dbType: "postgres" | "mysql" | "redis" | "mongodb" | "mariadb" | "clickhouse";
  version: string;
  name: string;
  rootPassword: string;
  databaseName: string;
  databaseUser?: string;
  databasePassword?: string;
  exposedPort?: number;
}) {
  await ensureCowboxNetwork();

  let image = "";
  const env: string[] = [];
  let internalPort = 5432;
  const volumeName = `cowbox-data-${params.name}`;

  switch (params.dbType) {
    case "postgres":
      image = `postgres:${params.version || "16-alpine"}`;
      internalPort = 5432;
      env.push(`POSTGRES_PASSWORD=${params.rootPassword}`);
      env.push(`POSTGRES_DB=${params.databaseName}`);
      if (params.databaseUser) env.push(`POSTGRES_USER=${params.databaseUser}`);
      break;

    case "mysql":
      image = `mysql:${params.version || "8.0"}`;
      internalPort = 3306;
      env.push(`MYSQL_ROOT_PASSWORD=${params.rootPassword}`);
      env.push(`MYSQL_DATABASE=${params.databaseName}`);
      if (params.databaseUser && params.databasePassword) {
        env.push(`MYSQL_USER=${params.databaseUser}`);
        env.push(`MYSQL_PASSWORD=${params.databasePassword}`);
      }
      break;

    case "mariadb":
      image = `mariadb:${params.version || "11"}`;
      internalPort = 3306;
      env.push(`MARIADB_ROOT_PASSWORD=${params.rootPassword}`);
      env.push(`MARIADB_DATABASE=${params.databaseName}`);
      if (params.databaseUser && params.databasePassword) {
        env.push(`MARIADB_USER=${params.databaseUser}`);
        env.push(`MARIADB_PASSWORD=${params.databasePassword}`);
      }
      break;

    case "redis":
      image = `redis:${params.version || "7-alpine"}`;
      internalPort = 6379;
      if (params.rootPassword) {
        env.push(`REDIS_PASSWORD=${params.rootPassword}`);
      }
      break;

    case "mongodb":
      image = `mongo:${params.version || "7.0"}`;
      internalPort = 27017;
      if (params.databaseUser && params.rootPassword) {
        env.push(`MONGO_INITDB_ROOT_USERNAME=${params.databaseUser}`);
        env.push(`MONGO_INITDB_ROOT_PASSWORD=${params.rootPassword}`);
      }
      env.push(`MONGO_INITDB_DATABASE=${params.databaseName}`);
      break;

    case "clickhouse":
      image = `clickhouse/clickhouse-server:${params.version || "latest"}`;
      internalPort = 8123;
      env.push(`CLICKHOUSE_DB=${params.databaseName}`);
      env.push(`CLICKHOUSE_PASSWORD=${params.rootPassword}`);
      if (params.databaseUser) env.push(`CLICKHOUSE_USER=${params.databaseUser}`);
      break;
  }

  const portBindings: Record<string, Array<{ HostPort: string }>> = {};
  if (params.exposedPort) {
    portBindings[`${internalPort}/tcp`] = [{ HostPort: params.exposedPort.toString() }];
  }

  try {
    await docker.pull(image);
  } catch (err) {
    console.log("Image might already exist or pulling directly...");
  }

  const container = await docker.createContainer({
    Image: image,
    name: `cowbox-db-${params.name}`,
    Env: env,
    Labels: {
      "cowbox.managed": "true",
      "cowbox.database": params.name,
      "cowbox.dbtype": params.dbType,
    },
    HostConfig: {
      NetworkMode: COWBOX_NETWORK,
      PortBindings: portBindings,
      RestartPolicy: { Name: "unless-stopped" },
      Binds: [`${volumeName}:/var/lib/${params.dbType}/data`],
    },
  });

  await container.start();

  return {
    container,
    image,
    internalPort,
    volumeName,
  };
}
