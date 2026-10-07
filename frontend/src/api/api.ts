import type {
  Game,
  Tip,
  PlayerSearchResult,
  PlayerGameStat,
  DefenseRankings,
  SimilarPlayer,
} from "./types";

const API_URL =
  (import.meta.env.VITE_API_URL || "http://localhost:3001") + "/api";

// ==========================================
// HELPER: Build headers with optional auth
// ==========================================
function buildHeaders(token?: string | null): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  return headers;
}

// ==========================================
// FETCH GAMES (Public)
// ==========================================
export async function fetchGames(date: string): Promise<Game[]> {
  const res = await fetch(`${API_URL}/games?date=${date}`);
  if (!res.ok) throw new Error("Failed to fetch games");
  return res.json();
}

// ==========================================
// FETCH TIPS (Public)
// ==========================================
export async function fetchTips(gameId: string): Promise<Tip[]> {
  const res = await fetch(`${API_URL}/tips/${gameId}`);
  if (!res.ok) throw new Error("Failed to fetch tips");
  return res.json();
}

// ==========================================
// FETCH PLAYER STATS (optionalAuth - works with or without token)
// ==========================================
export async function fetchPlayerStats(
  playerId: string,
  limit: number,
  opponent?: string,
  season?: string,
  date?: string,
  opposingPlayerId?: string,
  withTeammateId?: string,
  withoutTeammateId?: string,
  token?: string | null, // 👈 ADD
): Promise<PlayerGameStat[]> {
  let url = `${API_URL}/players/${playerId}/stats?limit=${limit}`;
  if (opponent) url += `&opponent=${opponent}`;
  if (season) url += `&season=${season}`;
  if (date) url += `&date=${date}`;
  if (opposingPlayerId) url += `&oppPlayer=${opposingPlayerId}`;
  if (withTeammateId) url += `&withTeammate=${withTeammateId}`;
  if (withoutTeammateId) url += `&withoutTeammate=${withoutTeammateId}`;

  const res = await fetch(url, { headers: buildHeaders(token) }); // 👈 ADD AUTH

  if (!res.ok) {
    // If 403, it's a tier restriction — return empty instead of crashing
    if (res.status === 403) return [];
    throw new Error("Failed to fetch player stats");
  }
  return res.json();
}

// ==========================================
// FETCH DEFENSE RANKINGS (Public)
// ==========================================
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

// ==========================================
// FETCH PLAYER SEARCH (Protected - Pro only)
// ==========================================
export async function fetchPlayerSearch(
  query: string,
  token?: string | null, // 👈 ADD
): Promise<PlayerSearchResult[]> {
  const res = await fetch(
    `${API_URL}/players/search?q=${query}`,
    { headers: buildHeaders(token) }, // 👈 ADD AUTH
  );

  if (!res.ok) {
    // If 401 or 403, return empty array so UI doesn't crash for Free users
    if (res.status === 401 || res.status === 403) return [];
    throw new Error("Search failed");
  }
  return res.json();
}

// ==========================================
// FETCH SIMILAR PLAYERS (Protected - Pro only)
// ==========================================
export async function fetchSimilarPlayers(
  opponentId: string,
  position: string,
  market: string,
  targetAvg?: number,
  token?: string | null, // 👈 ADD
): Promise<SimilarPlayer[]> {
  let url = `${API_URL}/similar-players/${opponentId}/${position}/${market}`;
  if (targetAvg) url += `?targetAvg=${targetAvg}`;

  const res = await fetch(url, { headers: buildHeaders(token) }); // 👈 ADD AUTH

  if (!res.ok) {
    // If 401 or 403, return empty array so UI doesn't crash
    if (res.status === 401 || res.status === 403) return [];
    throw new Error("Failed to fetch similar players");
  }
  return res.json();
}

// ==========================================
// FETCH BRAZILBET ODDS (optionalAuth)
// ==========================================
export async function fetchBrazilBetOdds(
  leagueId: string,
  token?: string | null, // 👈 ADD
): Promise<Tip[]> {
  const res = await fetch(
    `${API_URL}/odds/brazilbet/${leagueId}`,
    { headers: buildHeaders(token) }, // 👈 ADD AUTH
  );
  if (!res.ok) throw new Error("Failed to fetch BrazilBet odds");
  return res.json();
}

// ==========================================
// AUTH API CALLS
// ==========================================
export async function signup(data: {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
}) {
  const res = await fetch(`${API_URL}/auth/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || "Signup failed");
  }
  return res.json();
}

export async function login(data: { email: string; password: string }) {
  const res = await fetch(`${API_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || "Login failed");
  }
  return res.json();
}

export async function updateProfile(
  token: string,
  data: {
    firstName: string;
    lastName: string;
    username: string;
  },
) {
  const res = await fetch(`${API_URL}/auth/profile`, {
    method: "PUT",
    headers: buildHeaders(token),
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || "Failed to update profile");
  }
  return res.json();
}

export async function changePassword(
  token: string,
  data: {
    currentPassword: string;
    newPassword: string;
  },
) {
  const res = await fetch(`${API_URL}/auth/password`, {
    method: "PUT",
    headers: buildHeaders(token),
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || "Failed to change password");
  }
  return res.json();
}
