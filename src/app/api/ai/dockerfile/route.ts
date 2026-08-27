import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { framework = "node", port = 80, nodeVersion = "20", pythonVersion = "3.11" } = await req.json();

    let generatedDockerfile = "";

    switch (framework.toLowerCase()) {
      case "nextjs":
      case "next":
        generatedDockerfile = `# Multi-stage Next.js Production Dockerfile
FROM node:${nodeVersion}-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci

FROM node:${nodeVersion}-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
RUN npm run build

FROM node:${nodeVersion}-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=${port}
EXPOSE ${port}

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

USER node
CMD ["node", "server.js"]`;
        break;

      case "fastapi":
      case "python":
        generatedDockerfile = `# Python FastAPI / Web Application Dockerfile
FROM python:${pythonVersion}-slim AS base
WORKDIR /app
ENV PYTHONUNBUFFERED=1
ENV PYTHONDONTWRITEBYTECODE=1

RUN apt-get update && apt-get install -y --no-install-recommends curl && rm -rf /var/lib/apt/lists/*

COPY requirements*.txt ./
RUN pip install --no-cache-dir --upgrade -r requirements.txt || pip install fastapi uvicorn

COPY . .

EXPOSE ${port}
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "${port}"]`;
        break;

      case "go":
      case "golang":
        generatedDockerfile = `# Multi-stage Go Binary Dockerfile
FROM golang:1.22-alpine AS builder
WORKDIR /app
COPY go.mod go.sum* ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -o /app/server .

FROM alpine:latest AS runner
WORKDIR /app
RUN apk --no-cache add ca-certificates tzdata
COPY --from=builder /app/server /app/server
EXPOSE ${port}
CMD ["/app/server"]`;
        break;

      case "static":
      case "html":
        generatedDockerfile = `# Nginx Static Web Hosting
FROM nginx:alpine
COPY . /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]`;
        break;

      case "node":
      default:
        generatedDockerfile = `# Production Node.js Web Server Dockerfile
FROM node:${nodeVersion}-alpine AS base
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=${port}

COPY package*.json ./
RUN npm install --omit=dev

COPY . .

EXPOSE ${port}
USER node
CMD ["npm", "start"]`;
        break;
    }

    return NextResponse.json({
      success: true,
      framework,
      dockerfile: generatedDockerfile,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
