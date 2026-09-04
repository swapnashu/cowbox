# Cowbox 🐮🚀

> **Cowbox** is an open-source, self-hosted Platform-as-a-Service (PaaS) and container control plane alternative to **Dokploy**, **Coolify**, and **Easypanel**. Deploy and manage applications, databases, Docker Compose stacks, and wildcard `sslip.io` SSL routing instantly on port **9999**.

![Cowbox Status](https://img.shields.io/badge/Status-Beta-emerald?style=flat-square)
![PyPI Version](https://img.shields.io/pypi/v/cowbox?style=flat-square&color=pink)
![License](https://img.shields.io/badge/License-MIT-blue?style=flat-square)

### 📸 Dashboard Overview
![Cowbox Dashboard](https://raw.githubusercontent.com/swapnashu/cowbox/main/public/screenshots/dashboard.png)

### 📸 Master Control Panel
![Master Panel](https://raw.githubusercontent.com/swapnashu/cowbox/main/public/screenshots/master.png)

### 📸 Project Management
![Projects](https://raw.githubusercontent.com/swapnashu/cowbox/main/public/screenshots/projects.png)

---

## ✨ Features (v0.2.1)

### 🚀 Application Deployment & Auto-Deploy
- **Multi-Source Builds**: Deploy from Public Git, Private Git (PAT), Docker Images, Dockerfiles, or .zip Uploads.
- **Auto-Deploy Engine**: Inbound Git webhooks and a background polling daemon watching remote branches for new commits.
- **Zero-Downtime Deployments**: Traffic-safe rolling releases with container health probing before Traefik routing cutover.
- **AI Dockerfile Generator**: Automatically generate optimized, multi-stage Dockerfiles for Next.js, Node, Go, Python, and Static apps using AI.
- **1-Click Rollbacks**: Instantly revert to any previously successful deployment image tag.

### 🐳 Dedicated Docker Management Hub (`/docker`)
- **Container Control Plane**: View live status, resource metrics, inspect configurations, and start/stop/restart/remove containers.
- **Image Explorer & Puller**: Inspect local Docker images, layers, sizes, and pull new images from any registry.
- **Volume & Network Manager**: Manage storage volumes, inspect container attachments, and create bridge networks.
- **BuildKit Cache Manager**: Inspect builder disk footprint and reclaim gigabytes with 1-click prune.
- **Interactive Web Terminal**: Run commands directly inside any container with command history, quick presets, and live output.

### 🐘 Managed Databases
- **One-Click Provisioning**: PostgreSQL, MySQL, Redis, MongoDB, MariaDB, and ClickHouse.
- **Automated Snapshots & Backups**: Schedule backups and restore from snapshots with 1 click.
- **Built-in GUIs**: Automatically launch **Adminer** or **Redis Commander** to manage data visually.
- **Connection SDKs**: Ready-to-use snippets for Prisma, Node.js, Python, and Go.

### 🧩 Docker Compose & Visualizer
- **Compose Stack Orchestrator**: Deploy multi-service stacks from YAML.
- **Interactive Topology Visualizer**: Real-time connected graph rendering services, port bindings, networks, and persistent volume attachments.

### 📊 Monitoring & Telemetry
- **Live Sparkline Charts**: Background daemon collecting container CPU, RAM, and Network metrics every 30s.
- **Activity Feed**: Dashboard timeline merging deployment events and security audit logs.
- **Public Status Page**: A `/status` page with uptime monitors (HTTP/TCP/Container) to show your users everything is operational.

### 🔐 Security & Access
- **Full Authentication**: Secure login system with a setup wizard and Edge Middleware session guards.
- **API Keys**: Generate SHA-256 hashed API keys with scoped permissions for programmatic access.
- **Hardened Sandboxing**: Zip Slip protection, upload path traversal prevention, and shell injection-safe command dispatchers.
- **Immutable Audit Logs**: Every API and deployment action is logged and tracked.

---

## 🚀 Quick Start (Recommended)

Cowbox is officially distributed as a Python package. You can install and boot it on any machine with Docker in just two commands:

```bash
pip install cowbox
cowbox start
```

*During boot, it will prompt you to set up your Admin credentials and automatically launch the dashboard on `http://localhost:9999`.*

---

## 🛠️ Developer Setup (Local Next.js)

If you want to modify the Cowbox source code:
1. Clone the repository and install dependencies:
```bash
npm install
npm run dev
```

2. Open **[http://localhost:9999](http://localhost:9999)** in your browser.
3. The first time you visit, you will be prompted to create an Admin account.

---

## 🐳 Self-Hosting with Docker

To deploy Cowbox on a remote VPS (Ubuntu/Debian recommended):

```bash
# 1. Build the image
docker build -t cowbox:latest .

# 2. Run the container
docker run -d \
  -p 9999:9999 \
  -v /var/run/docker.sock:/var/run/docker.sock \
  -v cowbox-data:/app/data \
  --name cowbox \
  --restart unless-stopped \
  cowbox:latest
```

---

## 📡 Public API (CI/CD Integration)

Cowbox exposes a REST API for integration with GitHub Actions, GitLab CI, or custom scripts. 
*Generate an API Key in the "API Keys & Security" tab of the dashboard.*

### Trigger a Deployment
```bash
curl -X POST http://<your-ip>:9999/api/v1/deploy \
  -H "Authorization: Bearer cbx_live_YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "applicationId": "your-app-id"
  }'
```

---

## 🏗️ Tech Stack

- **Framework**: Next.js 14 (App Router) + React 18
- **Database**: SQLite + Drizzle ORM + `@libsql/client`
- **Styling**: Tailwind CSS + `lucide-react`
- **Docker Integration**: `dockerode`
- **Reverse Proxy**: Traefik v3 (auto-configured via Docker labels)
- **Security**: `bcryptjs` + Edge Middleware Session Cookies

---

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
