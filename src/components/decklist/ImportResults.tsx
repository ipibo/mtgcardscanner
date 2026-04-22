import { Badge } from "@/components/ui/badge";
import type { ScryfallCard } from "@/lib/scryfall/types";

export interface ImportResultEntry {
  name: string;
  needed: number;
  owned: number;
  card: ScryfallCard | null;
  notFound?: boolean;
}

interface ImportResultsProps {
  results: ImportResultEntry[];
}

function statusLabel(entry: ImportResultEntry) {
  if (entry.notFound) return "unknown";
  if (entry.owned >= entry.needed) return "have";
  if (entry.owned > 0) return "short";
  return "missing";
}

export function ImportResults({ results }: ImportResultsProps) {
  const have = results.filter((r) => statusLabel(r) === "have");
  const short = results.filter((r) => statusLabel(r) === "short");
  const missing = results.filter((r) => statusLabel(r) === "missing");
  const unknown = results.filter((r) => statusLabel(r) === "unknown");

  const missingCost = missing.reduce((sum, r) => {
    if (!r.card?.prices?.eur) return sum;
    return sum + parseFloat(r.card.prices.eur) * (r.needed - r.owned);
  }, 0);

  const shortCost = short.reduce((sum, r) => {
    if (!r.card?.prices?.eur) return sum;
    return sum + parseFloat(r.card.prices.eur) * (r.needed - r.owned);
  }, 0);

  return (
    <div className="flex flex-col gap-4">
      {/* Summary */}
      <div className="grid grid-cols-3 gap-2 text-center text-sm">
        <div className="rounded-lg bg-emerald-950 p-2">
          <p className="text-2xl font-bold text-emerald-400">{have.length}</p>
          <p className="text-emerald-300">Have</p>
        </div>
        <div className="rounded-lg bg-yellow-950 p-2">
          <p className="text-2xl font-bold text-yellow-400">{short.length}</p>
          <p className="text-yellow-300">Short</p>
        </div>
        <div className="rounded-lg bg-red-950 p-2">
          <p className="text-2xl font-bold text-red-400">{missing.length}</p>
          <p className="text-red-300">Missing</p>
        </div>
      </div>

      {(missingCost > 0 || shortCost > 0) && (
        <p className="text-center text-sm text-muted-foreground">
          Estimated cost to complete:{" "}
          <span className="font-semibold text-foreground">
            €{(missingCost + shortCost).toFixed(2)}
          </span>
        </p>
      )}

      {/* Missing */}
      {missing.length > 0 && (
        <Section title="Missing" color="red">
          {missing.map((r) => (
            <ResultRow key={r.name} entry={r} />
          ))}
        </Section>
      )}

      {/* Short */}
      {short.length > 0 && (
        <Section title="Need More" color="yellow">
          {short.map((r) => (
            <ResultRow key={r.name} entry={r} />
          ))}
        </Section>
      )}

      {/* Have */}
      {have.length > 0 && (
        <Section title="Have" color="green">
          {have.map((r) => (
            <ResultRow key={r.name} entry={r} />
          ))}
        </Section>
      )}

      {unknown.length > 0 && (
        <Section title="Not Found" color="gray">
          {unknown.map((r) => (
            <ResultRow key={r.name} entry={r} />
          ))}
        </Section>
      )}
    </div>
  );
}

function Section({
  title,
  color,
  children,
}: {
  title: string;
  color: "red" | "yellow" | "green" | "gray";
  children: React.ReactNode;
}) {
  const colors = {
    red: "text-red-400",
    yellow: "text-yellow-400",
    green: "text-emerald-400",
    gray: "text-muted-foreground",
  };
  return (
    <div>
      <h3 className={`text-sm font-semibold mb-1 ${colors[color]}`}>{title}</h3>
      <div className="divide-y rounded-md border">
        {children}
      </div>
    </div>
  );
}

function ResultRow({ entry }: { entry: ImportResultEntry }) {
  const need = entry.needed - entry.owned;
  const price = entry.card?.prices?.eur
    ? parseFloat(entry.card.prices.eur)
    : null;

  return (
    <div className="flex items-center justify-between px-3 py-2 text-sm">
      <span className="min-w-0 flex-1 truncate">{entry.name}</span>
      <span className="ml-2 text-xs text-muted-foreground shrink-0">
        {entry.owned}/{entry.needed}
      </span>
      {price !== null && need > 0 && (
        <span className="ml-2 text-xs text-muted-foreground shrink-0">
          €{(price * need).toFixed(2)}
        </span>
      )}
    </div>
  );
}
