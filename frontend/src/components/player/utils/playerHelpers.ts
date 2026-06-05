import type { PlayerGameStat } from "../../../api/types";

export const LOG_PER_PAGE = 15;

export function parseMinutes(minStr: string): number {
  if (!minStr || minStr === "DNP") return 0;
  return parseFloat(minStr.replace(":", "."));
}

export function getOrdinal(n: number) {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return s[(v - 20) % 10] || s[v] || s[0];
}

// March 15
export function formatDate(dateStr: string) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
//March 15, 2025
export function formatDateFull(dateStr: string) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export function calculateHitRate(
  values: number[],
  line: number,
  selection: "over" | "under",
): { hits: number; attempts: number; rate: number } {
  if (values.length === 0) return { hits: 0, attempts: 0, rate: 0 };

  let hits = 0;
  for (const value of values) {
    if (selection === "over" && value > line) hits++;
    if (selection === "under" && value < line) hits++;
  }
  return {
    hits,
    attempts: values.length,
    rate: hits / values.length,
  };
}

export function getMarketKey(market: string): keyof PlayerGameStat | string {
  switch (market) {
    case "points":
    case "points_alt":
    case "points_alt2":
      return "points";
    case "assists":
    case "assists_alt":
      return "assists";
    case "rebounds":
    case "rebounds_alt":
    case "rebounds_alt2":
      return "total_rebounds";
    case "threes_made":
      return "three_points_made";
    case "steals":
      return "steals";
    case "blocks":
      return "blocks";
    case "pa":
      return "pa";
    case "pr":
      return "pr";
    case "ra":
      return "ra";
    case "pra":
      return "pra";
    default:
      return "points";
  }
}

export function getMarketLabel(market: string): string {
  switch (market) {
    case "points":
      return "Points";
    case "points_alt":
      return "Points (Alt 1)";
    case "points_alt2":
      return "Points (Alt 2)";
    case "assists":
      return "Assists";
    case "assists_alt":
      return "Assists (Alt)";
    case "rebounds":
      return "Rebounds";
    case "rebounds_alt":
      return "Rebounds (Alt 1)";
    case "rebounds_alt2":
      return "Rebounds (Alt 2)";
    case "threes_made":
      return "3PT Made";
    case "steals":
      return "Steals";
    case "blocks":
      return "Blocks";
    case "pa":
      return "Points + Assists";
    case "pr":
      return "Points + Rebounds";
    case "ra":
      return "Rebounds + Assists";
    case "pra":
      return "Points + Rebounds + Assists";
    default:
      return "Points";
  }
}

export function getStatValue(s: PlayerGameStat, market: string): number {
  const key = getMarketKey(market);
  const pts = Number(s.points) || 0;
  const reb = Number(s.total_rebounds) || 0;
  const ast = Number(s.assists) || 0;
  const stl = Number(s.steals) || 0;
  const blk = Number(s.blocks || s.blocks_favour) || 0;
  if (key === "pa") return pts + ast;
  if (key === "pr") return pts + reb;
  if (key === "ra") return reb + ast;
  if (key === "pra") return pts + reb + ast;
  if (key === "steals") return stl;
  if (key === "blocks") return blk;
  return Number(s[key as keyof PlayerGameStat]) || 0;
}

export function getFG(game: PlayerGameStat): string {
  const made = (game.two_points_made || 0) + (game.three_points_made || 0);
  const att =
    (game.two_points_attempted || 0) + (game.three_points_attempted || 0);
  if (att === 0) return "0.0";
  return ((made / att) * 100).toFixed(1);
}

export function getWL(game: PlayerGameStat): string {
  if (game.score_a === null || game.score_b === null) return "-";
  const isHome = game.team_id === game.team_id_a;
  const teamScore = isHome ? game.score_a : game.score_b;
  const oppScore = isHome ? game.score_b : game.score_a;
  return teamScore > oppScore ? "W" : "L";
}

export function getBarColor(
  value: number,
  selection: "over" | "under",
  line: number,
): string {
  if (selection === "over") return value > line ? "#4caf50" : "#e94560";
  return value < line ? "#4caf50" : "#e94560";
}
