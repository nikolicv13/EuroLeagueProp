import type { PlayerSearchResult, CurrentTip } from "../../api/types";
import styles from "./PlayerToolbar.module.css";
import Breadcrumb from "../../components/dashboard/shared/Breadcrumb";
import { useSearchParams } from "react-router-dom";

interface PlayerToolbarProps {
  // Search & Dropdown
  searchQuery: string;
  handleSearchChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  searchResults: PlayerSearchResult[];
  showDropdown: boolean;
  setShowDropdown: (b: boolean) => void;
  handleSelectPlayer: (p: PlayerSearchResult) => void;

  // Inputs
  inputLeague: string;
  showLeagueFilter?: boolean;
  setInputLeague: (v: string) => void;
  inputOverUnder: "over" | "under";
  setInputOverUnder: (v: "over" | "under") => void;
  inputLine: number;
  setInputLine: (v: number) => void;
  inputMarket: string;
  setInputMarket: (v: string) => void;

  // Actions & Data
  handleSearch: () => void;
  tip?: CurrentTip; // Optional now, since Search Page doesn't have a committed tip yet
}

export default function PlayerToolbar(props: PlayerToolbarProps) {
  const [searchParams] = useSearchParams();

  const showLeague = props.showLeagueFilter ?? false;
  const gridClass = showLeague
    ? styles.toolbarGridWithLeague
    : styles.toolbarGridWithoutLeague;

  const currentLeagueId =
    props.inputLeague || searchParams.get("leagueId") || "631799";
  const getLeagueName = (id: string) => {
    if (id === "631799") return "Euroleague";
    if (id === "eurocup") return "Eurocup";
    if (id === "nba") return "NBA";
    return "League";
  };

  return (
    <>
      {!showLeague && (
        <Breadcrumb
          leagueId={currentLeagueId}
          leagueName={getLeagueName(currentLeagueId)}
          playerName={
            props.tip?.player || props.searchQuery || "Unknown Player"
          }
        />
      )}

      <div className={styles.toolbar}>
        <div className={gridClass}>
          {/* ROW 1, COL 1: Player Name */}
          <div
            className={`${styles.formGroup} ${styles.searchGroup} ${showLeague ? styles.withLeague_Player : styles.withoutLeague_Player}`}
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

          {/* ROW 1, COL 2: League (ONLY ON SEARCH PAGE) */}
          {showLeague && props.inputLeague && props.setInputLeague && (
            <div className={`${styles.formGroup} ${styles.withLeague_League}`}>
              <label className={styles.formLabel}>League</label>
              <select
                value={props.inputLeague}
                onChange={(e) => props.setInputLeague!(e.target.value)}
                className={styles.formSelect}
              >
                <option value="631799">Euroleague</option>
                <option value="eurocup">Eurocup</option>
                <option value="nba">NBA</option>
              </select>
            </div>
          )}

          {/* ROW 1, COL 3: Over/Under */}
          <div
            className={`${styles.formGroup} ${showLeague ? styles.withLeague_OverUnder : styles.withoutLeague_OverUnder}`}
          >
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

          {/* ROW 2, COL 1: LINE (30% Left on Stats Page) */}
          <div
            className={`${styles.formGroup} ${showLeague ? styles.withLeague_Line : styles.withoutLeague_Line}`}
          >
            <label className={styles.formLabel}>Line</label>
            <input
              type="number"
              step="0.5"
              value={props.inputLine}
              onChange={(e) => props.setInputLine(parseFloat(e.target.value))}
              className={styles.formInput}
            />
          </div>

          {/* ROW 2, COL 2: PROP TYPE (70% Right on Stats Page) */}
          <div
            className={`${styles.formGroup} ${showLeague ? styles.withLeague_PropType : styles.withoutLeague_PropType}`}
          >
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

          {/* ROW 3: Search Button */}
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
