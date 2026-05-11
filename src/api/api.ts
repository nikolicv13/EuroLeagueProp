const API_URL = "http://localhost:3001/api";

export interface Game {
  game_id: string;
  game: string;
  date: string;
  time: string;
  team_id_a: string;
  team_id_b: string;
  team_a: string;
  team_b: string;
  score_a: number | null;
  score_b: number | null;
}

export interface HitRate {
  hits: number;
  attempts: number;
  rate: number;
}

export interface Tip {
  id: string;
  game_id: string;
  start_time: string;
  player_id: string;
  player: string;
  team_id: string;
  team: string;
  opponent_team_id: string;
  opponent: string;
  team_abbr?: string;
  opponent_abbr?: string;
  position?: string;
  market: "points" | "assists" | "rebounds" | "threes_made";
  selection: "over" | "under";
  line: number;
  odds: number;
  hit_rates: {
    season: HitRate;
    last10: HitRate;
    last5: HitRate;
    last15?: HitRate;
    vs_opp?: HitRate;
  };
  score: number;
}

export interface PlayerGameStat {
  game_id: string;
  team_id?: string;
  points: number;
  total_rebounds: number;
  assists: number;
  three_points_made: number;
  three_points_attempted: number;
  two_points_attempted: number;
  minutes: string;
  date: string;
  team_id_a: string;
  team_id_b: string;
  team_a: string;
  team_b: string;
  score_a: number | null;
  score_b: number | null;
}

export interface CustomXTickProps {
  x?: number;
  y?: number;
  payload?: {
    value?: string; // Now contains "Jan 23|MAD"
  };
}

// Fetch games by date (defaults to today)
export async function fetchGames(date: string): Promise<Game[]> {
  const res = await fetch(`${API_URL}/games?date=${date}`);
  if (!res.ok) throw new Error("Failed to fetch games");
  return res.json();
}

// Fetch tips for a specific game
export async function fetchTips(gameId: string): Promise<Tip[]> {
  const res = await fetch(`${API_URL}/tips/${gameId}`);
  if (!res.ok) throw new Error("Failed to fetch tips");
  return res.json();
}

export async function fetchPlayerStats(
  playerId: string,
  limit: number,
  opponent?: string,
  season?: string, // <-- ADD
  date?: string, // <-- ADD
): Promise<PlayerGameStat[]> {
  let url = `${API_URL}/players/${playerId}/stats?limit=${limit}`;
  if (opponent) url += `&opponent=${opponent}`;
  if (season) url += `&season=${season}`;
  if (date) url += `&date=${date}`;

  const res = await fetch(url);
  if (!res.ok) throw new Error("Failed to fetch player stats");
  return res.json();
}
