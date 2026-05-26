import { useNavigate } from "react-router-dom";

// Import the CSS Module
import styles from "./TipCard.module.css";

type HitRate = { hits: number; attempts: number; rate: number };
type OddsOffer = { book: string; odds: number; url?: string };

type TipLike = {
  id: string;
  game_id: string | number;
  start_time: string;

  player_id: string | number;
  player: string;

  team_id: string | number;
  team: string;
  opponent_team_id: string | number;
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
    | "blocks"
    | "points_alt"
    | "points_alt2"
    | "assists_alt"
    | "rebounds_alt"
    | "rebounds_alt2";
  selection: "over" | "under";
  line: number;

  odds: number;
  odds_offers?: OddsOffer[];

  hit_rates: {
    season: HitRate;
    last10: HitRate;
    last5: HitRate;
    last15?: HitRate;
    vs_opp?: HitRate;
  };

  score: number;
};

type Props = {
  tip: TipLike;
  dateLabel: string; // e.g. "Wed 7:00 PM ET" or "2026-04-29"
  onViewStats?: (tip: TipLike) => void;
  onGameReport?: (tip: TipLike) => void;
};

function teamLogoUrl(teamId: string | number) {
  return `/logos/${teamId}.png`;
}

function formatStartTime(isoString: string) {
  try {
    const d = new Date(isoString);
    return d.toLocaleTimeString("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: "Europe/Belgrade", // <-- This forces it to show CET/CEST (Euroleague time)
    });
  } catch {
    return isoString;
  }
}

function marketLabel(market: TipLike["market"]) {
  switch (market) {
    case "points":
    case "points_alt":
    case "points_alt2":
      return "Points"; // All of them just say "Points"
    case "assists":
    case "assists_alt":
      return "Assists";
    case "rebounds":
    case "rebounds_alt":
    case "rebounds_alt2":
      return "Rebounds";
    case "threes_made":
      return "3PT Made";
    case "steals":
      return "Steals";
    case "blocks":
      return "Blocks";
    case "pa":
      return "P + A";
    case "pr":
      return "P + R";
    case "ra":
      return "R + A";
    case "pra":
      return "P + R + A";
    default:
      return "Points";
  }
}

function propLabel(tip: TipLike) {
  const sel = tip.selection === "over" ? "Over" : "Under";
  return `${sel} ${tip.line} ${marketLabel(tip.market)}`;
}

// quick rating for UI (0–5) derived from score
function ratingFromScore(score: number) {
  const stars = Math.max(0, Math.min(5, score / 20));
  return Math.round(stars * 10) / 10;
}

function StatBox({ label, hr }: { label: string; hr?: HitRate }) {
  if (!hr) {
    return (
      // Combining two classes dynamically
      <div className={`${styles.ppStatBox} ${styles.ppStatBoxEmpty}`}>
        <div className={styles.ppStatLabel}>{label}</div>
        <div className={styles.ppStatValue}>—</div>
        <div className={styles.ppStatSub}>—</div>
      </div>
    );
  }

  const pct = Math.round(hr.rate * 100);
  return (
    <div className={styles.ppStatBox}>
      <div className={styles.ppStatLabel}>{label}</div>
      <div className={styles.ppStatValue}>{pct}%</div>
      <div className={styles.ppStatSub}>
        {hr.hits}/{hr.attempts}
      </div>
    </div>
  );
}

export default function TipCard({ tip, dateLabel, onGameReport }: Props) {
  const rating = ratingFromScore(tip.score);
  const navigate = useNavigate();

  const matchupLeft = tip.team_abbr ?? tip.team_id;
  const matchupRight = tip.opponent_abbr ?? tip.opponent_team_id;

  const offers: OddsOffer[] = tip.odds_offers?.length
    ? tip.odds_offers
    : [{ book: "Default", odds: tip.odds }];

  return (
    <article className={styles.ppCard}>
      {/* Header */}
      <header className={styles.ppHeader}>
        <div className={styles.ppHeaderLeft}>
          <img
            className={styles.ppAvatar}
            src={teamLogoUrl(tip.team_id)}
            alt={`${tip.team} logo`}
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).src =
                "/logos/placeholder.png";
            }}
          />

          <div className={styles.ppPlayerBlock}>
            <div className={styles.ppPlayerRow}>
              <h3 className={styles.ppPlayerName}>{tip.player}</h3>
              <span className={styles.ppPosition}>{tip.position ?? "—"}</span>
              <span className={styles.ppRatingPill} title="Model rating">
                <span className={styles.ppRatingStar}>★</span>
                <span className={styles.ppRatingNum}>{rating.toFixed(1)}</span>
              </span>
            </div>

            <div className={styles.ppPropPill}>{propLabel(tip)}</div>
          </div>
        </div>

        <div className={styles.ppHeaderRight}>
          <div className={styles.ppMatchup}>
            {matchupLeft} vs {matchupRight}
          </div>
          <div className={styles.ppDate}>
            {dateLabel} · {formatStartTime(tip.start_time)}
          </div>
        </div>
      </header>

      {/* Hit Rates */}
      <section className={styles.ppSection}>
        <div className={styles.ppSectionTitle}>Hit Rates</div>

        <div className={styles.ppStatsGrid}>
          <StatBox label="Season" hr={tip.hit_rates.season} />
          <StatBox label="L5" hr={tip.hit_rates.last5} />
          <StatBox label="L10" hr={tip.hit_rates.last10} />
          <StatBox label="L15" hr={tip.hit_rates.last15} />
          <StatBox
            label={`VS ${tip.opponent_abbr ?? tip.opponent_team_id}`}
            hr={tip.hit_rates.vs_opp}
          />
        </div>
      </section>

      {/* Odds row */}
      <section className={styles.ppOdds}>
        {offers.map((o, idx) => (
          <button
            key={`${o.book}_${idx}`}
            className={styles.ppOddsBtn}
            type="button"
            onClick={() => {
              if (o.url) window.open(o.url, "_blank", "noopener,noreferrer");
            }}
          >
            <span className={styles.ppOddsVal}>{o.odds.toFixed(2)}</span>
          </button>
        ))}
      </section>

      {/* Bottom actions */}
      <footer className={styles.ppActions}>
        <button
          className={`${styles.ppActionBtn} ${styles.ppActionBtnSecondary}`}
          type="button"
          onClick={() => onGameReport?.(tip)}
        >
          Game Report
        </button>

        <button
          className={`${styles.ppActionBtn} ${styles.ppActionBtnPrimary}`}
          type="button"
          onClick={() => {
            // Create safe fallbacks so we NEVER send actual nulls
            const oppTeamId =
              tip.opponent_team_id || tip.opponent_abbr || "UNK";
            const oppName =
              tip.opponent ||
              tip.opponent_abbr ||
              tip.opponent_team_id ||
              "Opponent";
            const pos = tip.position || "UNK";
            const teamId = tip.team_id || "UNK";

            const url = `/player-stats/${tip.player_id}?propType=${tip.market}&propAmount=${tip.line}&overUnder=${tip.selection || "over"}&oppTeam=${oppTeamId}&oppName=${encodeURIComponent(oppName)}&teamId=${teamId}&position=${pos}&season=E2025`;

            navigate(url, { state: tip });
          }}
        >
          View Stats
        </button>
      </footer>
    </article>
  );
}
