import { scryfall, ScryfallApiError } from "@/lib/scryfall/client";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const q = new URL(req.url).searchParams.get("q");
  if (!q || q.length < 2) {
    return NextResponse.json({ data: [] });
  }

  try {
    const result = await scryfall.autocomplete(q);
    return NextResponse.json(result, {
      headers: { "Cache-Control": "s-maxage=60" },
    });
  } catch (err) {
    if (err instanceof ScryfallApiError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
