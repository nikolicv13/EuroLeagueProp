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
      <div className={styles.searchBarWrapper}>
        <input
          type="text"
          value={props.searchQuery}
          onChange={props.handleSearchChange}
          onBlur={() => setTimeout(() => props.setShowDropdown(false), 200)}
          onFocus={() =>
            props.searchResults.length > 0 && props.setShowDropdown(true)
          }
          placeholder="Search player..."
          className={styles.searchInput}
        />
        {props.showDropdown && props.searchResults.length > 0 && (
          <ul className={styles.searchDropdown}>
            {props.searchResults.map((p, i) => (
              <li
                key={`${p.player_id}-${i}`}
                onClick={() => props.handleSelectPlayer(p)}
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
      <div className={styles.toolbar}>
        <select
          value={props.inputOverUnder}
          onChange={(e) =>
            props.setInputOverUnder(e.target.value as "over" | "under")
          }
          className={
            props.inputOverUnder === "over"
              ? styles.toolbarSelectOver
              : styles.toolbarSelectUnder
          }
        >
          <option value="over">OVER</option>
          <option value="under">UNDER</option>
        </select>
        <input
          type="number"
          step="1"
          value={props.inputLine}
          onChange={(e) => props.setInputLine(parseFloat(e.target.value))}
          className={styles.toolbarLineInput}
        />
        <select
          value={props.inputMarket}
          onChange={(e) => props.setInputMarket(e.target.value)}
          className={styles.toolbarPropSelect}
        >
          <option value="points">Points</option>
          <option value="rebounds">Rebounds</option>
          <option value="assists">Assists</option>
          <option value="threes_made">3PT Made</option>
          <optgroup label="Combinations">
            <option value="pra">P + R + A</option>
            <option value="pa">P + A</option>
            <option value="pr">P + R</option>
            <option value="ra">R + A</option>
          </optgroup>
          <optgroup label="Defense">
            <option value="steals">Steals</option>
            <option value="blocks">Blocks</option>
          </optgroup>
        </select>
        <button
          onClick={props.handleSearch}
          className={styles.toolbarSearchBtn}
        >
          🔍 Search
        </button>
        {(props.tip.opponent || props.tip.opponent_team_id) && (
          <div className={styles.toolbarOpponentInfo}>
            vs {props.tip.opponent || props.tip.opponent_team_id} |{" "}
            {props.tip.position || "N/A"}
          </div>
        )}
      </div>
    </>
  );
}
