"use client";
import { useState } from "react";
import { CameraViewfinder } from "@/components/scanner/CameraViewfinder";
import { SearchBar } from "@/components/collection/SearchBar";
import { Button } from "@/components/ui/button";
import type { ScryfallCard } from "@/lib/scryfall/types";
import Image from "next/image";
import Link from "next/link";

export default function ScanPage() {
  const [foundCard, setFoundCard]   = useState<ScryfallCard | null>(null);
  const [added, setAdded]           = useState(false);
  const [adding, setAdding]         = useState(false);
  const [foil, setFoil]             = useState(false);
  // viewfinder resume callback — set by the CameraViewfinder
  const [resumeFn, setResumeFn]     = useState<(() => void) | null>(null);

  const handleCardFound = (card: ScryfallCard, resume: () => void) => {
    setFoundCard(card);
    setAdded(false);
    setFoil(false);
    setResumeFn(() => resume);
  };

  const handleAdd = async () => {
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
          quantity: 1,
          foil,
        }),
      });
      setAdded(true);
    } finally {
      setAdding(false);
    }
  };

  const handleDismiss = () => {
    setFoundCard(null);
    setAdded(false);
    resumeFn?.();
  };

  const imageUri =
    foundCard?.image_uris?.normal ??
    foundCard?.card_faces?.[0]?.image_uris?.normal;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Scan Card</h1>
        <p className="text-muted-foreground text-sm">
          Hold a card so the name sits inside the yellow bar.
        </p>
      </div>

      {/* Viewfinder — always mounted so the camera never restarts */}
      <CameraViewfinder onCardFound={handleCardFound} />

      {/* Manual search — always visible below the viewfinder */}
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
        onSelect={(card) => handleCardFound(card, () => {})}
        placeholder="Type a card name…"
      />

      {/* ── Card confirmation — bottom sheet slides in when a card is found ── */}
      {foundCard && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40 bg-black/50"
            onClick={handleDismiss}
          />

          {/* Sheet */}
          <div className="fixed bottom-0 left-0 right-0 z-50 rounded-t-2xl bg-background border-t p-4 pb-8 flex flex-col gap-3 max-w-lg mx-auto shadow-2xl">
            {/* Drag handle */}
            <div className="mx-auto h-1 w-10 rounded-full bg-muted" />

            <div className="flex gap-3 items-start">
              {imageUri && (
                <Image
                  src={imageUri}
                  alt={foundCard.name}
                  width={80}
                  height={112}
                  className="rounded-lg shrink-0 shadow"
                />
              )}
              <div className="min-w-0 flex-1">
                <h2 className="font-bold leading-tight">{foundCard.name}</h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {foundCard.set_name}
                </p>
                <p className="text-xs text-muted-foreground">{foundCard.type_line}</p>
                {foundCard.prices.eur && (
                  <p className="text-sm font-semibold text-emerald-400 mt-1">
                    €{parseFloat(foundCard.prices.eur).toFixed(2)}
                    {foil && foundCard.prices.eur_foil
                      ? ` · foil €${parseFloat(foundCard.prices.eur_foil).toFixed(2)}`
                      : ""}
                  </p>
                )}
              </div>
            </div>

            {/* Foil toggle */}
            <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
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
                <p className="text-center text-emerald-400 font-medium text-sm">
                  ✓ Added to collection!
                </p>
                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1" onClick={() => { setAdded(false); handleAdd(); }}>
                    + Another copy
                  </Button>
                  <Button className="flex-1" onClick={handleDismiss}>
                    Scan next ▶
                  </Button>
                </div>
                <Link href={`/card/${foundCard.id}`}>
                  <Button variant="ghost" className="w-full text-xs text-muted-foreground">
                    View card details ↗
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="flex gap-2">
                <Button variant="outline" onClick={handleDismiss} className="shrink-0">
                  ✕
                </Button>
                <Button
                  className="flex-1"
                  onClick={handleAdd}
                  disabled={adding}
                >
                  {adding ? "Adding…" : "Add to Collection"}
                </Button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
