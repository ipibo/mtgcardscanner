import type { ScryfallPrices } from "@/lib/scryfall/types";
import { Badge } from "@/components/ui/badge";

interface PriceBadgeProps {
  prices: ScryfallPrices;
  foil?: boolean;
  className?: string;
}

export function PriceBadge({ prices, foil = false, className }: PriceBadgeProps) {
  const price = foil ? prices.eur_foil : prices.eur;

  if (!price) {
    return (
      <Badge variant="secondary" className={className}>
        No price
      </Badge>
    );
  }

  return (
    <Badge
      className={`bg-emerald-700 text-white hover:bg-emerald-600 ${className ?? ""}`}
    >
      €{parseFloat(price).toFixed(2)}
      {foil && " ✨"}
    </Badge>
  );
}
