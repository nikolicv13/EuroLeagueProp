import pool from "./db.js";

const ROTO_TO_EUROLEAGUE_TEAMS = {
  DUB: "DUB",
  HTA: "HTA",
  PAO: "PAO",
  ASV: "ASV",
  RMB: "MAD", // Real Madrid
  EFS: "IST", // Efes
  BJK: "BES", // Bayern
  CZV: "RED", // Crvena Zvezda
  PBB: "PRS", // Paris
  MTA: "HTA", // Maccabi (alternative abbr)
  BAR: "BAR",
  MIL: "MIL",
  PAM: "PAM",
  BAS: "BAS",
  OLY: "OLY",
  ZAL: "ZAL",
  VIL: "VIL",
  ULK: "ULK",
  HTA: "HTA",
  BAY: "MUN",
};

async function updateInjuries() {
  try {
    console.log("🏥 Fetching injury report from RotoWire...");

    const res = await fetch(
      "https://www.rotowire.com/euro/tables/injury-report.php?team=ALL&pos=ALL",
    );
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const data = await res.json();
    if (!Array.isArray(data)) throw new Error("Invalid JSON format");

    console.log(`Found ${data.length} injured players.`);

    // 1. Get all players from our DB for matching
    const dbPlayersRes = await pool.query(
      "SELECT player_id, player_name, team_id FROM players",
    );
    const dbPlayers = dbPlayersRes.rows;

    // Normalize helper
    const normalize = (str) =>
      str
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, " ")
        .replace(/\s+/g, " ")
        .trim();

    const findPlayerByName = (name, teamIdEl) => {
      const normName = normalize(name);
      const parts = normName.split(" ").filter((p) => p.length > 1);

      let bestMatch = null;
      let bestScore = 0;

      for (const p of dbPlayers) {
        // If we know the EL team, filter by it first to speed up & avoid false positives
        if (teamIdEl && p.team_id !== teamIdEl) continue;

        const pNorm = normalize(p.player_name);
        const pParts = pNorm.split(" ").filter((p) => p.length > 1);

        let score = 0;
        for (const part of parts) {
          if (pParts.includes(part)) score++;
        }

        if (score > bestScore && score >= Math.min(parts.length, 2)) {
          bestScore = score;
          bestMatch = p;
        }
      }
      return bestMatch;
    };

    // 2. Process and Upsert
    const client = await pool.connect();
    await client.query("BEGIN");

    // Clear old data
    await client.query("TRUNCATE injuries RESTART IDENTITY");

    for (const inj of data) {
      const teamIdEl = ROTO_TO_EUROLEAGUE_TEAMS[inj.team] || inj.team;
      const matchedPlayer = findPlayerByName(inj.player, teamIdEl);

      await client.query(
        `INSERT INTO injuries (rotowire_id, player_name, team_id_rw, team_id_el, position, injury_type, status, return_date, matched_player_id, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
         ON CONFLICT (rotowire_id) DO UPDATE SET 
           status = EXCLUDED.status,
           injury_type = EXCLUDED.injury_type,
           matched_player_id = EXCLUDED.matched_player_id,
           updated_at = NOW()`,
        [
          inj.ID,
          inj.player,
          inj.team,
          teamIdEl,
          inj.position,
          inj.injury,
          inj.status,
          inj.rDate && !inj.rDate.includes("<i>") ? inj.rDate : null,
          matchedPlayer ? matchedPlayer.player_id : null,
        ],
      );

      console.log(
        `✅ ${inj.player} (${teamIdEl}) - ${inj.status} | Matched DB ID: ${matchedPlayer?.player_id || "NONE"}`,
      );
    }

    await client.query("COMMIT");
    client.release();

    console.log("🎉 Injury report updated successfully!");
  } catch (error) {
    console.error("❌ Error updating injuries:", error);
  }
}

// Run it
updateInjuries();
