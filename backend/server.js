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
    const opponent = req.query.opponent; // optional: team_id for H2H

    let query = `
      SELECT 
        bs.game_id,
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

    // If opponent is provided, filter for H2H games
    if (opponent) {
      query += ` AND (g.team_id_a = $2 OR g.team_id_b = $2)`;
      params.push(opponent);
    }

    query += ` ORDER BY g.date DESC LIMIT $${params.length + 1}`;
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
    // 1. Get the game details (who is playing?)
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

    // 3. Get all box scores for these players this season (to calculate hit rates)
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
      [playersRes.rows.map((p) => p.player_id), game.season_code, game.date],
    );

    // Group box scores by player for easy lookup
    const playerGames = {};
    for (const bs of boxScoresRes.rows) {
      if (!playerGames[bs.player_id]) playerGames[bs.player_id] = [];
      playerGames[bs.player_id].push(bs);
    }

    // 4. Build the Tips (The "Engine")
    const tips = [];

    for (const p of playersRes.rows) {
      const games = playerGames[p.player_id] || [];
      if (games.length === 0) continue; // Skip if no data

      const isTeamA = p.team_id === game.team_id_a;
      const opponentTeamId = isTeamA ? game.team_id_b : game.team_id_a;
      const opponentTeamName = isTeamA ? game.team_b : game.team_a;

      // Markets we want to generate tips for
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
        if (avg < 1) continue; // Skip players who barely score/assist/rebound

        // Generate the line (e.g., if averaging 12.4 pts, line is 11.5)
        const line = Math.floor(avg) + 0.5;

        // Helper to calculate hit rate
        const calcHitRate = (gameList) => {
          if (gameList.length === 0) return { hits: 0, attempts: 0, rate: 0 };
          let hits = 0;
          let attempts = 0;
          for (const g of gameList) {
            if (g.minutes === "DNP") continue; // Skip games they didn't play
            attempts++;
            if (parseFloat(g[m.key]) > line) hits++;
          }
          return { hits, attempts, rate: attempts > 0 ? hits / attempts : 0 };
        };

        const seasonHR = calcHitRate(games);
        const last5HR = calcHitRate(games.slice(0, 5));
        const last10HR = calcHitRate(games.slice(0, 10));
        const last15HR = calcHitRate(games.slice(0, 15));

        // Vs Opponent filter
        const vsOppGames = games.filter(
          (g) =>
            g.team_id_a === opponentTeamId || g.team_id_b === opponentTeamId,
        );
        const vsOppHR = calcHitRate(vsOppGames);

        // Calculate Score (0-100 rating)
        // Formula: (Last 5 hit rate * 60) + (Minutes per game weight * 40)
        const minutesWeight = Math.min(parseFloat(p.minutes_per_game) / 30, 1); // Max out at 30 mins
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
          selection: "over", // For now, we only suggest "Over"
          line: line,
          odds: 1.9, // Placeholder odds (e.g., -110)
          hit_rates: {
            season: seasonHR,
            last5: last5HR,
            last10: last10HR,
            last15: last15HR,
            vs_opp: vsOppHR,
          },
          score: score,
        });
      }
    }

    // 5. Sort by score (highest first)
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
// START THE SERVER
// ==========================================
app.listen(PORT, () => {
  console.log(`🚀 Server is running on http://localhost:${PORT}`);
});
