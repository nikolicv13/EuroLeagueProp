import type { DefenseRankings, CurrentTip } from "../../api/types";
import DefenseBox from "./utils/DefenseBox";
import styles from "./DefenseSection.module.css";

interface DefenseSectionProps {
  defenseData: DefenseRankings | null;
  defenseLimit: string;
  setDefenseLimit: (l: string) => void;
  tip: CurrentTip;
}

export default function DefenseSection({
  defenseData,
  defenseLimit,
  setDefenseLimit,
  tip,
}: DefenseSectionProps) {
  if (
    !defenseData ||
    !defenseData.stats ||
    !tip.opponent_team_id ||
    !tip.position
  )
    return null;

  return (
    <div className={styles.defenseContainer}>
      <div className={styles.defenseFilterWrapper}>
        {["5", "10", "season"].map((f) => (
          <button
            key={f}
            onClick={() => setDefenseLimit(f)}
            className={
              defenseLimit === f
                ? styles.defenseFilterBtnActive
                : styles.defenseFilterBtnInactive
            }
          >
            {f === "season" ? "Season" : `Last ${f}`}
          </button>
        ))}
      </div>

      <h3 className={styles.defenseTitle}>
        {tip.opponent || tip.opponent_team_id} Defense vs{" "}
        {tip.position || "All"} Position
      </h3>
      <div className={styles.defenseRow}>
        <DefenseBox
          label="PTS"
          stat={defenseData.stats.points}
          isActive={tip.market === "points"}
          showRank={defenseLimit === "season"}
        />
        <DefenseBox
          label="REB"
          stat={defenseData.stats.rebounds}
          isActive={tip.market === "rebounds"}
          showRank={defenseLimit === "season"}
        />
        <DefenseBox
          label="AST"
          stat={defenseData.stats.assists}
          isActive={tip.market === "assists"}
          showRank={defenseLimit === "season"}
        />
      </div>
      <div className={styles.defenseRowBottom}>
        <DefenseBox
          label="3PT"
          stat={defenseData.stats.threes}
          isActive={tip.market === "threes_made"}
          showRank={defenseLimit === "season"}
        />
        <DefenseBox
          label="STL"
          stat={defenseData.stats.steals}
          isActive={false}
          showRank={defenseLimit === "season"}
        />
        <DefenseBox
          label="BLK"
          stat={defenseData.stats.blocks}
          isActive={false}
          showRank={defenseLimit === "season"}
        />
      </div>
      <div className={styles.defenseLegend}>
        <div className={styles.defenseLegendItem}>
          <span className={styles.defenseLegendColorGreen}></span>
          <span>Weak = Green (Bad defense, easier to score)</span>
        </div>
        <div className={styles.defenseLegendItem}>
          <span className={styles.defenseLegendColorRed}></span>
          <span>Strong = Red (Good defense, harder to score)</span>
        </div>
        <div className={styles.defenseLegendItem}>
          <span className={styles.defenseLegendColorGray}></span>
          <span>Average = Gray</span>
        </div>
      </div>
    </div>
  );
}
