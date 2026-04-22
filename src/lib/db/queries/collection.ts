import { and, desc, eq, like, sql } from "drizzle-orm";
import { nanoid } from "nanoid";
import { db } from "../client";
import { cardCache, collectionCards, collections } from "../schema";

const DEFAULT_COLLECTION_ID = "local-collection";

export async function ensureDefaultCollection() {
  const existing = await db
    .select()
    .from(collections)
    .where(eq(collections.id, DEFAULT_COLLECTION_ID))
    .get();

  if (!existing) {
    await db.insert(collections).values({
      id: DEFAULT_COLLECTION_ID,
      userId: "local",
    });
  }

  return DEFAULT_COLLECTION_ID;
}

export async function getCollectionCards(search?: string) {
  const collectionId = await ensureDefaultCollection();

  const query = db
    .select()
    .from(collectionCards)
    .where(
      search
        ? and(
            eq(collectionCards.collectionId, collectionId),
            like(collectionCards.cardName, `%${search}%`)
          )
        : eq(collectionCards.collectionId, collectionId)
    )
    .orderBy(desc(collectionCards.addedAt));

  return query.all();
}

export async function addCard({
  scryfallId,
  cardName,
  setCode,
  quantity = 1,
  foil = false,
}: {
  scryfallId: string;
  cardName: string;
  setCode: string;
  quantity?: number;
  foil?: boolean;
}) {
  const collectionId = await ensureDefaultCollection();

  // Check if this exact printing already exists
  const existing = await db
    .select()
    .from(collectionCards)
    .where(
      and(
        eq(collectionCards.collectionId, collectionId),
        eq(collectionCards.scryfallId, scryfallId),
        eq(collectionCards.foil, foil)
      )
    )
    .get();

  if (existing) {
    // Increment quantity
    await db
      .update(collectionCards)
      .set({ quantity: existing.quantity + quantity })
      .where(eq(collectionCards.id, existing.id));
    return { ...existing, quantity: existing.quantity + quantity };
  }

  const newCard = {
    id: nanoid(),
    collectionId,
    scryfallId,
    cardName,
    setCode,
    quantity,
    foil,
  };

  await db.insert(collectionCards).values(newCard);
  return newCard;
}

export async function updateCardQuantity(id: string, quantity: number) {
  if (quantity <= 0) {
    await db.delete(collectionCards).where(eq(collectionCards.id, id));
    return null;
  }
  await db
    .update(collectionCards)
    .set({ quantity })
    .where(eq(collectionCards.id, id));
  return { id, quantity };
}

export async function deleteCard(id: string) {
  await db.delete(collectionCards).where(eq(collectionCards.id, id));
}

export async function getOwnedScryfallIds(): Promise<
  Map<string, { quantity: number; foil: boolean }>
> {
  const collectionId = await ensureDefaultCollection();
  const cards = await db
    .select()
    .from(collectionCards)
    .where(eq(collectionCards.collectionId, collectionId))
    .all();

  const map = new Map<string, { quantity: number; foil: boolean }>();
  for (const c of cards) {
    map.set(c.scryfallId, { quantity: c.quantity, foil: c.foil });
  }
  return map;
}

export async function getCollectionStats() {
  const collectionId = await ensureDefaultCollection();
  const result = await db
    .select({
      totalCards: sql<number>`sum(${collectionCards.quantity})`,
      uniqueCards: sql<number>`count(*)`,
    })
    .from(collectionCards)
    .where(eq(collectionCards.collectionId, collectionId))
    .get();

  return result ?? { totalCards: 0, uniqueCards: 0 };
}
