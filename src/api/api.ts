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

export interface PlayerSearchResult {
  player_id: string;
  player_name: string;
  team_id: string;
  position: string;
}

export interface HitRate {
  hits: number;
  attempts: number;
  rate: number;
}
export interface DefenseVsPosition {
  season: {
    points: string;
    rebounds: string;
    assists: string;
    threes: string;
    steals: string;
    blocks: string;
    sample_size: number;
  } | null;
  last5: {
    points: string;
    rebounds: string;
    assists: string;
    threes: string;
    steals: string;
    blocks: string;
    sample_size: number;
  } | null;
  last10: {
    points: string;
    rebounds: string;
    assists: string;
    threes: string;
    steals: string;
    blocks: string;
    sample_size: number;
  } | null;
  last15: {
    points: string;
    rebounds: string;
    assists: string;
    threes: string;
    steals: string;
    blocks: string;
    sample_size: number;
  } | null;
}

export interface SimilarPlayer {
  player_id: string;
  player: string;
  team_id: string;
  game_stat: number;
  avg_stat: number;
  date: string;
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
  market:
    | "points"
    | "assists"
    | "rebounds"
    | "threes_made"
    | "pa"
    | "pr"
    | "ra"
    | "pra"
    | "steals"
    | "blocks";
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
  round?: string;
  phase?: string;
  date: string;
  team_id_a: string;
  team_id_b: string;
  team_a: string;
  team_b: string;
  score_a: number | null;
  score_b: number | null;
  minutes: string;
  points: number;
  free_throws_made: number;
  free_throws_attempted: number;
  two_points_made: number;
  two_points_attempted: number;
  three_points_made: number;
  three_points_attempted: number;
  offensive_rebounds: number;
  defensive_rebounds: number;
  total_rebounds: number;
  assists: number;
  steals: number;
  blocks: number;
  blocks_favour: number;
  turnovers: number;
  fouls_committed: number;
  fouls_received: number;
  plus_minus: number;
  pir: number;
}
export interface DefenseStatRank {
  avg: number;
  rank: number | null;
  label: string;
  season_avg?: number; // Added
  trend?: string; // Added: e.g., "+3.5" or "-2.1"
  trend_direction?: string; // Added: "worse", "better", "same"
}

export interface DefenseRankings {
  team_id: string;
  position: string;
  total_teams: number;
  stats: {
    points: DefenseStatRank;
    rebounds: DefenseStatRank;
    assists: DefenseStatRank;
    threes: DefenseStatRank;
    steals: DefenseStatRank;
    blocks: DefenseStatRank;
  };
}

export interface CustomXTickProps {
  x?: number;
  y?: number;
  activeFilter: string;
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
  season?: string,
  date?: string,
): Promise<PlayerGameStat[]> {
  let url = `${API_URL}/players/${playerId}/stats?limit=${limit}`;
  if (opponent) url += `&opponent=${opponent}`;
  if (season) url += `&season=${season}`;
  if (date) url += `&date=${date}`;

  const res = await fetch(url);
  if (!res.ok) throw new Error("Failed to fetch player stats");
  return res.json();
}

export async function fetchDefenseRankings(
  teamId: string,
  position: string,
  limit: string = "season",
): Promise<DefenseRankings> {
  const url = `${API_URL}/defense/${teamId}/${position}?limit=${limit}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("Failed to fetch defense rankings");
  return res.json();
}
export async function fetchPlayerSearch(
  query: string,
): Promise<PlayerSearchResult[]> {
  const res = await fetch(`${API_URL}/players/search?q=${query}`);
  if (!res.ok) throw new Error("Search failed");
  return res.json();
}

export async function fetchSimilarPlayers(
  opponentId: string,
  position: string,
  market: string,
  targetAvg?: number,
): Promise<SimilarPlayer[]> {
  let url = `${API_URL}/similar-players/${opponentId}/${position}/${market}`;
  if (targetAvg) url += `?targetAvg=${targetAvg}`;

  const res = await fetch(url);
  if (!res.ok) throw new Error("Failed to fetch similar players");
  return res.json();
}

export async function fetchBrazilBetOdds(leagueId: string): Promise<Tip[]> {
  const res = await fetch(`${API_URL}/odds/brazilbet/${leagueId}`);
  if (!res.ok) throw new Error("Failed to fetch BrazilBet odds");
  return res.json();
}
