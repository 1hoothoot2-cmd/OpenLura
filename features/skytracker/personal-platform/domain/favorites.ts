export type FavoriteKind = "aircraft" | "airport" | "airline" | "flight";

export type PersonalFavorite = Readonly<{
  kind: FavoriteKind;
  stableId: string;
  label: string | null;
  addedAtEpochMillis: number;
}>;

export type PersonalFavorites = Readonly<{
  aircraft: readonly PersonalFavorite[];
  airports: readonly PersonalFavorite[];
  airlines: readonly PersonalFavorite[];
  flights: readonly PersonalFavorite[];
}>;

export const EMPTY_PERSONAL_FAVORITES: PersonalFavorites = {
  aircraft: [],
  airports: [],
  airlines: [],
  flights: [],
};

export function favoriteKey(favorite: PersonalFavorite): string {
  return `${favorite.kind}:${favorite.stableId.trim().toLowerCase()}`;
}

export function normalizeFavorites(
  favorites: readonly PersonalFavorite[],
): readonly PersonalFavorite[] {
  const valid = favorites.filter(
    (favorite) =>
      favorite.stableId.trim().length > 0 &&
      Number.isFinite(favorite.addedAtEpochMillis),
  );
  return [...new Map(valid.map((item) => [favoriteKey(item), item])).values()]
    .sort((left, right) => favoriteKey(left).localeCompare(favoriteKey(right)));
}
