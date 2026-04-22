import { getCachedCard, setCachedCard } from "@/lib/db/queries/cache";
import { scryfall } from "@/lib/scryfall/client";
import { PriceBadge } from "@/components/cards/PriceBadge";
import { Badge } from "@/components/ui/badge";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

interface CardPageProps {
  params: Promise<{ scryfallId: string }>;
}

const RARITY_COLORS: Record<string, string> = {
  common: "bg-zinc-600",
  uncommon: "bg-slate-400 text-black",
  rare: "bg-yellow-600",
  mythic: "bg-orange-500",
};

export default async function CardPage({ params }: CardPageProps) {
  const { scryfallId } = await params;

  // Try cache first
  let card = await getCachedCard(scryfallId).catch(() => null);

  if (!card) {
    try {
      card = await scryfall.byId(scryfallId);
      await setCachedCard(card).catch(() => {});
    } catch {
      notFound();
    }
  }

  if (!card) notFound();

  // Get image — handle double-faced cards
  const imageUri =
    card.image_uris?.normal ??
    card.card_faces?.[0]?.image_uris?.normal;

  const manaCost =
    card.mana_cost ?? card.card_faces?.[0]?.mana_cost;

  const oracleText =
    card.oracle_text ?? card.card_faces?.[0]?.oracle_text;

  return (
    <div className="flex flex-col gap-4">
      <Link href="/collection" className="text-sm text-muted-foreground hover:text-foreground">
        ← Back to collection
      </Link>

      {imageUri && (
        <div className="flex justify-center">
          <Image
            src={imageUri}
            alt={card.name}
            width={488}
            height={680}
            className="rounded-2xl w-full max-w-xs shadow-2xl"
            priority
          />
        </div>
      )}

      <div>
        <div className="flex items-start justify-between gap-2">
          <h1 className="text-xl font-bold">{card.name}</h1>
          {manaCost && (
            <span className="text-sm font-mono shrink-0">{manaCost}</span>
          )}
        </div>
        <p className="text-sm text-muted-foreground">{card.type_line}</p>
      </div>

      {/* Prices */}
      <div className="flex gap-2 flex-wrap">
        <div className="flex flex-col gap-1">
          <p className="text-xs text-muted-foreground">Regular</p>
          <PriceBadge prices={card.prices} foil={false} />
        </div>
        <div className="flex flex-col gap-1">
          <p className="text-xs text-muted-foreground">Foil</p>
          <PriceBadge prices={card.prices} foil={true} />
        </div>
      </div>

      {/* Set info */}
      <div className="flex gap-2 flex-wrap">
        <Badge variant="outline" className={RARITY_COLORS[card.rarity]}>
          {card.rarity}
        </Badge>
        <Badge variant="outline">
          {card.set_name} ({card.set.toUpperCase()})
        </Badge>
        {card.artist && (
          <Badge variant="secondary">🖌 {card.artist}</Badge>
        )}
      </div>

      {/* Oracle text */}
      {oracleText && (
        <div className="rounded-xl border bg-card p-4">
          <p className="text-sm whitespace-pre-line leading-relaxed">{oracleText}</p>
          {card.flavor_text && (
            <p className="mt-2 text-xs italic text-muted-foreground">
              {card.flavor_text}
            </p>
          )}
        </div>
      )}

      {/* Scryfall link */}
      <a
        href={card.scryfall_uri}
        target="_blank"
        rel="noopener noreferrer"
        className="text-xs text-muted-foreground hover:text-foreground text-center"
      >
        View on Scryfall ↗
      </a>
    </div>
  );
}
