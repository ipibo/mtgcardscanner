import { eq } from "drizzle-orm";
import { db } from "../client";
import { cardCache } from "../schema";
import type { ScryfallCard } from "@/lib/scryfall/types";

const PRICE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

export async function getCachedCard(
  scryfallId: string
): Promise<ScryfallCard | null> {
  const cached = await db
    .select()
    .from(cardCache)
    .where(eq(cardCache.scryfallId, scryfallId))
    .get();

  if (!cached) return null;
  return JSON.parse(cached.data) as ScryfallCard;
}

export async function setCachedCard(card: ScryfallCard) {
  const now = new Date();
  await db
    .insert(cardCache)
    .values({
      scryfallId: card.id,
      data: JSON.stringify(card),
      cachedAt: now,
      pricesAt: now,
    })
    .onConflictDoUpdate({
      target: cardCache.scryfallId,
      set: {
        data: JSON.stringify(card),
        pricesAt: now,
      },
    });
}

export async function isPriceStale(scryfallId: string): Promise<boolean> {
  const cached = await db
    .select({ pricesAt: cardCache.pricesAt })
    .from(cardCache)
    .where(eq(cardCache.scryfallId, scryfallId))
    .get();

  if (!cached) return true;
  return Date.now() - cached.pricesAt.getTime() > PRICE_TTL_MS;
}
