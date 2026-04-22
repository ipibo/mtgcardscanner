import { deleteCard, updateCardQuantity } from "@/lib/db/queries/collection";
import { NextRequest, NextResponse } from "next/server";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const { quantity } = await req.json();
    if (typeof quantity !== "number") {
      return NextResponse.json({ error: "quantity (number) required" }, { status: 400 });
    }
    const result = await updateCardQuantity(id, quantity);
    return NextResponse.json(result ?? { deleted: true });
  } catch (err) {
    console.error("PATCH /api/collection/[id]:", err);
    return NextResponse.json({ error: "Failed to update card" }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    await deleteCard(id);
    return NextResponse.json({ deleted: true });
  } catch (err) {
    console.error("DELETE /api/collection/[id]:", err);
    return NextResponse.json({ error: "Failed to delete card" }, { status: 500 });
  }
}
