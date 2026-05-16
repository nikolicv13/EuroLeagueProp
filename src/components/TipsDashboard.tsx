import { useState, useEffect } from "react";
import type { Game, Tip } from "../api/api";
import { fetchGames, fetchTips } from "../api/api";
import TipCard from "./TipCard";
import styles from "./TipsDashboard.module.css";

export default function TipsDashboard() {
  const [games, setGames] = useState<Game[]>([]);
  const [selectedGameId, setSelectedGameId] = useState<string | null>(null);
  const [tips, setTips] = useState<Tip[]>([]);
  const [loading, setLoading] = useState(false);

  const testDate = "2026-05-22";

  useEffect(() => {
    async function loadGames() {
      try {
        const data = await fetchGames(testDate);
        setGames(data);
        if (data.length > 0) {
          setSelectedGameId(data[0].game_id);
        }
      } catch (err) {
        console.error(err);
      }
    }
    loadGames();
  }, []);

  useEffect(() => {
    if (!selectedGameId) return;

    async function loadTips() {
      setLoading(true);
      try {
        const data = await fetchTips(selectedGameId!);
        setTips(data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    loadTips();
  }, [selectedGameId]);

  return (
    <div className={styles.dashboardContainer}>
      {/* LEFT SIDEBAR: Game Dropdown */}
      <div className={styles.sidebar}>
        <h2 className={styles.sidebarTitle}>Select Game</h2>

        {games.length === 0 && (
          <p className={styles.sidebarNoGames}>No games found for {testDate}</p>
        )}

        <select
          className={styles.sidebarSelect}
          value={selectedGameId || ""}
          onChange={(e) => setSelectedGameId(e.target.value)}
        >
          <option value="" disabled>
            -- Choose a game --
          </option>
          {games.map((game) => (
            <option key={game.game_id} value={game.game_id}>
              {game.team_a} vs {game.team_b} ({game.time || "TBD"})
            </option>
          ))}
        </select>
      </div>

      {/* RIGHT MAIN AREA: Tips Grid */}
      <div className={styles.mainContent}>
        {loading && <p>Loading tips...</p>}

        {!loading && tips.length === 0 && selectedGameId && (
          <p>No tips generated for this game.</p>
        )}

        <div className={styles.tipsList}>
          {tips.map((tip) => (
            <TipCard
              key={tip.id}
              tip={tip}
              dateLabel={testDate}
              onGameReport={(t) => console.log("Game report for:", t.player)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
