import { scryfall, ScryfallApiError } from "@/lib/scryfall/client";
import type { ScryfallCollectionIdentifier } from "@/lib/scryfall/types";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const identifiers: ScryfallCollectionIdentifier[] = body.identifiers;

    if (!Array.isArray(identifiers) || identifiers.length === 0) {
      return NextResponse.json(
        { error: "identifiers array required" },
        { status: 400 }
      );
    }

    if (identifiers.length > 75) {
      return NextResponse.json(
        { error: "Maximum 75 identifiers per request" },
        { status: 400 }
      );
    }

    const result = await scryfall.collection(identifiers);
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof ScryfallApiError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
