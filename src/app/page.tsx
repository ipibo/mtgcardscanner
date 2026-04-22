import { getCollectionStats } from "@/lib/db/queries/collection";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const stats = await getCollectionStats().catch(() => ({
    totalCards: 0,
    uniqueCards: 0,
  }));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">MTG Collection</h1>
        <p className="text-muted-foreground text-sm">Your personal card manager</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3">
        <StatCard label="Total Cards" value={stats.totalCards ?? 0} />
        <StatCard label="Unique Cards" value={stats.uniqueCards ?? 0} />
      </div>

      {/* Quick actions */}
      <div className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          Quick Actions
        </h2>
        <ActionLink href="/scan" icon="📷" label="Scan a Card" description="Use your camera to scan a card" />
        <ActionLink href="/collection" icon="📚" label="Browse Collection" description="Search and manage your cards" />
        <ActionLink href="/decklist" icon="📋" label="Import Decklist" description="Check which cards you own" />
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border bg-card p-4 text-card-foreground">
      <p className="text-3xl font-bold">{value.toLocaleString()}</p>
      <p className="text-sm text-muted-foreground">{label}</p>
    </div>
  );
}

function ActionLink({
  href,
  icon,
  label,
  description,
}: {
  href: string;
  icon: string;
  label: string;
  description: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 rounded-xl border bg-card p-4 hover:bg-accent transition-colors"
    >
      <span className="text-2xl">{icon}</span>
      <div>
        <p className="font-medium text-sm">{label}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <span className="ml-auto text-muted-foreground">›</span>
    </Link>
  );
}
