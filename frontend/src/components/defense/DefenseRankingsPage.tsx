import { useState, useEffect } from "react";
import { fetchDefenseTable } from "../../api/api";
import type { DefenseTableRow } from "../../api/types";
import styles from "./DefenseRankingsPage.module.css";

const DETAILED_POSITIONS = ["PG", "SG", "SF", "PF", "C"];
const BASIC_POSITIONS = ["Guard", "Forward", "Center"];

export default function DefenseRankingsPage() {
  const [view, setView] = useState<"basic" | "detailed">("basic");
  const [position, setPosition] = useState("Guard");
  const [data, setData] = useState<DefenseTableRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [sortKey, setSortKey] = useState<
    "avg_points" | "avg_rebounds" | "avg_assists"
  >("avg_points");

  // ==========================================
  // ✅ FIX: Fetch logic inside useEffect
  // ==========================================
  useEffect(() => {
    let isMounted = true;

    async function loadData() {
      setLoading(true);
      try {
        const result = await fetchDefenseTable(view, position);
        if (isMounted) setData(result);
      } catch (err) {
        console.error(err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadData();

    return () => {
      isMounted = false;
    };
  }, [view, position]);

  // ==========================================
  // ✅ FIX: Handle view change & position reset in the click handler, NOT an effect
  // ==========================================
  const handleViewChange = (newView: "basic" | "detailed") => {
    setView(newView);

    // Reset position if the current one doesn't belong to the new view
    if (newView === "basic" && DETAILED_POSITIONS.includes(position)) {
      setPosition("Guard");
    } else if (newView === "detailed" && BASIC_POSITIONS.includes(position)) {
      setPosition("PG");
    }
  };

  const sortedData = [...data].sort((a, b) => {
    return (b[sortKey] as number) - (a[sortKey] as number);
  });

  const totalTeams = data.length;

  const getColor = (rank: number) => {
    if (!totalTeams) return "#fff";
    const pct = (rank / totalTeams) * 100;
    if (pct <= 30) return "#4caf50";
    if (pct >= 70) return "#e94560";
    return "#ffc658";
  };

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Defense vs Position Rankings</h1>

      {/* View Toggle */}
      <div className={styles.toggleRow}>
        <button
          onClick={() => handleViewChange("basic")}
          className={view === "basic" ? styles.active : styles.inactive}
        >
          Basic (G / F / C)
        </button>
        <button
          onClick={() => handleViewChange("detailed")}
          className={view === "detailed" ? styles.active : styles.inactive}
        >
          Detailed (PG / SG / SF / PF / C)
        </button>
      </div>

      {/* Position Select */}
      <div className={styles.positionRow}>
        {(view === "basic" ? BASIC_POSITIONS : DETAILED_POSITIONS).map(
          (pos) => (
            <button
              key={pos}
              onClick={() => setPosition(pos)}
              className={
                position === pos ? styles.posActive : styles.posInactive
              }
            >
              {pos}
            </button>
          ),
        )}
      </div>

      {/* Table */}
      {loading ? (
        <p>Loading...</p>
      ) : (
        <div className={styles.tableWrapper}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Rank</th>
                <th>Team</th>
                <th
                  onClick={() => setSortKey("avg_points")}
                  className={styles.sortable}
                >
                  PTS {sortKey === "avg_points" ? "▼" : ""}
                </th>
                <th
                  onClick={() => setSortKey("avg_rebounds")}
                  className={styles.sortable}
                >
                  REB {sortKey === "avg_rebounds" ? "▼" : ""}
                </th>
                <th
                  onClick={() => setSortKey("avg_assists")}
                  className={styles.sortable}
                >
                  AST {sortKey === "avg_assists" ? "▼" : ""}
                </th>
                <th>3PT</th>
                <th>STL</th>
                <th>BLK</th>
              </tr>
            </thead>
            <tbody>
              {sortedData.map((team, idx) => {
                const ptsRank = team.rank_avg_points;
                const rebRank = team.rank_avg_rebounds;
                const astRank = team.rank_avg_assists;

                return (
                  <tr key={team.team_id}>
                    <td className={styles.rankCell}>{idx + 1}</td>
                    <td className={styles.teamCell}>
                      <img
                        src={`/logos/${team.team_id}.png`}
                        alt={team.team_id}
                        className={styles.logo}
                        onError={(e) => {
                          (e.currentTarget as HTMLImageElement).src =
                            "/logos/placeholder.png";
                        }}
                      />
                      <span>{team.team_name}</span>
                    </td>
                    <td style={{ color: getColor(ptsRank) }}>
                      {team.avg_points.toFixed(1)}
                      <span className={styles.microRank}>#{ptsRank}</span>
                    </td>
                    <td style={{ color: getColor(rebRank) }}>
                      {team.avg_rebounds.toFixed(1)}
                      <span className={styles.microRank}>#{rebRank}</span>
                    </td>
                    <td style={{ color: getColor(astRank) }}>
                      {team.avg_assists.toFixed(1)}
                      <span className={styles.microRank}>#{astRank}</span>
                    </td>
                    <td>{team.avg_threes.toFixed(1)}</td>
                    <td>{team.avg_steals.toFixed(1)}</td>
                    <td>{team.avg_blocks.toFixed(1)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
