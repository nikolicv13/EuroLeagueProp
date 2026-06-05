import type { Tip } from "../types";

export function teamLogoUrl(teamId: number) {
  return `/logos/${teamId}.png`;
}

export function marketLabel(market: Tip["market"]) {
  switch (market) {
    case "points":
      return "Points";
    case "assists":
      return "Assists";
    case "rebounds":
      return "Rebounds";
    case "threes_made":
      return "3PT Made";
    default:
      return market;
  }
}

export function propLabel(tip: Tip) {
  const sel = tip.selection === "over" ? "Over" : "Under";
  return `${sel} ${tip.line} ${marketLabel(tip.market)}`;
}

// simple “stars” just for UI testing (0–5)
// adjust later to whatever scoring you use
export function ratingFromScore(score: number) {
  const stars = Math.max(0, Math.min(5, score / 20));
  return Math.round(stars * 2) / 2; // halves, e.g. 3.5
}
