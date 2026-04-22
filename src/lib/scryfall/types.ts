export interface ScryfallCardFace {
  name: string;
  mana_cost?: string;
  type_line?: string;
  oracle_text?: string;
  image_uris?: ScryfallImageUris;
  colors?: string[];
  power?: string;
  toughness?: string;
}

export interface ScryfallImageUris {
  small: string;
  normal: string;
  large: string;
  png: string;
  art_crop: string;
  border_crop: string;
}

export interface ScryfallPrices {
  usd: string | null;
  usd_foil: string | null;
  eur: string | null;
  eur_foil: string | null;
  tix: string | null;
}

export interface ScryfallCard {
  id: string;
  name: string;
  set: string;
  set_name: string;
  collector_number: string;
  rarity: "common" | "uncommon" | "rare" | "mythic" | "special" | "bonus";
  lang: string;
  released_at: string;
  mana_cost?: string;
  cmc: number;
  type_line: string;
  oracle_text?: string;
  colors?: string[];
  color_identity: string[];
  keywords: string[];
  legalities: Record<string, string>;
  image_uris?: ScryfallImageUris;
  card_faces?: ScryfallCardFace[];
  prices: ScryfallPrices;
  scryfall_uri: string;
  artist?: string;
  flavor_text?: string;
  power?: string;
  toughness?: string;
}

export interface ScryfallList<T> {
  object: "list";
  total_cards: number;
  has_more: boolean;
  data: T[];
}

export interface ScryfallError {
  object: "error";
  code: string;
  status: number;
  details: string;
}

export interface ScryfallAutocomplete {
  object: "catalog";
  total_values: number;
  data: string[];
}

export interface ScryfallCollectionIdentifier {
  name?: string;
  id?: string;
  set?: string;
  collector_number?: string;
}

export interface ScryfallCollectionResponse {
  object: "list";
  not_found: ScryfallCollectionIdentifier[];
  data: ScryfallCard[];
}
