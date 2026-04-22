"use client";
import { useState } from "react";
import { CameraViewfinder } from "@/components/scanner/CameraViewfinder";
import { SearchBar } from "@/components/collection/SearchBar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { ScryfallCard } from "@/lib/scryfall/types";
import Image from "next/image";
import Link from "next/link";

export default function ScanPage() {
  const [foundCard, setFoundCard] = useState<ScryfallCard | null>(null);
  const [added, setAdded] = useState(false);
  const [adding, setAdding] = useState(false);
  const [foil, setFoil] = useState(false);

  const handleCardFound = (card: ScryfallCard) => {
    setFoundCard(card);
    setAdded(false);
    setFoil(false);
  };

  const handleAdd = async (qty: number = 1) => {
    if (!foundCard) return;
    setAdding(true);
    try {
      await fetch("/api/collection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scryfallId: foundCard.id,
          cardName: foundCard.name,
          setCode: foundCard.set.toUpperCase(),
          quantity: qty,
          foil,
        }),
      });
      setAdded(true);
    } finally {
      setAdding(false);
    }
  };

  const handleReset = () => {
    setFoundCard(null);
    setAdded(false);
  };

  const imageUri =
    foundCard?.image_uris?.normal ??
    foundCard?.card_faces?.[0]?.image_uris?.normal;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Scan Card</h1>
        <p className="text-muted-foreground text-sm">
          Point your camera at a card, align the name, then tap Scan.
        </p>
      </div>

      {!foundCard ? (
        <>
          <CameraViewfinder onCardFound={handleCardFound} />

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center">
              <span className="bg-background px-2 text-xs text-muted-foreground">
                or search manually
              </span>
            </div>
          </div>

          <SearchBar
            onSelect={handleCardFound}
            placeholder="Type a card name…"
          />
        </>
      ) : (
        <div className="flex flex-col gap-4">
          {imageUri && (
            <div className="flex justify-center">
              <Image
                src={imageUri}
                alt={foundCard.name}
                width={488}
                height={680}
                className="rounded-2xl w-full max-w-xs shadow-2xl"
                priority
              />
            </div>
          )}

          <div>
            <h2 className="text-lg font-bold">{foundCard.name}</h2>
            <p className="text-sm text-muted-foreground">
              {foundCard.set_name} · {foundCard.type_line}
            </p>
            {foundCard.prices.eur && (
              <p className="text-sm font-medium text-emerald-400 mt-1">
                €{parseFloat(foundCard.prices.eur).toFixed(2)}
                {foil && foundCard.prices.eur_foil
                  ? ` · foil €${parseFloat(foundCard.prices.eur_foil).toFixed(2)}`
                  : ""}
              </p>
            )}
          </div>

          {/* Foil toggle */}
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={foil}
              onChange={(e) => setFoil(e.target.checked)}
              className="rounded"
            />
            Foil ✨
          </label>

          {added ? (
            <div className="flex flex-col gap-2">
              <p className="text-center text-emerald-400 font-medium">
                ✓ Added to collection!
              </p>
              <div className="flex gap-2">
                <Button className="flex-1" onClick={() => handleAdd(1)} variant="outline">
                  Add another copy
                </Button>
                <Button className="flex-1" onClick={handleReset}>
                  Scan next card
                </Button>
              </div>
              <Link href={`/card/${foundCard.id}`}>
                <Button variant="ghost" className="w-full text-sm">
                  View card details
                </Button>
              </Link>
            </div>
          ) : (
            <div className="flex gap-2">
              <Button
                className="flex-1"
                onClick={() => handleAdd(1)}
                disabled={adding}
              >
                {adding ? "Adding…" : "Add to Collection"}
              </Button>
              <Button variant="outline" onClick={handleReset}>
                Cancel
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
