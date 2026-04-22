"use client";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { CardRow } from "@/components/collection/CardRow";
import { SearchBar } from "@/components/collection/SearchBar";
import { useCollection } from "@/hooks/useCollection";
import type { ScryfallCard } from "@/lib/scryfall/types";

export default function CollectionPage() {
  const [search, setSearch] = useState("");
  const { cards, loading, error, addCard, updateQuantity } = useCollection(search);

  const handleAddCard = async (card: ScryfallCard) => {
    await addCard({
      scryfallId: card.id,
      cardName: card.name,
      setCode: card.set.toUpperCase(),
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Collection</h1>
        <p className="text-muted-foreground text-sm">
          {cards.length} card{cards.length !== 1 ? "s" : ""}
          {search ? ` matching "${search}"` : ""}
        </p>
      </div>

      {/* Add card */}
      <div>
        <p className="text-xs text-muted-foreground mb-1">Add a card</p>
        <SearchBar onSelect={handleAddCard} />
      </div>

      {/* Search existing */}
      <Input
        placeholder="Filter collection…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="text-base"
      />

      {/* Cards list */}
      {loading && (
        <div className="text-center text-sm text-muted-foreground py-8">
          Loading…
        </div>
      )}

      {error && (
        <div className="text-center text-sm text-destructive py-4">{error}</div>
      )}

      {!loading && cards.length === 0 && (
        <div className="text-center text-sm text-muted-foreground py-12">
          {search
            ? `No cards found for "${search}"`
            : "No cards yet. Scan or search to add your first card."}
        </div>
      )}

      {!loading && cards.length > 0 && (
        <div className="rounded-xl border bg-card px-4">
          {cards.map((card) => (
            <CardRow key={card.id} card={card} onUpdate={updateQuantity} />
          ))}
        </div>
      )}
    </div>
  );
}
