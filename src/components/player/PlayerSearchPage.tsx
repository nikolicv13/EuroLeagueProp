import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { fetchPlayerSearch } from "../../api/api";
import type { PlayerSearchResult } from "../../api/types";
import PlayerToolbar from "./PlayerToolbar";
import styles from "./PlayerStats.module.css";

export default function PlayerSearchPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Pre-fill league from URL if it exists (e.g., ?leagueId=631799)
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
    if (!selectedPlayer) return; // Prevent search if no player selected

    // Build the URL with all the parameters
    const params = new URLSearchParams();
    params.set("leagueId", inputLeague);
    params.set("propType", inputMarket);
    params.set("propAmount", String(inputLine));
    params.set("overUnder", inputOverUnder);
    params.set("teamId", selectedPlayer.team_id);
    params.set("position", selectedPlayer.position);

    // Navigate to the PlayerStats page
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
    <div
      className={styles.pageLayout}
      style={{ justifyContent: "center", paddingTop: "4rem" }}
    >
      <div style={{ width: "100%", maxWidth: "900px" }}>
        <h1 style={{ marginBottom: "24px", color: "#16213e" }}>
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
          showLeagueFilter={true}
          setInputLeague={setInputLeague}
          inputOverUnder={inputOverUnder}
          setInputOverUnder={setInputOverUnder}
          inputLine={inputLine}
          setInputLine={setInputLine}
          inputMarket={inputMarket}
          setInputMarket={setInputMarket}
          handleSearch={handleSearch}
        />
      </div>
    </div>
  );
}
