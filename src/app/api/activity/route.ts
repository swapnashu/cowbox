import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auditLogs, deployments } from "@/lib/db/schema";
import { desc } from "drizzle-orm";

export async function GET() {
  try {
    const recentAuditLogs = await db.select().from(auditLogs).orderBy(desc(auditLogs.createdAt)).limit(30);
    const recentDeployments = await db.select().from(deployments).orderBy(desc(deployments.createdAt)).limit(30);

    const merged = [
      ...recentAuditLogs.map(a => ({
        id: a.id,
        type: 'audit' as const,
        action: a.action,
        title: a.details || 'Audit Event',
        status: 'success',
        entityType: a.entityType,
        entityId: a.entityId,
        createdAt: a.createdAt,
      })),
      ...recentDeployments.map(d => ({
        id: d.id,
        type: 'deployment' as const,
        action: 'deploy',
        title: d.title || `Deployment ${d.id.substring(0, 8)}`,
        status: d.status,
        entityType: 'application',
        entityId: d.applicationId,
        createdAt: d.createdAt,
      }))
    ];

    merged.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return NextResponse.json({ activities: merged.slice(0, 30) });
  } catch (error) {
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
