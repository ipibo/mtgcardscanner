"use client"
import type { CollectionCard } from "@/lib/db/schema"
import { QuantityControl } from "./QuantityControl"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Trash2 } from "lucide-react"
import { useState } from "react"

interface CardRowProps {
  card: CollectionCard
  onUpdate: (id: string, qty: number) => Promise<void>
  onRemove: (id: string) => Promise<void>
}

const RARITY_COLORS: Record<string, string> = {
  common: "bg-zinc-600",
  uncommon: "bg-slate-400",
  rare: "bg-yellow-600",
  mythic: "bg-orange-500",
}

export function CardRow({ card, onUpdate, onRemove }: CardRowProps) {
  const [removing, setRemoving] = useState(false)

  const handleRemove = async () => {
    setRemoving(true)
    await onRemove(card.id)
    setRemoving(false)
  }

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
      <QuantityControl
        id={card.id}
        quantity={card.quantity}
        onUpdate={onUpdate}
      />
      <Button
        size="icon"
        variant="ghost"
        className="h-7 w-7 text-muted-foreground hover:text-destructive"
        disabled={removing}
        onClick={handleRemove}
        aria-label="Remove card"
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  )
}
