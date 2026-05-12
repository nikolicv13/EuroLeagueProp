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

    // Search the database
    const result = await pool.query(
      `SELECT 
        p.player_id, 
        p.player_name, 
        p.position, 
        p.team_id,
        ps.season_code,
        ps.points_per_game, 
        ps.assists_per_game, 
        ps.total_rebounds_per_game
      FROM players p
      LEFT JOIN player_season_stats ps 
        ON p.player_id = ps.player_id
      WHERE p.player_name ILIKE $1
      ORDER BY ps.points_per_game DESC
      LIMIT 20`,
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
    const limit = req.query.limit || 10;
    const opponent = req.query.opponent;
    const seasonCode = req.query.season; // <-- ADD THIS
    const gameDate = req.query.date; // <-- ADD THIS

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
      AND bs.minutes != 'DNP'`;

    const params = [playerId];
    let paramIndex = 2;

    // Add season filter if provided
    if (seasonCode) {
      query += ` AND g.season_code = $${paramIndex}`;
      params.push(seasonCode);
      paramIndex++;
    }

    // Add date filter if provided (only games BEFORE this date)
    if (gameDate) {
      query += ` AND g.date <= $${paramIndex}`;
      params.push(gameDate);
      paramIndex++;
    }

    if (opponent) {
      query += ` AND (g.team_id_a = $${paramIndex} OR g.team_id_b = $${paramIndex})`;
      params.push(opponent);
      paramIndex++;
    }

    query += ` ORDER BY g.date DESC LIMIT $${paramIndex}`;
    params.push(limit);

    const result = await pool.query(query, params);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "No stats found for this player" });
    }

    res.json(result.rows);
  } catch (error) {
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
// ROUTE 6: Opponent Defense vs Position
// ==========================================
// Usage: /api/teams/ASV/defense-vs-position/PG?season=E2024&date=2024-01-10
app.get(
  "/api/teams/:teamId/defense-vs-position/:position",
  async (req, res) => {
    try {
      const { teamId, position } = req.params;
      const season = req.query.season;
      const date = req.query.date;

      if (!season || !date) {
        return res.status(400).json({ error: "Season and date are required" });
      }

      // Get all box scores of players with this position who played AGAINST this team
      const result = await pool.query(
        `SELECT 
        bs.points, bs.total_rebounds, bs.assists, 
        bs.three_points_made, bs.steals, bs.blocks_favour, 
        g.date
      FROM box_scores bs
      JOIN games g ON bs.game_id = g.game_id
      JOIN players p ON bs.player_id = p.player_id
      WHERE (g.team_id_a = $1 OR g.team_id_b = $1) -- Opponent is in this game
        AND bs.team_id != $1                       -- Player is NOT on the opponent team
        AND p.position = $2                        -- Player plays the specified position
        AND bs.minutes != 'DNP'                    -- Player actually played
        AND g.season_code = $3                     -- Current season
        AND g.date <= $4                           -- Before the selected game
      ORDER BY g.date DESC`,
        [teamId, position, season, date],
      );

      const games = result.rows;

      if (games.length === 0) {
        return res.json({
          season: null,
          last5: null,
          last10: null,
          last15: null,
        });
      }

      // Helper to calculate averages
      const calcAverages = (gameList) => {
        if (gameList.length === 0) return null;
        const totals = {
          points: 0,
          total_rebounds: 0,
          assists: 0,
          three_points_made: 0,
          steals: 0,
          blocks_favour: 0,
        };
        gameList.forEach((g) => {
          totals.points += parseFloat(g.points) || 0;
          totals.total_rebounds += parseFloat(g.total_rebounds) || 0;
          totals.assists += parseFloat(g.assists) || 0;
          totals.three_points_made += parseFloat(g.three_points_made) || 0;
          totals.steals += parseFloat(g.steals) || 0;
          totals.blocks_favour += parseFloat(g.blocks_favour) || 0;
        });
        const n = gameList.length;
        return {
          points: (totals.points / n).toFixed(1),
          rebounds: (totals.total_rebounds / n).toFixed(1),
          assists: (totals.assists / n).toFixed(1),
          threes: (totals.three_points_made / n).toFixed(1),
          steals: (totals.steals / n).toFixed(1),
          blocks: (totals.blocks_favour / n).toFixed(1),
          sample_size: n,
        };
      };

      res.json({
        season: calcAverages(games),
        last15: calcAverages(games.slice(0, 15)),
        last10: calcAverages(games.slice(0, 10)),
        last5: calcAverages(games.slice(0, 5)),
      });
    } catch (error) {
      res.status(500).json({
        error: "Failed to fetch defense stats",
        details: error.message,
      });
    }
  },
);

// ==========================================
// ROUTE 6: Opponent Defense Rankings vs Position
// ==========================================
app.get("/api/defense/:teamId/:position", async (req, res) => {
  try {
    const { teamId, position } = req.params;

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
          label: getDefenseLabel(row.points_rank, row.total_teams_in_position),
        },
        rebounds: {
          avg: row.avg_rebounds,
          rank: row.rebounds_rank,
          label: getDefenseLabel(
            row.rebounds_rank,
            row.total_teams_in_position,
          ),
        },
        assists: {
          avg: row.avg_assists,
          rank: row.assists_rank,
          label: getDefenseLabel(row.assists_rank, row.total_teams_in_position),
        },
        threes: {
          avg: row.avg_threes,
          rank: row.threes_rank,
          label: getDefenseLabel(row.threes_rank, row.total_teams_in_position),
        },
        steals: {
          avg: row.avg_steals,
          rank: row.steals_rank,
          label: getDefenseLabel(row.steals_rank, row.total_teams_in_position),
        },
        blocks: {
          avg: row.avg_blocks,
          rank: row.blocks_rank,
          label: getDefenseLabel(row.blocks_rank, row.total_teams_in_position),
        },
      },
    });
  } catch (error) {
    res.status(500).json({
      error: "Failed to fetch defense rankings",
      details: error.message,
    });
  }
});

function getDefenseLabel(rank, totalTeams) {
  const percentage = (rank / totalTeams) * 100;
  if (percentage <= 25) return "Strong"; // Top 25% = Best defense
  if (percentage >= 75) return "Weak"; // Bottom 25% = Worst defense
  return "Average";
}

// ==========================================
// START THE SERVER
// ==========================================
app.listen(PORT, () => {
  console.log(`🚀 Server is running on http://localhost:${PORT}`);
});
