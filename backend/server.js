import express from "express";
import cors from "cors";
import pool from "./db.js";

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

// ==========================================
// ROUTE 1: Test Route (keep this from before)
// ==========================================
app.get("/api/test", async (req, res) => {
  try {
    const result = await pool.query("SELECT COUNT(*) FROM players");
    res.json({
      message: "✅ Backend is working and connected to DB!",
      totalPlayers: result.rows[0].count,
    });
  } catch (error) {
    res
      .status(500)
      .json({ error: "❌ Database query failed", details: error.message });
  }
});

// ==========================================
// ROUTE 2: Search Players
// ==========================================
// Usage: http://localhost:3001/api/players/search?q=larkin
app.get("/api/players/search", async (req, res) => {
  try {
    // Get the search word from the URL (?q=...)
    const searchQuery = req.query.q;

    if (!searchQuery) {
      return res
        .status(400)
        .json({ error: "Please provide a search term using ?q=name" });
    }

    const result = await pool.query(
      `SELECT 
        p.player_id, 
        MAX(p.player_name) as player_name, 
        MAX(p.position) as position, 
        MAX(p.team_id) as team_id,
        MAX(ps.points_per_game) as points_per_game,
        MAX(ps.assists_per_game) as assists_per_game,
        MAX(ps.total_rebounds_per_game) as total_rebounds_per_game
      FROM players p
      LEFT JOIN player_season_stats ps 
        ON p.player_id = ps.player_id 
        AND ps.season_code = (
          SELECT MAX(season_code) FROM player_season_stats WHERE player_id = p.player_id
        )
      WHERE p.player_name ILIKE $1
      GROUP BY p.player_id
      ORDER BY MAX(ps.points_per_game) DESC NULLS LAST
      LIMIT 15`,
      [`%${searchQuery}%`],
    );

    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: "Search failed", details: error.message });
  }
});

// ==========================================
// ROUTE 3: Get Player Game Stats (Updated)
// ==========================================
// Usage: http://localhost:3001/api/players/P000229/stats?limit=5&opponent=MAD
app.get("/api/players/:id/stats", async (req, res) => {
  try {
    const playerId = req.params.id;
    // Ensure limit is a number, default to 10
    const limit = parseInt(req.query.limit, 10) || 50;
    const opponent = req.query.opponent;
    const seasonCode = req.query.season;
    const gameDate = req.query.date;

    // 1. FIX: Define currentDate (use today if no date is provided)
    const currentDate = gameDate || new Date().toISOString().split("T")[0];

    let query = `
      SELECT 
        bs.game_id,
        bs.team_id, 
        bs.points,
        bs.total_rebounds,
        bs.assists,
        bs.three_points_made,
        bs.three_points_attempted,
        bs.two_points_attempted,
        bs.minutes,
        g.date,
        g.team_id_a,
        g.team_id_b,
        g.team_a,
        g.team_b,
        g.score_a,
        g.score_b
      FROM box_scores bs
      JOIN games g ON bs.game_id = g.game_id
      WHERE bs.player_id = $1 
        AND g.date <= $2
        AND bs.minutes != 'DNP'
    `;

    let params = [playerId, currentDate];
    let paramIndex = 3; // 3 because $1 and $2 are already used above

    // Add season filter if provided
    if (seasonCode) {
      query += ` AND g.season_code = $${paramIndex}`;
      params.push(seasonCode);
      paramIndex++;
    }

    // Add opponent filter if provided
    if (opponent) {
      query += ` AND (g.team_id_a = $${paramIndex} OR g.team_id_b = $${paramIndex})`;
      params.push(opponent);
      paramIndex++;
    }

    // 2. FIX: Only add ORDER BY once, at the very end
    query += ` ORDER BY g.date DESC`;

    // 3. FIX: Only add LIMIT if limit > 0 (so limit=0 means "fetch all")
    if (limit > 0) {
      query += ` LIMIT $${paramIndex}`;
      params.push(limit);
      paramIndex++;
    }

    const result = await pool.query(query, params);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "No stats found for this player" });
    }

    res.json(result.rows);
  } catch (error) {
    console.error("SQL Error:", error); // Log the real error to your terminal
    res
      .status(500)
      .json({ error: "Failed to fetch stats", details: error.message });
  }
});
// ==========================================
// ROUTE 4: Get Games (For the left filter)
// ==========================================
// Usage: http://localhost:3001/api/games?date=2024-01-15
app.get("/api/games", async (req, res) => {
  try {
    const { date } = req.query;

    // If no date provided, default to today
    const searchDate = date || new Date().toISOString().split("T")[0];

    const result = await pool.query(
      `SELECT 
        game_id, 
        game, 
        date, 
        time, 
        team_id_a, 
        team_id_b, 
        team_a, 
        team_b, 
        score_a, 
        score_b
      FROM games 
      WHERE date = $1
      ORDER BY time ASC`,
      [searchDate],
    );

    res.json(result.rows);
  } catch (error) {
    res
      .status(500)
      .json({ error: "Failed to fetch games", details: error.message });
  }
});

// ==========================================
// ROUTE 5: Get Tips for a specific game
// ==========================================
// Usage: http://localhost:3001/api/tips/E2024_123
app.get("/api/tips/:gameId", async (req, res) => {
  const { gameId } = req.params;

  try {
    // 1. Get the game details
    const gameRes = await pool.query(
      `SELECT game_id, date, time, team_id_a, team_id_b, team_a, team_b, season_code FROM games WHERE game_id = $1`,
      [gameId],
    );
    if (gameRes.rows.length === 0)
      return res.status(404).json({ error: "Game not found" });
    const game = gameRes.rows[0];

    // 2. Get all players from both teams + their season averages
    const playersRes = await pool.query(
      `SELECT 
        p.player_id, p.player_name, p.position, ps.team_id,
        ps.points_per_game, ps.assists_per_game, ps.total_rebounds_per_game,
        ps.three_points_made_per_game, ps.minutes_per_game
      FROM players p
      JOIN player_season_stats ps ON p.player_id = ps.player_id
      WHERE ps.team_id IN ($1, $2)
      AND ps.season_code = $3`,
      [game.team_id_a, game.team_id_b, game.season_code],
    );

    const allPlayerIds = playersRes.rows.map((p) => p.player_id);

    // 3. Get box scores for THIS season (for L5, L10, L15)
    const boxScoresRes = await pool.query(
      `SELECT 
        bs.player_id, bs.points, bs.assists, bs.total_rebounds, 
        bs.three_points_made, bs.minutes, g.date, g.team_id_a, g.team_id_b
      FROM box_scores bs
      JOIN games g ON bs.game_id = g.game_id
      WHERE bs.player_id = ANY($1) 
        AND g.season_code = $2
        AND g.date <= $3
      ORDER BY g.date DESC`,
      [allPlayerIds, game.season_code, game.date],
    );

    // Group season box scores by player
    const playerGames = {};
    for (const bs of boxScoresRes.rows) {
      if (!playerGames[bs.player_id]) playerGames[bs.player_id] = [];
      playerGames[bs.player_id].push(bs);
    }

    // 4. Build the Tips
    const tips = [];

    for (const p of playersRes.rows) {
      const games = playerGames[p.player_id] || [];
      if (games.length === 0) continue;

      const isTeamA = p.team_id === game.team_id_a;
      const opponentTeamId = isTeamA ? game.team_id_b : game.team_id_a;
      const opponentTeamName = isTeamA ? game.team_b : game.team_a;

      const markets = [
        { market: "points", avg: p.points_per_game, key: "points" },
        { market: "assists", avg: p.assists_per_game, key: "assists" },
        {
          market: "rebounds",
          avg: p.total_rebounds_per_game,
          key: "total_rebounds",
        },
        {
          market: "threes_made",
          avg: p.three_points_made_per_game,
          key: "three_points_made",
        },
      ];

      for (const m of markets) {
        const avg = parseFloat(m.avg) || 0;
        if (avg < 1) continue;

        const line = Math.floor(avg) + 0.5;

        const calcHitRate = (gameList) => {
          if (gameList.length === 0) return { hits: 0, attempts: 0, rate: 0 };
          let hits = 0;
          let attempts = 0;
          for (const g of gameList) {
            if (g.minutes === "DNP") continue;
            attempts++;
            const value = parseFloat(g[m.key]) || 0;
            if (value > line) hits++;
          }
          return { hits, attempts, rate: attempts > 0 ? hits / attempts : 0 };
        };

        const seasonHR = calcHitRate(games);
        const last5HR = calcHitRate(games.slice(0, 5));
        const last10HR = calcHitRate(games.slice(0, 10));
        const last15HR = calcHitRate(games.slice(0, 15));

        // Use the pre-fetched H2H games for this specific player
        const h2hRes = await pool.query(
          `SELECT 
            bs.points, bs.assists, bs.total_rebounds, 
            bs.three_points_made, bs.minutes, g.date
          FROM box_scores bs
          JOIN games g ON bs.game_id = g.game_id
          WHERE bs.player_id = $1
            AND bs.minutes != 'DNP'
            AND bs.team_id != $2  -- Player was NOT on the opponent team
            AND (g.team_id_a = $2 OR g.team_id_b = $2)  -- Opponent was in this game
          ORDER BY g.date DESC`,
          [p.player_id, opponentTeamId],
        );
        const h2hGames = h2hRes.rows;
        const vsOppHR = calcHitRate(h2hGames);

        const minutesWeight = Math.min(parseFloat(p.minutes_per_game) / 30, 1);
        const score = Math.round(last5HR.rate * 60 + minutesWeight * 40);

        tips.push({
          id: `${gameId}_${p.player_id}_${m.market}`,
          game_id: game.game_id,
          start_time: game.time || "TBD",
          player_id: p.player_id,
          player: p.player_name,
          team_id: p.team_id,
          team: isTeamA ? game.team_a : game.team_b,
          opponent_team_id: opponentTeamId,
          opponent: opponentTeamName,
          team_abbr: p.team_id,
          opponent_abbr: opponentTeamId,
          position: p.position,
          market: m.market,
          selection: "over",
          line: line,
          odds: 1.9,
          hit_rates: {
            season: seasonHR,
            last5: last5HR,
            last10: last10HR,
            last15: last15HR,
            vs_opp: {
              ...vsOppHR,
              // Attach the actual all-time games here so your graph can use them!
              games: h2hGames.map((g) => ({
                date: g.date,
                value: parseFloat(g[m.key]) || 0,
                minutes: g.minutes,
              })),
            },
          },
          score: score,
        });
      }
    }

    tips.sort((a, b) => b.score - a.score);

    res.json(tips);
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ error: "Failed to generate tips", details: error.message });
  }
});

// ==========================================
// ROUTE 6: Opponent Defense Rankings vs Position
// ==========================================
app.get("/api/defense/:teamId/:position", async (req, res) => {
  try {
    const { teamId, position } = req.params;
    const limit = req.query.limit || "season";

    // ==========================================
    // SEASON: Use the fast pre-calculated Materialized View
    // ==========================================
    if (limit === "season") {
      const result = await pool.query(
        `SELECT * FROM defense_rankings 
         WHERE team_id = $1 AND position = $2`,
        [teamId, position],
      );

      if (result.rows.length === 0) {
        return res.json({
          team_id: teamId,
          position: position,
          message: "No data available",
          stats: null,
        });
      }

      const row = result.rows[0];

      res.json({
        team_id: row.team_id,
        position: row.position,
        total_teams: row.total_teams_in_position,
        stats: {
          points: {
            avg: row.avg_points,
            rank: row.points_rank,
            label: getDefenseLabel(
              row.points_rank,
              row.total_teams_in_position,
            ),
            season_avg: row.avg_points,
            trend: "0.0",
            trend_direction: "same",
          },
          rebounds: {
            avg: row.avg_rebounds,
            rank: row.rebounds_rank,
            label: getDefenseLabel(
              row.rebounds_rank,
              row.total_teams_in_position,
            ),
            season_avg: row.avg_rebounds,
            trend: "0.0",
            trend_direction: "same",
          },
          assists: {
            avg: row.avg_assists,
            rank: row.assists_rank,
            label: getDefenseLabel(
              row.assists_rank,
              row.total_teams_in_position,
            ),
            season_avg: row.avg_assists,
            trend: "0.0",
            trend_direction: "same",
          },
          threes: {
            avg: row.avg_threes,
            rank: row.threes_rank,
            label: getDefenseLabel(
              row.threes_rank,
              row.total_teams_in_position,
            ),
            season_avg: row.avg_threes,
            trend: "0.0",
            trend_direction: "same",
          },
          steals: {
            avg: row.avg_steals,
            rank: row.steals_rank,
            label: getDefenseLabel(
              row.steals_rank,
              row.total_teams_in_position,
            ),
            season_avg: row.avg_steals,
            trend: "0.0",
            trend_direction: "same",
          },
          blocks: {
            avg: row.avg_blocks,
            rank: row.blocks_rank,
            label: getDefenseLabel(
              row.blocks_rank,
              row.total_teams_in_position,
            ),
            season_avg: row.avg_blocks,
            trend: "0.0",
            trend_direction: "same",
          },
        },
      });
    }

    // ==========================================
    // L5 / L10: Calculate dynamically AND compare to Season baseline
    // ==========================================
    else {
      const numLimit = parseInt(limit) || 5;

      // 1. Get the Season baseline (Rank + Avg) from the fast Materialized View
      const baselineRes = await pool.query(
        `SELECT * FROM defense_rankings WHERE team_id = $1 AND position = $2`,
        [teamId, position],
      );
      const baseline = baselineRes.rows.length > 0 ? baselineRes.rows[0] : null;

      // 2. Get the last X games for this team
      const recentGamesRes = await pool.query(
        `SELECT game_id FROM games 
         WHERE (team_id_a = $1 OR team_id_b = $1) 
         ORDER BY date DESC LIMIT $2`,
        [teamId, numLimit],
      );

      if (recentGamesRes.rows.length === 0) {
        return res.json({ team_id: teamId, position: position, stats: null });
      }

      const gameIds = recentGamesRes.rows.map((g) => g.game_id);

      // 3. Get opposing players' stats in those recent games
      const statsRes = await pool.query(
        `SELECT 
          ROUND(AVG(bs.points)::numeric, 2) as avg_points,
          ROUND(AVG(bs.total_rebounds)::numeric, 2) as avg_rebounds,
          ROUND(AVG(bs.assists)::numeric, 2) as avg_assists,
          ROUND(AVG(bs.three_points_made)::numeric, 2) as avg_threes,
          ROUND(AVG(bs.steals)::numeric, 2) as avg_steals,
          ROUND(AVG(bs.blocks_favour)::numeric, 2) as avg_blocks
        FROM box_scores bs
        JOIN players p ON bs.player_id = p.player_id
        WHERE bs.game_id = ANY($1)
          AND p.position = $2
          AND bs.team_id != $3
          AND bs.minutes IS NOT NULL 
          AND bs.minutes != 'DNP'`,
        [gameIds, position, teamId],
      );

      const row = statsRes.rows[0];

      // 4. Helper to build stat object with trend calculation
      const buildStat = (recentAvg, seasonAvg, seasonRank, totalTeams) => {
        const recent = parseFloat(recentAvg) || 0;
        const season = parseFloat(seasonAvg) || 0;
        const diff = recent - season;

        return {
          avg: recent,
          rank: seasonRank, // Keep the season rank for context!
          season_avg: season,
          trend:
            diff !== 0
              ? diff > 0
                ? `+${diff.toFixed(1)}`
                : diff.toFixed(1)
              : "0.0",
          trend_direction:
            diff > 0.5 ? "worse" : diff < -0.5 ? "better" : "same",
          label: getDefenseLabel(seasonRank, totalTeams),
        };
      };

      res.json({
        team_id: teamId,
        position: position,
        total_teams: baseline?.total_teams_in_position || null,
        stats: {
          points: buildStat(
            row.avg_points,
            baseline?.avg_points,
            baseline?.points_rank,
            baseline?.total_teams_in_position,
          ),
          rebounds: buildStat(
            row.avg_rebounds,
            baseline?.avg_rebounds,
            baseline?.rebounds_rank,
            baseline?.total_teams_in_position,
          ),
          assists: buildStat(
            row.avg_assists,
            baseline?.avg_assists,
            baseline?.assists_rank,
            baseline?.total_teams_in_position,
          ),
          threes: buildStat(
            row.avg_threes,
            baseline?.avg_threes,
            baseline?.threes_rank,
            baseline?.total_teams_in_position,
          ),
          steals: buildStat(
            row.avg_steals,
            baseline?.avg_steals,
            baseline?.steals_rank,
            baseline?.total_teams_in_position,
          ),
          blocks: buildStat(
            row.avg_blocks,
            baseline?.avg_blocks,
            baseline?.blocks_rank,
            baseline?.total_teams_in_position,
          ),
        },
      });
    }
  } catch (error) {
    res.status(500).json({
      error: "Failed to fetch defense rankings",
      details: error.message,
    });
  }
});

// Make sure this helper function is still at the bottom of your server.js!
function getDefenseLabel(rank, totalTeams) {
  if (!rank || !totalTeams) return "Average";
  const percentage = (rank / totalTeams) * 100;
  if (percentage <= 25) return "Strong";
  if (percentage >= 75) return "Weak";
  return "Average";
}

// ==========================================
// ROUTE 7: Get Player Info
// ==========================================
app.get("/api/players/:id/info", async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      `SELECT player_id, player_name, position, team_id 
       FROM players 
       WHERE player_id = $1`,
      [id],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Player not found" });
    }

    res.json(result.rows[0]);
  } catch (error) {
    res
      .status(500)
      .json({ error: "Failed to fetch player info", details: error.message });
  }
});

// ==========================================
// ROUTE 8: Search Players
// ==========================================
app.get("/api/players/search", async (req, res) => {
  try {
    const q = req.query.q;
    if (!q || q.length < 2) return res.json([]);

    const result = await pool.query(
      `SELECT DISTINCT ON (player_name) 
        player_id, player_name, team_id, position 
      FROM players 
      WHERE player_name ILIKE $1 
      ORDER BY player_name, player_id DESC 
      LIMIT 10`,
      [`%${q}%`],
    );

    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: "Search failed", details: error.message });
  }
});

// ==========================================
// ROUTE 10: Fetch Player Props from BrazilBet
// ==========================================
// app.get("/api/odds/brazilbet/:leagueId", async (req, res) => {
//   const { leagueId } = req.params;

//   try {
//     const url = `https://www.brazilbet.rs/restapi/offer/sr/sport/SK/league/${leagueId}/mob?annex=51&desktopVersion=2.44.9.7&locale=sr`;

//     const response = await fetch(url);
//     if (!response.ok) throw new Error("Failed to fetch from BrazilBet");

//     const data = await response.json();

//     if (!data.esMatches || data.esMatches.length === 0) {
//       return res.json([]); // No matches available
//     }

//     const tips = [];

//     for (const match of data.esMatches) {
//       const playerName = match.home;
//       const opponentName = match.away;
//       const gameId = String(match.id);
//       const startTime = new Date(match.kickOffTime).toISOString();
//       const params = match.params || {};
//       const odds = match.odds || {};

//       // Helper to get the Over odds (fallback to 1.90 if mapping is unclear)
//       const getOverOdds = () => {
//         const oddsValues = Object.values(odds);
//         return oddsValues.length > 0 ? oddsValues[0] : 1.9;
//       };

//       // Parse POINTS
//       if (params.ouPlPoints) {
//         const line = parseFloat(params.ouPlPoints);
//         tips.push({
//           id: `${gameId}_${playerName}_points`,
//           game_id: gameId,
//           start_time: startTime,
//           player_id: `BET_${playerName.replace(/\s/g, "_")}`,
//           player: playerName,
//           team_id: "TBD",
//           team: playerName, // In this API, 'home' is the player
//           opponent_team_id: "TBD",
//           opponent: opponentName, // 'away' is the team
//           position: "G", // API doesn't provide position
//           market: "points",
//           selection: "over",
//           line: line,
//           odds: getOverOdds(),
//           hit_rates: {
//             season: { hits: 0, attempts: 0, rate: 0 },
//             last5: { hits: 0, attempts: 0, rate: 0 },
//             last10: { hits: 0, attempts: 0, rate: 0 },
//             last15: { hits: 0, attempts: 0, rate: 0 },
//             vs_opp: { hits: 0, attempts: 0, rate: 0 },
//           },
//           score: 50,
//         });
//       }

//       // Parse ASSISTS
//       if (params.ouPlAssists) {
//         const line = parseFloat(params.ouPlAssists);
//         tips.push({
//           id: `${gameId}_${playerName}_assists`,
//           game_id: gameId,
//           start_time: startTime,
//           player_id: `BET_${playerName.replace(/\s/g, "_")}`,
//           player: playerName,
//           team_id: "TBD",
//           team: playerName,
//           opponent_team_id: "TBD",
//           opponent: opponentName,
//           position: "G",
//           market: "assists",
//           selection: "over",
//           line: line,
//           odds: getOverOdds(),
//           hit_rates: {
//             season: { hits: 0, attempts: 0, rate: 0 },
//             last5: { hits: 0, attempts: 0, rate: 0 },
//             last10: { hits: 0, attempts: 0, rate: 0 },
//             last15: { hits: 0, attempts: 0, rate: 0 },
//             vs_opp: { hits: 0, attempts: 0, rate: 0 },
//           },
//           score: 50,
//         });
//       }

//       // Parse REBOUNDS (if available, usually ouPlRebounds)
//       if (params.ouPlRebounds) {
//         const line = parseFloat(params.ouPlRebounds);
//         tips.push({
//           id: `${gameId}_${playerName}_rebounds`,
//           game_id: gameId,
//           start_time: startTime,
//           player_id: `BET_${playerName.replace(/\s/g, "_")}`,
//           player: playerName,
//           team_id: "TBD",
//           team: playerName,
//           opponent_team_id: "TBD",
//           opponent: opponentName,
//           position: "G",
//           market: "rebounds",
//           selection: "over",
//           line: line,
//           odds: getOverOdds(),
//           hit_rates: {
//             season: { hits: 0, attempts: 0, rate: 0 },
//             last5: { hits: 0, attempts: 0, rate: 0 },
//             last10: { hits: 0, attempts: 0, rate: 0 },
//             last15: { hits: 0, attempts: 0, rate: 0 },
//             vs_opp: { hits: 0, attempts: 0, rate: 0 },
//           },
//           score: 50,
//         });
//       }
//     }

//     res.json(tips);
//   } catch (error) {
//     console.error(error);
//     res.status(500).json({
//       error: "Failed to fetch BrazilBet odds",
//       details: error.message,
//     });
//   }
// });

// // ==========================================
// // ROUTE 10: Fetch Odds & Merge with DB Stats
// // ==========================================
// ==========================================
// ROUTE 10: Fetch Odds & Smart Over/Under Selection
// ==========================================
// app.get('/api/odds/brazilbet/:leagueId', async (req, res) => {
//   const { leagueId } = req.params;

//   try {
//     // 1. Fetch props from BrazilBet
//     const url = `https://www.brazilbet.rs/restapi/offer/sr/sport/SK/league/${leagueId}/mob?annex=51&desktopVersion=2.44.9.7&locale=sr`;
//     const response = await fetch(url);
//     if (!response.ok) throw new Error('Failed to fetch from BrazilBet');

//     const data = await response.json();
//     if (!data.esMatches || data.esMatches.length === 0) return res.json([]);

//     const tips = [];

//     // 2. Loop through each available prop
//     for (const match of data.esMatches) {
//       const playerName = match.home;
//       const params = match.params || {};
//       const oddsObj = match.odds || {};

//       // Extract Over and Under odds (usually first is Over, second is Under)
//       const oddsArr = Object.values(oddsObj);
//       const overOdds = oddsArr[0] || 1.90;
//       const underOdds = oddsArr[1] || 1.90;

//       // 3. Try to find this player in our database
//       const playerRes = await pool.query(
//         `SELECT player_id, player_name, position, team_id FROM players WHERE player_name ILIKE $1 LIMIT 1`,
//         [`%${playerName}%`]
//       );

//       if (playerRes.rows.length === 0) continue; // Skip if player not in our DB
//       const dbPlayer = playerRes.rows[0];

//       // 4. Find the REAL opponent from our database (next upcoming game)
//       const nextGameRes = await pool.query(
//         `SELECT game_id, team_id_a, team_id_b, team_a, team_b, date
//          FROM games
//          WHERE (team_id_a = $1 OR team_id_b = $1) AND date >= CURRENT_DATE
//          ORDER BY date ASC LIMIT 1`,
//         [dbPlayer.team_id]
//       );

//       let realOpponentId = "TBD";
//       let realOpponentName = "Unknown";
//       let realGameId = String(match.id);

//       if (nextGameRes.rows.length > 0) {
//         const nextGame = nextGameRes.rows[0];
//         realGameId = nextGame.game_id;

//         if (nextGame.team_id_a === dbPlayer.team_id) {
//           realOpponentId = nextGame.team_id_b;
//           realOpponentName = nextGame.team_b;
//         } else {
//           realOpponentId = nextGame.team_id_a;
//           realOpponentName = nextGame.team_a;
//         }
//       }

//       // 5. Define the markets we want to process
//       const marketMap = {
//         ouPlPoints: { market: "points", key: "points" },
//         ouPlAssists: { market: "assists", key: "assists" },
//         ouPlRebounds: { market: "rebounds", key: "total_rebounds" },
//       };

//       // 6. Process each market
//       for (const [paramKey, config] of Object.entries(marketMap)) {
//         const lineString = params[paramKey];
//         if (!lineString) continue;

//         const line = parseFloat(lineString);

//         // Fetch this player's last 50 games
//         const statsRes = await pool.query(
//           `SELECT bs.${config.key}, bs.minutes
//            FROM box_scores bs
//            JOIN games g ON bs.game_id = g.game_id
//            WHERE bs.player_id = $1
//              AND g.date <= CURRENT_DATE
//              AND bs.minutes IS NOT NULL AND bs.minutes != 'DNP'
//            ORDER BY g.date DESC
//            LIMIT 50`,
//           [dbPlayer.player_id]
//         );

//         const games = statsRes.rows;

//         // 7. Smart Calculation: Analyze BOTH Over and Under hit rates
//         const analyzeMarket = (gameList) => {
//           if (gameList.length === 0) return { selection: "over", rate: 0, hits: 0, attempts: 0 };

//           let overHits = 0;
//           let underHits = 0;
//           let attempts = 0;

//           for (const g of gameList) {
//             const value = parseFloat(g[config.key]) || 0;
//             attempts++;
//             if (value > line) overHits++;
//             else if (value < line) underHits++;
//             // Exactly on the line = push, doesn't count for either
//           }

//           const overRate = attempts > 0 ? overHits / attempts : 0;
//           const underRate = attempts > 0 ? underHits / attempts : 0;

//           // Recommend whichever has a higher hit rate!
//           if (overRate >= underRate) {
//             return { selection: "over", rate: overRate, hits: overHits, attempts };
//           } else {
//             return { selection: "under", rate: underRate, hits: underHits, attempts };
//           }
//         };

//         const seasonAnalysis = analyzeMarket(games);
//         const last5Analysis = analyzeMarket(games.slice(0, 5));
//         const last10Analysis = analyzeMarket(games.slice(0, 10));
//         const last15Analysis = analyzeMarket(games.slice(0, 15));

//         // 8. Determine the final recommendation (Prioritize Last 10 as the best indicator)
//         const finalSelection = last10Analysis.selection;
//         const finalOdds = finalSelection === "over" ? overOdds : underOdds;

//         // 9. Calculate Score (Weight recent form heavily)
//         const minutesRes = await pool.query(
//           `SELECT minutes_per_game FROM player_season_stats WHERE player_id = $1 LIMIT 1`,
//           [dbPlayer.player_id]
//         );
//         const mpg = parseFloat(minutesRes.rows[0]?.minutes_per_game) || 20;
//         const minutesWeight = Math.min(mpg / 30, 1);

//         const score = Math.round(
//           (last5Analysis.rate * 40) +
//           (last10Analysis.rate * 30) +
//           (minutesWeight * 30)
//         );

//         // 10. Build the tip object
//         tips.push({
//           id: `${realGameId}_${dbPlayer.player_id}_${config.market}`,
//           game_id: realGameId,
//           start_time: new Date(match.kickOffTime).toISOString(),
//           player_id: dbPlayer.player_id,
//           player: dbPlayer.player_name || playerName,
//           team_id: dbPlayer.team_id,
//           team: dbPlayer.team_id,
//           opponent_team_id: realOpponentId,
//           opponent: realOpponentName,
//           position: dbPlayer.position,
//           market: config.market,
//           selection: finalSelection, // <-- "over" or "under" based on math!
//           line: line,
//           odds: finalOdds,           // <-- Real odds for the recommended selection!
//           hit_rates: {
//             season: { hits: seasonAnalysis.hits, attempts: seasonAnalysis.attempts, rate: seasonAnalysis.rate },
//             last5: { hits: last5Analysis.hits, attempts: last5Analysis.attempts, rate: last5Analysis.rate },
//             last10: { hits: last10Analysis.hits, attempts: last10Analysis.attempts, rate: last10Analysis.rate },
//             last15: { hits: last15Analysis.hits, attempts: last15Analysis.attempts, rate: last15Analysis.rate },
//             vs_opp: { hits: 0, attempts: 0, rate: 0 }
//           },
//           score: score
//         });
//       }
//     }

//     // Sort by score (best bets at the top)
//     tips.sort((a, b) => b.score - a.score);
//     res.json(tips);

//   } catch (error) {
//     console.error(error);
//     res.status(500).json({ error: 'Failed to process odds', details: error.message });
//   }
// });
// ==========================================
// START THE SERVER
// ==========================================
app.listen(PORT, () => {
  console.log(`🚀 Server is running on http://localhost:${PORT}`);
});
