import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { gameSaves } from "@/db/schema";

export const dynamic = "force-dynamic";

const okId = (v: unknown): v is string => typeof v === "string" && v.length >= 8 && v.length <= 80;
const okSlot = (v: unknown): v is number => typeof v === "number" && Number.isInteger(v) && v >= 0 && v <= 9;

/** GET /api/saves?clientId=..            → список слотов (без данных)
 *  GET /api/saves?clientId=..&slot=N     → данные слота */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const clientId = url.searchParams.get("clientId");
  if (!okId(clientId)) return NextResponse.json({ error: "bad client" }, { status: 400 });
  try {
    const slotParam = url.searchParams.get("slot");
    if (slotParam !== null) {
      const slot = Number(slotParam);
      if (!okSlot(slot)) return NextResponse.json({ error: "bad slot" }, { status: 400 });
      const rows = await db
        .select()
        .from(gameSaves)
        .where(and(eq(gameSaves.clientId, clientId), eq(gameSaves.slot, slot)))
        .limit(1);
      if (!rows[0]) return NextResponse.json({ error: "not found" }, { status: 404 });
      return NextResponse.json({ slot, data: rows[0].data, summary: rows[0].summary, updatedAt: rows[0].updatedAt });
    }
    const rows = await db
      .select({ slot: gameSaves.slot, summary: gameSaves.summary, updatedAt: gameSaves.updatedAt })
      .from(gameSaves)
      .where(eq(gameSaves.clientId, clientId));
    return NextResponse.json({ saves: rows });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const body = (await req.json()) as { clientId?: unknown; slot?: unknown; data?: unknown; summary?: unknown };
    if (!okId(body.clientId) || !okSlot(body.slot) || typeof body.data !== "object" || body.data === null) {
      return NextResponse.json({ error: "bad request" }, { status: 400 });
    }
    const summary = (typeof body.summary === "object" && body.summary) || {};
    const now = new Date();
    await db
      .insert(gameSaves)
      .values({ clientId: body.clientId, slot: body.slot, data: body.data, summary, updatedAt: now })
      .onConflictDoUpdate({
        target: [gameSaves.clientId, gameSaves.slot],
        set: { data: body.data, summary, updatedAt: now },
      });
    return NextResponse.json({ ok: true, updatedAt: now });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const url = new URL(req.url);
  const clientId = url.searchParams.get("clientId");
  const slot = Number(url.searchParams.get("slot"));
  if (!okId(clientId) || !okSlot(slot)) return NextResponse.json({ error: "bad request" }, { status: 400 });
  try {
    await db.delete(gameSaves).where(and(eq(gameSaves.clientId, clientId), eq(gameSaves.slot, slot)));
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
