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

  market: "points" | "assists" | "rebounds" | "threes_made";
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

function marketLabel(market: TipLike["market"]) {
  switch (market) {
    case "points":
      return "Points";
    case "assists":
      return "Assists";
    case "rebounds":
      return "Rebounds";
    case "threes_made":
      return "3PT Made";
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

  const matchupLeft = tip.team_abbr ?? tip.team;
  const matchupRight = tip.opponent_abbr ?? tip.opponent;

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
            {matchupLeft} @ {matchupRight}
          </div>
          <div className={styles.ppDate}>
            {dateLabel} · {tip.start_time}
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
          <StatBox label={`VS ${matchupRight}`} hr={tip.hit_rates.vs_opp} />
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
            // Build the URL with query parameters
            const url = `/player-stats/${tip.player_id}?propType=${tip.market}&propAmount=${tip.line}&overUnder=${tip.selection || "over"}`;
            navigate(url, { state: tip }); // We still pass state as a backup for now!
          }}
        >
          View Stats
        </button>
      </footer>
    </article>
  );
}
