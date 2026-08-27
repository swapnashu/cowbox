import { NextResponse } from "next/server";
import { db, initializeDatabase } from "@/lib/db";
import { domains, applications } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import crypto from "crypto";

export async function GET(req: Request) {
  try {
    await initializeDatabase();
    const { searchParams } = new URL(req.url);
    const applicationId = searchParams.get("applicationId");

    if (!applicationId) {
      const allDomains = await db.select().from(domains);
      return NextResponse.json({ domains: allDomains });
    }

    const appDomains = await db
      .select()
      .from(domains)
      .where(eq(domains.applicationId, applicationId));

    return NextResponse.json({ domains: appDomains });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    await initializeDatabase();
    const { applicationId, domain: rawDomain, https = true, certificateResolver = "letsencrypt", pathPrefix = "/" } = await req.json();

    if (!applicationId || !rawDomain) {
      return NextResponse.json({ error: "Application ID and domain name are required" }, { status: 400 });
    }

    const cleanDomain = rawDomain.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/$/, "");

    // Check if domain already attached to this application
    const existing = await db
      .select()
      .from(domains)
      .where(eq(domains.domain, cleanDomain));

    if (existing.length > 0 && existing[0].applicationId === applicationId) {
      return NextResponse.json({ error: "Domain already attached to this application" }, { status: 400 });
    }

    const newDomainId = crypto.randomUUID();
    await db.insert(domains).values({
      id: newDomainId,
      applicationId,
      domain: cleanDomain,
      https: https ? true : false,
      certificateResolver: https ? certificateResolver : "none",
      pathPrefix,
    });

    const [created] = await db.select().from(domains).where(eq(domains.id, newDomainId));
    return NextResponse.json({ success: true, domain: created });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
