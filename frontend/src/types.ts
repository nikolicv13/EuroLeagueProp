export type HitRate = { hits: number; attempts: number; rate: number };

export type Tip = {
  id: string;
  game_id: number;
  start_time: string;
  player_id: number;
  position: string;
  player: string;
  team_id: number;
  team: string;
  opponent_team_id: number;
  opponent: string;
  market: "points" | "assists" | "rebounds" | "threes_made";
  selection: "over" | "under";
  line: number;
  odds: number;
  hit_rates: {
    season: HitRate;
    last10: HitRate;
    last5: HitRate;
  };
  signals: {
    form: number;
    opponent: number;
    minutes_boost: number;
  };
  model_prob: number;
  edge: number;
  score: number;
  notes?: string[];
};

export type TipsResponse = { date: string; tips: Tip[] };

export type ScheduleGame = {
  game_id: number;
  date: string;
  time: string;
  round: number;
  team_id_a: number;
  team_a: string;
  team_id_b: number;
  team_b: string;
};

export type ScheduleResponse = {
  season_code: string;
  phase: string;
  upcoming_dates: string[];
  games: ScheduleGame[];
};
