import { scryfall, ScryfallApiError } from "@/lib/scryfall/client";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q");
  const page = parseInt(searchParams.get("page") ?? "1", 10);

  if (!q) {
    return NextResponse.json({ error: "q param required" }, { status: 400 });
  }

  try {
    const result = await scryfall.search(q, page);
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof ScryfallApiError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
