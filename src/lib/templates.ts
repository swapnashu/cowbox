export interface AppTemplate {
  id: string;
  name: string;
  category: string;
  description: string;
  image: string;
  containerPort: number;
  icon: string;
  defaultEnv: string;
}

export const APP_TEMPLATES: AppTemplate[] = [
  {
    id: "wordpress",
    name: "WordPress",
    category: "CMS",
    description: "The world's most popular open-source content management system and website builder.",
    image: "wordpress:latest",
    containerPort: 80,
    icon: "Globe",
    defaultEnv: "WORDPRESS_DB_HOST=cowbox-db-wp\nWORDPRESS_DB_USER=root\nWORDPRESS_DB_PASSWORD=secretpassword\nWORDPRESS_DB_NAME=wordpress",
  },
  {
    id: "pocketbase",
    name: "PocketBase",
    category: "Backend",
    description: "Open source real-time backend in 1 file with embedded SQLite database and auth.",
    image: "ghcr.io/muchobien/pocketbase:latest",
    containerPort: 8090,
    icon: "Database",
    defaultEnv: "",
  },
  {
    id: "n8n",
    name: "n8n Automation",
    category: "Automation",
    description: "Fair-code workflow automation tool with extensive integrations and node support.",
    image: "n8nio/n8n:latest",
    containerPort: 5678,
    icon: "Workflow",
    defaultEnv: "N8N_PORT=5678\nGENERIC_TIMEZONE=UTC",
  },
  {
    id: "uptime-kuma",
    name: "Uptime Kuma",
    category: "Monitoring",
    description: "Self-hosted monitoring tool for HTTP, TCP, Ping, DNS, and push notifications.",
    image: "louislam/uptime-kuma:latest",
    containerPort: 3001,
    icon: "Activity",
    defaultEnv: "PORT=3001",
  },
  {
    id: "minio",
    name: "MinIO S3 Storage",
    category: "Storage",
    description: "High-performance S3-compatible object storage server for cloud-native apps.",
    image: "minio/minio:latest",
    containerPort: 9000,
    icon: "HardDrive",
    defaultEnv: "MINIO_ROOT_USER=minioadmin\nMINIO_ROOT_PASSWORD=minioadmin",
  },
  {
    id: "ghost",
    name: "Ghost Blog",
    category: "Publishing",
    description: "Modern open-source publication and subscription platform for creators.",
    image: "ghost:5-alpine",
    containerPort: 2368,
    icon: "BookOpen",
    defaultEnv: "NODE_ENV=production\nurl=http://localhost:9999",
  },
  {
    id: "meilisearch",
    name: "Meilisearch",
    category: "Search",
    description: "Lightning-fast, ultra-relevant open source search engine with typo tolerance.",
    image: "getmeili/meilisearch:latest",
    containerPort: 7700,
    icon: "Search",
    defaultEnv: "MEILI_MASTER_KEY=masterKey123456789\nMEILI_ENV=development",
  },
  {
    id: "vaultwarden",
    name: "Vaultwarden",
    category: "Security",
    description: "Lightweight, resource-efficient Bitwarden compatible password manager written in Rust.",
    image: "vaultwarden/server:latest",
    containerPort: 80,
    icon: "Shield",
    defaultEnv: "SIGNUPS_ALLOWED=true\nWEBSOCKET_ENABLED=true",
  },
  {
    id: "plausible",
    name: "Plausible Analytics",
    category: "Analytics",
    description: "Simple, open-source, lightweight and privacy-friendly Google Analytics alternative.",
    image: "plausible/analytics:latest",
    containerPort: 8000,
    icon: "BarChart3",
    defaultEnv: "BASE_URL=http://localhost:9999\nSECRET_KEY_BASE=change_this_to_a_random_string_of_64_bytes",
  },
  {
    id: "nginx",
    name: "Nginx Web Server",
    category: "Web Server",
    description: "High performance HTTP web server and reverse proxy for static files and apps.",
    image: "nginx:alpine",
    containerPort: 80,
    icon: "Layers",
    defaultEnv: "",
  },
];
