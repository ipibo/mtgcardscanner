export interface DecklistEntry {
  quantity: number;
  name: string;
  set?: string;
  isSideboard: boolean;
}

/**
 * Parse a standard MTG decklist text format.
 *
 * Supports:
 *   4 Lightning Bolt
 *   2x Island
 *   1 Black Lotus (LEA)
 *
 * And sideboard sections starting with "Sideboard:" or "SB:"
 */
export function parseDeckList(text: string): DecklistEntry[] {
  const entries: DecklistEntry[] = [];
  let isSideboard = false;

  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  for (const line of lines) {
    const lower = line.toLowerCase();

    // Detect sideboard header
    if (
      lower === "sideboard:" ||
      lower === "sideboard" ||
      lower === "sb:" ||
      lower === "sb"
    ) {
      isSideboard = true;
      continue;
    }

    // Skip comment lines
    if (line.startsWith("//") || line.startsWith("#")) continue;

    // Match: optional "SB: " prefix, then quantity, then card name, optional (SET)
    const sbPrefix = /^(?:sb:\s*)/i.test(line);
    const cleanLine = line.replace(/^sb:\s*/i, "");

    // Match "4x Lightning Bolt" or "4 Lightning Bolt" optionally followed by "(SET)"
    const match = cleanLine.match(/^(\d+)x?\s+(.+?)(?:\s+\(([A-Z0-9]+)\))?$/i);
    if (!match) continue;

    const [, qty, name, set] = match;
    entries.push({
      quantity: parseInt(qty, 10),
      name: name.trim(),
      set: set?.toUpperCase(),
      isSideboard: isSideboard || sbPrefix,
    });
  }

  return entries;
}
