"use client";
import { useEffect, useState } from "react";
import { CameraViewfinder } from "@/components/scanner/CameraViewfinder";
import { SearchBar } from "@/components/collection/SearchBar";
import { Button } from "@/components/ui/button";
import type { ScryfallCard } from "@/lib/scryfall/types";
import Image from "next/image";
import Link from "next/link";

const RARITY_DOT: Record<string, string> = {
  common:   "bg-zinc-400",
  uncommon: "bg-slate-300",
  rare:     "bg-yellow-500",
  mythic:   "bg-orange-500",
};

export default function ScanPage() {
  const [foundCard, setFoundCard]       = useState<ScryfallCard | null>(null);
  // The specific printing the user has selected (starts as foundCard)
  const [selectedCard, setSelectedCard] = useState<ScryfallCard | null>(null);
  const [added, setAdded]               = useState(false);
  const [adding, setAdding]             = useState(false);
  const [foil, setFoil]                 = useState(false);
  const [resumeFn, setResumeFn]         = useState<(() => void) | null>(null);

  // Set picker state
  const [printings, setPrintings]       = useState<ScryfallCard[]>([]);
  const [loadingPrints, setLoadingPrints] = useState(false);
  const [showPrints, setShowPrints]     = useState(false);

  const handleCardFound = (card: ScryfallCard, resume: () => void) => {
    setFoundCard(card);
    setSelectedCard(card);
    setAdded(false);
    setFoil(false);
    setShowPrints(false);
    setPrintings([]);
    setResumeFn(() => resume);
  };

  // Fetch all printings when the user taps "Change set"
  const handleShowPrints = async () => {
    if (!foundCard) return;
    setShowPrints(true);
    if (printings.length > 0) return; // already loaded

    setLoadingPrints(true);
    try {
      // !"Card Name" = exact name match, unique=prints = one result per printing
      const q = `!"${foundCard.name}"&unique=prints&order=released`;
      const res = await fetch(`/api/scryfall/search?q=${encodeURIComponent(q)}`);
      if (!res.ok) return;
      const data = await res.json();
      setPrintings(data.data ?? []);
    } finally {
      setLoadingPrints(false);
    }
  };

  const handleSelectPrinting = (card: ScryfallCard) => {
    setSelectedCard(card);
    setShowPrints(false);
  };

  const handleAdd = async () => {
    if (!selectedCard) return;
    setAdding(true);
    try {
      await fetch("/api/collection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scryfallId: selectedCard.id,
          cardName: selectedCard.name,
          setCode: selectedCard.set.toUpperCase(),
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
    setSelectedCard(null);
    setAdded(false);
    setShowPrints(false);
    setPrintings([]);
    resumeFn?.();
  };

  const card = selectedCard;
  const imageUri = card?.image_uris?.normal ?? card?.card_faces?.[0]?.image_uris?.normal;
  const price = foil ? card?.prices?.eur_foil : card?.prices?.eur;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Scan Card</h1>
        <p className="text-muted-foreground text-sm">
          Hold a card so the name sits inside the yellow bar.
        </p>
      </div>

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
        onSelect={(c) => handleCardFound(c, () => {})}
        placeholder="Type a card name…"
      />

      {/* ── Bottom sheet ── */}
      {card && (
        <>
          <div className="fixed inset-0 z-40 bg-black/50" onClick={handleDismiss} />

          <div className="fixed bottom-0 left-0 right-0 z-50 rounded-t-2xl bg-background border-t shadow-2xl max-w-lg mx-auto flex flex-col max-h-[85vh]">
            {/* Fixed header */}
            <div className="p-4 pb-0 flex flex-col gap-3">
              <div className="mx-auto h-1 w-10 rounded-full bg-muted shrink-0" />

              {/* Card summary */}
              <div className="flex gap-3 items-start">
                {imageUri && (
                  <Image
                    src={imageUri}
                    alt={card.name}
                    width={72}
                    height={100}
                    className="rounded-lg shrink-0 shadow"
                  />
                )}
                <div className="min-w-0 flex-1">
                  <h2 className="font-bold leading-tight">{card.name}</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">{card.type_line}</p>

                  {/* Selected printing */}
                  <div className="flex items-center gap-1.5 mt-1">
                    <span
                      className={`h-2 w-2 rounded-full shrink-0 ${RARITY_DOT[card.rarity] ?? "bg-zinc-400"}`}
                    />
                    <span className="text-xs font-medium">
                      {card.set_name}
                      <span className="text-muted-foreground ml-1">
                        #{card.collector_number}
                      </span>
                    </span>
                  </div>

                  {price ? (
                    <p className="text-sm font-semibold text-emerald-400 mt-1">
                      €{parseFloat(price).toFixed(2)}
                      {foil ? " ✨" : ""}
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground mt-1">No price data</p>
                  )}
                </div>
              </div>

              {/* Controls row */}
              <div className="flex items-center gap-3">
                {/* Foil toggle */}
                <label className="flex items-center gap-1.5 text-sm cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={foil}
                    onChange={(e) => setFoil(e.target.checked)}
                    className="rounded"
                  />
                  Foil ✨
                </label>

                <button
                  className="ml-auto text-xs text-primary underline-offset-2 hover:underline"
                  onClick={showPrints ? () => setShowPrints(false) : handleShowPrints}
                >
                  {showPrints ? "Hide sets" : "Change set"}
                </button>
              </div>
            </div>

            {/* Scrollable printings list */}
            {showPrints && (
              <div className="overflow-y-auto flex-1 px-4 pb-2 mt-2 border-t">
                {loadingPrints ? (
                  <p className="text-center text-sm text-muted-foreground py-4">
                    Loading printings…
                  </p>
                ) : (
                  <ul className="divide-y">
                    {printings.map((p) => {
                      const isSelected = p.id === card.id;
                      const eurPrice = foil ? p.prices.eur_foil : p.prices.eur;
                      return (
                        <li key={p.id}>
                          <button
                            className={`w-full flex items-center gap-3 py-2.5 text-left transition-colors hover:bg-accent rounded ${
                              isSelected ? "opacity-50 cursor-default" : ""
                            }`}
                            onClick={() => !isSelected && handleSelectPrinting(p)}
                            disabled={isSelected}
                          >
                            <span
                              className={`h-2 w-2 rounded-full shrink-0 ${RARITY_DOT[p.rarity] ?? "bg-zinc-400"}`}
                            />
                            <span className="flex-1 min-w-0">
                              <span className="block text-sm font-medium truncate">
                                {p.set_name}
                              </span>
                              <span className="block text-xs text-muted-foreground">
                                {p.set.toUpperCase()} · #{p.collector_number} · {p.released_at.slice(0, 4)}
                              </span>
                            </span>
                            {eurPrice ? (
                              <span className="text-sm font-medium text-emerald-400 shrink-0">
                                €{parseFloat(eurPrice).toFixed(2)}
                              </span>
                            ) : (
                              <span className="text-xs text-muted-foreground shrink-0">—</span>
                            )}
                            {isSelected && (
                              <span className="text-xs text-primary shrink-0">✓</span>
                            )}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            )}

            {/* Fixed footer — action buttons */}
            <div className="p-4 pt-3 border-t flex flex-col gap-2">
              {added ? (
                <>
                  <p className="text-center text-emerald-400 font-medium text-sm">
                    ✓ Added to collection!
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={() => { setAdded(false); handleAdd(); }}
                    >
                      + Another copy
                    </Button>
                    <Button className="flex-1" onClick={handleDismiss}>
                      Scan next ▶
                    </Button>
                  </div>
                  <Link href={`/card/${card.id}`}>
                    <Button variant="ghost" className="w-full text-xs text-muted-foreground">
                      View card details ↗
                    </Button>
                  </Link>
                </>
              ) : (
                <div className="flex gap-2">
                  <Button variant="outline" onClick={handleDismiss} className="shrink-0">
                    ✕
                  </Button>
                  <Button className="flex-1" onClick={handleAdd} disabled={adding}>
                    {adding ? "Adding…" : "Add to Collection"}
                  </Button>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
