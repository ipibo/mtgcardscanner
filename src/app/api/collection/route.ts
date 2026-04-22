import { addCard, getCollectionCards } from "@/lib/db/queries/collection";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const search = new URL(req.url).searchParams.get("search") ?? undefined;
  try {
    const cards = await getCollectionCards(search);
    return NextResponse.json(cards);
  } catch (err) {
    console.error("GET /api/collection:", err);
    return NextResponse.json({ error: "Failed to fetch collection" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { scryfallId, cardName, setCode, quantity, foil } = body;

    if (!scryfallId || !cardName || !setCode) {
      return NextResponse.json(
        { error: "scryfallId, cardName, setCode required" },
        { status: 400 }
      );
    }

    const card = await addCard({ scryfallId, cardName, setCode, quantity, foil });
    return NextResponse.json(card, { status: 201 });
  } catch (err) {
    console.error("POST /api/collection:", err);
    return NextResponse.json({ error: "Failed to add card" }, { status: 500 });
  }
}
