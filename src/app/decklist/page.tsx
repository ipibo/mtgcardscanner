"use client";
import { useState } from "react";
import { DecklistInput } from "@/components/decklist/DecklistInput";
import {
  ImportResults,
  type ImportResultEntry,
} from "@/components/decklist/ImportResults";
import { parseDeckList, type DecklistEntry } from "@/lib/decklist/parser";
import { chunk } from "@/lib/scryfall/client";
import type { ScryfallCard } from "@/lib/scryfall/types";

export default function DecklistPage() {
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<ImportResultEntry[] | null>(null);

  const handleParsed = async (entries: DecklistEntry[]) => {
    setLoading(true);
    setResults(null);

    try {
      // 1. Fetch all cards from Scryfall in batches of 75
      const identifiers = entries.map((e) => ({
        name: e.name,
        ...(e.set ? { set: e.set.toLowerCase() } : {}),
      }));

      const batches = chunk(identifiers, 75);
      const scryfallCards = new Map<string, ScryfallCard>();
      const notFound = new Set<string>();

      for (const batch of batches) {
        const res = await fetch("/api/scryfall/collection", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ identifiers: batch }),
        });

        if (!res.ok) continue;

        const data = await res.json();

        for (const card of data.data ?? []) {
          scryfallCards.set(card.name.toLowerCase(), card);
        }
        for (const nf of data.not_found ?? []) {
          if (nf.name) notFound.add(nf.name.toLowerCase());
        }

        // Rate limit between batches
        if (batches.length > 1) await new Promise((r) => setTimeout(r, 120));
      }

      // 2. Fetch owned card names from our collection
      const collRes = await fetch("/api/collection");
      const ownedCards: Array<{ cardName: string; quantity: number }> =
        collRes.ok ? await collRes.json() : [];

      // Build owned map: lowercase name -> total quantity
      const ownedMap = new Map<string, number>();
      for (const c of ownedCards) {
        const key = c.cardName.toLowerCase();
        ownedMap.set(key, (ownedMap.get(key) ?? 0) + c.quantity);
      }

      // 3. Build results
      const resultEntries: ImportResultEntry[] = entries.map((entry) => {
        const key = entry.name.toLowerCase();
        const card = scryfallCards.get(key) ?? null;
        const owned = ownedMap.get(key) ?? 0;

        return {
          name: entry.name,
          needed: entry.quantity,
          owned,
          card,
          notFound: notFound.has(key),
        };
      });

      setResults(resultEntries);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Decklist Import</h1>
        <p className="text-muted-foreground text-sm">
          Paste a decklist to see what you own and what you need.
        </p>
      </div>

      <DecklistInput onParsed={handleParsed} loading={loading} />

      {loading && (
        <div className="text-center text-sm text-muted-foreground py-8">
          Checking your collection…
        </div>
      )}

      {results && !loading && <ImportResults results={results} />}
    </div>
  );
}
