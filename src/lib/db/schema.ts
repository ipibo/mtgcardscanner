import { sql } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const collections = sqliteTable("collections", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().default("local"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

export const collectionCards = sqliteTable("collection_cards", {
  id: text("id").primaryKey(),
  collectionId: text("collection_id")
    .notNull()
    .references(() => collections.id, { onDelete: "cascade" }),
  scryfallId: text("scryfall_id").notNull(),
  cardName: text("card_name").notNull(),
  setCode: text("set_code").notNull(),
  quantity: integer("quantity").notNull().default(1),
  foil: integer("foil", { mode: "boolean" }).notNull().default(false),
  addedAt: integer("added_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

export const cardCache = sqliteTable("card_cache", {
  scryfallId: text("scryfall_id").primaryKey(),
  data: text("data").notNull(), // full Scryfall JSON blob
  cachedAt: integer("cached_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
  pricesAt: integer("prices_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

export type Collection = typeof collections.$inferSelect;
export type CollectionCard = typeof collectionCards.$inferSelect;
export type CardCache = typeof cardCache.$inferSelect;
