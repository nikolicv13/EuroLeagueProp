import type { ChartDataPoint } from "../../api/types";
import { LOG_PER_PAGE, formatDate, getFG, getWL } from "./utils/playerHelpers";
import styles from "./GameLogTable.module.css";

interface GameLogTableProps {
  fullSeasonChartData: ChartDataPoint[];
  logPage: number;
  setLogPage: (p: number) => void;
  selectedSeason: string;
  phaseFilter: string;
  venueFilter: string;
}

export default function GameLogTable({
  fullSeasonChartData,
  logPage,
  setLogPage,
  selectedSeason,
  phaseFilter,
  venueFilter,
}: GameLogTableProps) {
  return (
    <div className={styles.gameLogContainer}>
      <h3 className={styles.gameLogTitle}>
        Game Log ({selectedSeason})
        {phaseFilter !== "all" &&
          ` - ${phaseFilter === "regular" ? "Regular Season" : "Playoffs"}`}
        {venueFilter !== "all" &&
          ` (${venueFilter === "home" ? "Home" : "Away"})`}
      </h3>
      <div className={styles.tableWrapper}>
        <table className={styles.gameLogTable}>
          <thead>
            <tr>
              <th>R</th>
              <th>DATE</th>
              <th>OPP</th>
              <th>H/A</th>
              <th>W/L</th>
              <th>MIN</th>
              <th>PTS</th>
              <th>FT</th>
              <th>2PT</th>
              <th>3PT</th>
              <th>FG%</th>
              <th>REB</th>
              <th>OR</th>
              <th>DR</th>
              <th>AST</th>
              <th>STL</th>
              <th>BLK</th>
              <th>TO</th>
              <th>FC</th>
              <th>FD</th>
              <th>+/-</th>
              <th>PIR</th>
            </tr>
          </thead>
          <tbody>
            {[...fullSeasonChartData]
              .reverse()
              .slice((logPage - 1) * LOG_PER_PAGE, logPage * LOG_PER_PAGE)
              .map((game) => {
                const isHome = game.team_id === game.team_id_a;
                const oppAbbr = isHome ? game.team_id_b : game.team_id_a;
                const wl = getWL(game);
                return (
                  <tr
                    key={game.game_id}
                    className={wl === "L" ? styles.lossRow : ""}
                  >
                    <td>{game.round || "-"}</td>
                    <td>{formatDate(game.date)}</td>
                    <td className={styles.oppCell}>
                      <img
                        src={`/logos/${oppAbbr}.png`}
                        alt={oppAbbr}
                        className={styles.logLogo}
                      />
                      {oppAbbr}
                    </td>
                    <td>{isHome ? "H" : "A"}</td>
                    <td
                      className={
                        wl === "W"
                          ? styles.winText
                          : wl === "L"
                            ? styles.lossText
                            : ""
                      }
                    >
                      {wl}
                    </td>
                    <td>{game.minutes}</td>
                    <td className={styles.statCell}>{game.points}</td>
                    <td>
                      {game.free_throws_made}/{game.free_throws_attempted}
                    </td>
                    <td>
                      {game.two_points_made}/{game.two_points_attempted}
                    </td>
                    <td>
                      {game.three_points_made}/{game.three_points_attempted}
                    </td>
                    <td>{getFG(game)}%</td>
                    <td className={styles.statCell}>{game.total_rebounds}</td>
                    <td>{game.offensive_rebounds}</td>
                    <td>{game.defensive_rebounds}</td>
                    <td className={styles.statCell}>{game.assists}</td>
                    <td>{game.steals}</td>
                    <td>{game.blocks || game.blocks_favour}</td>
                    <td>{game.turnovers}</td>
                    <td>{game.fouls_committed}</td>
                    <td>{game.fouls_received}</td>
                    <td
                      className={
                        game.plus_minus > 0
                          ? styles.winText
                          : game.plus_minus < 0
                            ? styles.lossText
                            : ""
                      }
                    >
                      {game.plus_minus > 0 ? "+" : ""}
                      {game.plus_minus}
                    </td>
                    <td className={styles.pirCell}>{game.pir}</td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>
      <div className={styles.logPagination}>
        <button
          onClick={() => setLogPage(Math.max(1, logPage - 1))}
          disabled={logPage === 1}
          className={styles.logPageBtn}
        >
          ← Prev 15
        </button>
        <span className={styles.logPageInfo}>
          Page {logPage} of{" "}
          {Math.ceil(fullSeasonChartData.length / LOG_PER_PAGE)}
        </span>
        <button
          onClick={() => setLogPage(logPage + 1)}
          disabled={logPage * LOG_PER_PAGE >= fullSeasonChartData.length}
          className={styles.logPageBtn}
        >
          Next 15 →
        </button>
      </div>
    </div>
  );
}
