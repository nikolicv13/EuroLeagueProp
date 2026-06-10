// src/components/player/PlayerSearchPage.tsx
import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { fetchPlayerSearch } from "../../api/api";
import type { PlayerSearchResult } from "../../api/types";
import PlayerToolbar from "./PlayerToolbar";
import styles from "./PlayerStats.module.css"; // Reusing the wrapper styles

export default function PlayerSearchPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [inputLeague, setInputLeague] = useState(
    searchParams.get("leagueId") || "631799",
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<PlayerSearchResult[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedPlayer, setSelectedPlayer] =
    useState<PlayerSearchResult | null>(null);

  const [inputMarket, setInputMarket] = useState("points");
  const [inputLine, setInputLine] = useState(10.5);
  const [inputOverUnder, setInputOverUnder] = useState<"over" | "under">(
    "over",
  );

  const handleSearchChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchQuery(value);
    if (value.length >= 2) {
      try {
        const results = await fetchPlayerSearch(value);
        setSearchResults(results);
        setShowDropdown(true);
      } catch (err) {
        console.error(err);
      }
    } else {
      setSearchResults([]);
      setShowDropdown(false);
      setSelectedPlayer(null);
    }
  };

  const handleSelectPlayer = (player: PlayerSearchResult) => {
    setSearchQuery(player.player_name);
    setSelectedPlayer(player);
    setShowDropdown(false);
  };

  const handleSearch = () => {
    if (!selectedPlayer) return;

    const params = new URLSearchParams();
    params.set("leagueId", inputLeague);
    params.set("propType", inputMarket);
    params.set("propAmount", String(inputLine));
    params.set("overUnder", inputOverUnder);
    params.set("teamId", selectedPlayer.team_id);
    params.set("position", selectedPlayer.position);
    params.set("season", "E2025");
    navigate(`/player-stats/${selectedPlayer.player_id}?${params.toString()}`, {
      state: {
        player_id: selectedPlayer.player_id,
        player: selectedPlayer.player_name,
        position: selectedPlayer.position,
        market: inputMarket,
        line: inputLine,
        selection: inputOverUnder,
        team_id: selectedPlayer.team_id,
        season_code: "E2025",
      },
    });
  };

  return (
    <div className={styles.pageWrapper}>
      <div style={{ width: "100%", maxWidth: "1000px", marginTop: "40px" }}>
        <h1
          style={{
            marginBottom: "32px",
            color: "var(--text-primary)",
            textAlign: "center",
            fontSize: "2rem",
            fontWeight: 800,
          }}
        >
          Player Prop Search
        </h1>

        <PlayerToolbar
          searchQuery={searchQuery}
          handleSearchChange={handleSearchChange}
          searchResults={searchResults}
          showDropdown={showDropdown}
          setShowDropdown={setShowDropdown}
          handleSelectPlayer={handleSelectPlayer}
          inputLeague={inputLeague}
          setInputLeague={setInputLeague}
          inputOverUnder={inputOverUnder}
          setInputOverUnder={setInputOverUnder}
          inputLine={inputLine}
          setInputLine={setInputLine}
          inputMarket={inputMarket}
          setInputMarket={setInputMarket}
          handleSearch={handleSearch}
          showLeagueFilter={true}
        />
      </div>
    </div>
  );
}
