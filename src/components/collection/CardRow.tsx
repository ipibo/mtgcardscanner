"use client";
import type { CollectionCard } from "@/lib/db/schema";
import { QuantityControl } from "./QuantityControl";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";

interface CardRowProps {
  card: CollectionCard;
  onUpdate: (id: string, qty: number) => Promise<void>;
}

const RARITY_COLORS: Record<string, string> = {
  common: "bg-zinc-600",
  uncommon: "bg-slate-400",
  rare: "bg-yellow-600",
  mythic: "bg-orange-500",
};

export function CardRow({ card, onUpdate }: CardRowProps) {
  return (
    <div className="flex items-center gap-3 border-b py-2 last:border-0">
      <Link
        href={`/card/${card.scryfallId}`}
        className="min-w-0 flex-1 hover:underline"
      >
        <p className="truncate font-medium text-sm">{card.cardName}</p>
        <p className="text-xs text-muted-foreground uppercase tracking-wide">
          {card.setCode}
          {card.foil && " · Foil ✨"}
        </p>
      </Link>
      <QuantityControl id={card.id} quantity={card.quantity} onUpdate={onUpdate} />
    </div>
  );
}
