import { NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { sql } from "drizzle-orm";

export async function GET() {
  const url = process.env.TURSO_DATABASE_URL ?? "(not set)";
  const hasToken = !!process.env.TURSO_AUTH_TOKEN;

  try {
    // Try a simple query
    await db.run(sql`SELECT 1`);
    return NextResponse.json({
      ok: true,
      db: url,
      hasToken,
    });
  } catch (err) {
    return NextResponse.json({
      ok: false,
      db: url,
      hasToken,
      error: err instanceof Error ? err.message : String(err),
    }, { status: 500 });
  }
}
