import type {
  Game,
  Tip,
  PlayerSearchResult,
  PlayerGameStat,
  DefenseRankings,
  SimilarPlayer,
} from "./types";

const API_URL = "http://localhost:3001/api";

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
  opposingPlayerId?: string,
  withTeammateId?: string,
  withoutTeammateId?: string,
): Promise<PlayerGameStat[]> {
  let url = `${API_URL}/players/${playerId}/stats?limit=${limit}`;
  if (opponent) url += `&opponent=${opponent}`;
  if (season) url += `&season=${season}`;
  if (date) url += `&date=${date}`;
  if (opposingPlayerId) url += `&oppPlayer=${opposingPlayerId}`;
  if (withTeammateId) url += `&withTeammate=${withTeammateId}`;
  if (withoutTeammateId) url += `&withoutTeammate=${withoutTeammateId}`;

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
