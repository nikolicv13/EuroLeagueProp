import { useNavigate } from "react-router-dom";
import type { PlayerSearchResult, CurrentTip } from "../../api/types";
import styles from "./PlayerToolbar.module.css";

interface PlayerToolbarProps {
  searchQuery: string;
  handleSearchChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  searchResults: PlayerSearchResult[];
  showDropdown: boolean;
  setShowDropdown: (b: boolean) => void;
  handleSelectPlayer: (p: PlayerSearchResult) => void;
  inputOverUnder: "over" | "under";
  setInputOverUnder: (v: "over" | "under") => void;
  inputLine: number;
  setInputLine: (v: number) => void;
  inputMarket: string;
  setInputMarket: (v: string) => void;
  handleSearch: () => void;
  tip: CurrentTip;
}

export default function PlayerToolbar(props: PlayerToolbarProps) {
  const navigate = useNavigate();

  return (
    <>
      <button onClick={() => navigate("/")} className={styles.backButton}>
        ← Back to Dashboard
      </button>

      <div className={styles.toolbar}>
        <div className={styles.toolbarGrid}>
          {/* ROW 1 */}
          <div
            className={`${styles.formGroup} ${styles.searchGroup} ${styles.gridPlayerName}`}
          >
            <label className={styles.formLabel}>Player Name</label>
            <input
              type="text"
              value={props.searchQuery}
              onChange={props.handleSearchChange}
              onBlur={() => setTimeout(() => props.setShowDropdown(false), 200)}
              onFocus={() =>
                props.searchResults.length > 0 && props.setShowDropdown(true)
              }
              placeholder="Search player..."
              className={styles.formInput}
            />
            {props.showDropdown && props.searchResults.length > 0 && (
              <ul className={styles.searchDropdown}>
                {props.searchResults.map((p, i) => (
                  <li
                    key={`${p.player_id}-${i}`}
                    onMouseDown={() => props.handleSelectPlayer(p)}
                    className={styles.searchDropdownItem}
                  >
                    <span className={styles.searchDropdownName}>
                      {p.player_name}
                    </span>
                    <span className={styles.searchDropdownInfo}>
                      {p.team_id} | {p.position}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className={`${styles.formGroup} ${styles.gridOverUnder}`}>
            <label className={styles.formLabel}>Over/Under</label>
            <select
              value={props.inputOverUnder}
              onChange={(e) =>
                props.setInputOverUnder(e.target.value as "over" | "under")
              }
              className={styles.formSelect}
            >
              <option value="over">OVER</option>
              <option value="under">UNDER</option>
            </select>
          </div>

          {/* ROW 2 (Swapped visually via CSS) */}
          <div className={`${styles.formGroup} ${styles.gridLine}`}>
            <label className={styles.formLabel}>Line</label>
            <input
              type="number"
              step="1"
              value={props.inputLine}
              onChange={(e) => props.setInputLine(parseFloat(e.target.value))}
              className={styles.formInput}
            />
          </div>

          <div className={`${styles.formGroup} ${styles.gridPropType}`}>
            <label className={styles.formLabel}>Prop Type</label>
            <select
              value={props.inputMarket}
              onChange={(e) => props.setInputMarket(e.target.value)}
              className={styles.formSelect}
            >
              <option value="points">Points</option>
              <option value="rebounds">Rebounds</option>
              <option value="assists">Assists</option>
              <option value="threes_made">3PT Made</option>

              <option value="pra">P + R + A</option>
              <option value="pa">P + A</option>
              <option value="pr">P + R</option>
              <option value="ra">R + A</option>

              <option value="steals">Steals</option>
              <option value="blocks">Blocks</option>
            </select>
          </div>

          <div className={`${styles.formGroup} ${styles.gridSearchBtn}`}>
            <button onClick={props.handleSearch} className={styles.searchBtn}>
              Search
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
