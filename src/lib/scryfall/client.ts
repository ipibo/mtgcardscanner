import type {
  ScryfallAutocomplete,
  ScryfallCard,
  ScryfallCollectionIdentifier,
  ScryfallCollectionResponse,
  ScryfallList,
} from "./types";

const SCRYFALL_BASE = "https://api.scryfall.com";

// Simple rate limiter: enforce 100ms between requests
let lastRequest = 0;
async function rateLimited<T>(fn: () => Promise<T>): Promise<T> {
  const now = Date.now();
  const wait = Math.max(0, 100 - (now - lastRequest));
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastRequest = Date.now();
  return fn();
}

async function scryfallFetch<T>(path: string, init?: RequestInit): Promise<T> {
  return rateLimited(async () => {
    const res = await fetch(`${SCRYFALL_BASE}${path}`, {
      ...init,
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        ...init?.headers,
      },
      next: { revalidate: 3600 }, // Cache for 1 hour in Next.js
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ details: res.statusText }));
      throw new ScryfallApiError(
        err.details ?? res.statusText,
        res.status,
        err.code ?? "unknown"
      );
    }

    return res.json() as Promise<T>;
  });
}

export class ScryfallApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code: string
  ) {
    super(message);
    this.name = "ScryfallApiError";
  }
}

export const scryfall = {
  /** Fuzzy card name lookup — forgiving of typos */
  namedFuzzy(name: string): Promise<ScryfallCard> {
    return scryfallFetch<ScryfallCard>(
      `/cards/named?fuzzy=${encodeURIComponent(name)}`
    );
  },

  /** Exact card name lookup */
  namedExact(name: string): Promise<ScryfallCard> {
    return scryfallFetch<ScryfallCard>(
      `/cards/named?exact=${encodeURIComponent(name)}`
    );
  },

  /** Search-as-you-type autocomplete */
  autocomplete(q: string): Promise<ScryfallAutocomplete> {
    return scryfallFetch<ScryfallAutocomplete>(
      `/cards/autocomplete?q=${encodeURIComponent(q)}`
    );
  },

  /** Full card search with Scryfall syntax */
  search(q: string, page = 1): Promise<ScryfallList<ScryfallCard>> {
    return scryfallFetch<ScryfallList<ScryfallCard>>(
      `/cards/search?q=${encodeURIComponent(q)}&page=${page}`
    );
  },

  /** Get a card by Scryfall UUID */
  byId(id: string): Promise<ScryfallCard> {
    return scryfallFetch<ScryfallCard>(`/cards/${id}`);
  },

  /** Batch fetch up to 75 cards by identifiers */
  collection(
    identifiers: ScryfallCollectionIdentifier[]
  ): Promise<ScryfallCollectionResponse> {
    return scryfallFetch<ScryfallCollectionResponse>("/cards/collection", {
      method: "POST",
      body: JSON.stringify({ identifiers }),
    });
  },
};

/** Chunk an array into groups of n */
export function chunk<T>(arr: T[], n: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
}
