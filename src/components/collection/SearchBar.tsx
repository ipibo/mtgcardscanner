"use client";
import { Input } from "@/components/ui/input";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ScryfallCard } from "@/lib/scryfall/types";

interface SearchBarProps {
  onSelect: (card: ScryfallCard) => void;
  placeholder?: string;
}

export function SearchBar({
  onSelect,
  placeholder = "Search for a card…",
}: SearchBarProps) {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchSuggestions = useCallback(async (q: string) => {
    if (q.length < 2) {
      setSuggestions([]);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/scryfall/autocomplete?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      setSuggestions(data.data ?? []);
      setOpen(true);
    } catch {
      setSuggestions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchSuggestions(query), 250);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, fetchSuggestions]);

  const selectCard = async (name: string) => {
    setOpen(false);
    setQuery(name);
    try {
      const res = await fetch(
        `/api/scryfall/named?exact=${encodeURIComponent(name)}`
      );
      if (!res.ok) return;
      const card: ScryfallCard = await res.json();
      onSelect(card);
      setQuery("");
    } catch {
      // silently ignore
    }
  };

  return (
    <div className="relative">
      <Input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={placeholder}
        className="text-base"
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onFocus={() => suggestions.length > 0 && setOpen(true)}
      />
      {loading && (
        <div className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
          …
        </div>
      )}
      {open && suggestions.length > 0 && (
        <ul className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-md max-h-64 overflow-y-auto">
          {suggestions.map((name) => (
            <li
              key={name}
              className="cursor-pointer px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground"
              onMouseDown={() => selectCard(name)}
            >
              {name}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
