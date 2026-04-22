import { scryfall, ScryfallApiError } from "@/lib/scryfall/client";
import { setCachedCard } from "@/lib/db/queries/cache";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const fuzzy = searchParams.get("fuzzy");
  const exact = searchParams.get("exact");

  if (!fuzzy && !exact) {
    return NextResponse.json(
      { error: "Provide fuzzy or exact query param" },
      { status: 400 }
    );
  }

  try {
    const card = fuzzy
      ? await scryfall.namedFuzzy(fuzzy)
      : await scryfall.namedExact(exact!);

    // Cache the result
    await setCachedCard(card).catch(() => {}); // don't fail on cache error

    return NextResponse.json(card);
  } catch (err) {
    if (err instanceof ScryfallApiError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
