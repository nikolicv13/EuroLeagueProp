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
  season_avg?: number;
  trend?: string;
  trend_direction?: string;
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
    value?: string;
  };
}

export interface JsonGame {
  game_id: string;
  team: string;
  opponent: string;
}

export interface LocationState {
  player_id: string;
  player: string;
  position: string;
  market: string;
  line: number;
  selection: "over" | "under";
  opponent_team_id: string;
  opponent: string;
  team_id: string;
  game_id: string;
  season_code: string;
  start_time: string;
  hit_rates?: {
    season: { hits: number; attempts: number; rate: number };
    last5: { hits: number; attempts: number; rate: number };
    last10: { hits: number; attempts: number; rate: number };
    last15: { hits: number; attempts: number; rate: number };
    vs_opp?: { hits: number; attempts: number; rate: number };
  };
}

export interface CurrentTip {
  player_id: string;
  player?: string;
  market: string;
  line: number;
  selection: "over" | "under";
  opponent_team_id: string;
  opponent?: string;
  team_id: string;
  position: string;
  season: string;
  game_id?: string;
}

export interface ChartDataPoint extends PlayerGameStat {
  parsedMinutes: number;
  fga: number;
  opponent_id: string;
  dateFormatted: string;
  steals: number;
  blocks: number;
  pa: number;
  pr: number;
  ra: number;
  pra: number;
}

export interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ payload: ChartDataPoint }>;
  marketKeyStr: string;
  marketLabelStr: string;
}
