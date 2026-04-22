"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { parseDeckList, type DecklistEntry } from "@/lib/decklist/parser";

interface DecklistInputProps {
  onParsed: (entries: DecklistEntry[]) => void;
  loading?: boolean;
}

const EXAMPLE = `4 Lightning Bolt
4 Monastery Swiftspear
4 Goblin Guide
4 Eidolon of the Great Revel
4 Light Up the Stage

Sideboard:
2 Shattering Spree
2 Roiling Vortex`;

export function DecklistInput({ onParsed, loading }: DecklistInputProps) {
  const [text, setText] = useState("");

  const handleSubmit = () => {
    const entries = parseDeckList(text);
    if (entries.length > 0) onParsed(entries);
  };

  return (
    <div className="flex flex-col gap-3">
      <textarea
        className="min-h-[200px] w-full rounded-md border bg-background px-3 py-2 text-sm font-mono resize-none focus:outline-none focus:ring-2 focus:ring-ring"
        placeholder={EXAMPLE}
        value={text}
        onChange={(e) => setText(e.target.value)}
        spellCheck={false}
      />
      <div className="flex gap-2">
        <Button
          className="flex-1"
          onClick={handleSubmit}
          disabled={loading || text.trim().length === 0}
        >
          {loading ? "Checking…" : "Check Collection"}
        </Button>
        <Button
          variant="outline"
          onClick={() => setText(EXAMPLE)}
        >
          Example
        </Button>
      </div>
    </div>
  );
}
