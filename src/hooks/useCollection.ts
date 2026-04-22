"use client";
import { useCallback, useEffect, useState } from "react";
import type { CollectionCard } from "@/lib/db/schema";

export function useCollection(search?: string) {
  const [cards, setCards] = useState<CollectionCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCards = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const url = `/api/collection${search ? `?search=${encodeURIComponent(search)}` : ""}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to fetch");
      setCards(await res.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    fetchCards();
  }, [fetchCards]);

  const addCard = useCallback(
    async (data: {
      scryfallId: string;
      cardName: string;
      setCode: string;
      quantity?: number;
      foil?: boolean;
    }) => {
      const res = await fetch("/api/collection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to add card");
      await fetchCards();
      return res.json();
    },
    [fetchCards]
  );

  const updateQuantity = useCallback(
    async (id: string, quantity: number) => {
      const res = await fetch(`/api/collection/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quantity }),
      });
      if (!res.ok) throw new Error("Failed to update quantity");
      await fetchCards();
    },
    [fetchCards]
  );

  const removeCard = useCallback(
    async (id: string) => {
      const res = await fetch(`/api/collection/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to remove card");
      await fetchCards();
    },
    [fetchCards]
  );

  return { cards, loading, error, addCard, updateQuantity, removeCard, refetch: fetchCards };
}
