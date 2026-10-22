import express from "express";
import cors from "cors";
import pool from "./db.js"; // This now securely connects to Supabase!
import { fileURLToPath } from "url";
import path from "path";
import dotenv from "dotenv";
import { authMiddleware, optionalAuth } from "./middleware/authMiddleware.js";
import { tierMiddleware } from "./middleware/tierMiddleware.js";
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

const PORT = process.env.PORT || 3001;

app.use(
  cors({
    origin: ["http://localhost:5173", "https://prop-alley.vercel.app"],
    credentials: true,
  }),
);
app.use(express.json());
app.set("pool", pool);
const USE_MOCK_ODDS = process.env.USE_MOCK_ODDS === "true";

// ==========================================
// HELPER: Get Current Euroleague Season Code
// ==========================================
function getCurrentSeasonCode() {
  const now = new Date();
  const month = now.getMonth(); // 0 = Jan, 9 = Oct
  const year = now.getFullYear();

  // Euroleague season EYYYY starts in October of YYYY
  // and ends in Spring of YYYY+1.
  // So, if it's Oct-Dec, we are in season E{currentYear}.
  // If it's Jan-Sept, we are in season E{currentYear - 1}.
  if (month >= 9) {
    // October or later
    return `E${year}`;
  } else {
    return `E${year - 1}`;
  }
}
function getMarketValue(game, market) {
  const pts = parseFloat(game.points) || 0;
  const reb = parseFloat(game.total_rebounds) || 0;
  const ast = parseFloat(game.assists) || 0;
  const stl = parseFloat(game.steals) || 0;
  const blk = parseFloat(game.blocks_favour) || 0;
  const threes = parseFloat(game.three_points_made) || 0;

  switch (market) {
    // Points & Alts
    case "points":
    case "points_alt":
    case "points_alt2":
      return pts;

    // Rebounds & Alts
    case "rebounds":
    case "rebounds_alt":
    case "rebounds_alt2":
      return reb;

    // Assists & Alts
    case "assists":
    case "assists_alt":
      return ast;

    // Others
    case "threes_made":
      return threes;
    case "steals":
      return stl;
    case "blocks":
      return blk;
    case "pa":
      return pts + ast;
    case "pr":
      return pts + reb;
    case "ra":
      return reb + ast;
    case "pra":
      return pts + reb + ast;

    default:
      return 0;
  }
}
function getMarketAvgValue(avgs, market) {
  if (!avgs) return 0;
  const pts = parseFloat(avgs.points_per_game) || 0;
  const reb = parseFloat(avgs.total_rebounds_per_game) || 0;
  const ast = parseFloat(avgs.assists_per_game) || 0;
  const stl = parseFloat(avgs.steals_per_game) || 0;
  const blk = parseFloat(avgs.blocks_favour_per_game) || 0;
  const threes = parseFloat(avgs.three_points_made_per_game) || 0;

  switch (market) {
    case "points":
    case "points_alt":
    case "points_alt2":
      return pts;
    case "rebounds":
    case "rebounds_alt":
    case "rebounds_alt2":
      return reb;
    case "assists":
    case "assists_alt":
      return ast;
    case "threes_made":
      return threes;
    case "steals":
      return stl;
    case "blocks":
      return blk;
    case "pa":
      return pts + ast;
    case "pr":
      return pts + reb;
    case "ra":
      return reb + ast;
    case "pra":
      return pts + reb + ast;
    default:
      return 0;
  }
}

// ==========================================
// AUTH: Get current user profile
// ==========================================
app.get("/api/auth/me", authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT id, email, first_name, last_name, tier, created_at FROM users WHERE id = $1",
      [req.user.id],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "User profile not found" });
    }

    res.json(result.rows[0]);
  } catch (error) {
    res
      .status(500)
      .json({ error: "Failed to fetch profile", details: error.message });
  }
});

// ==========================================
// AUTH: Update profile
// ==========================================
app.put("/api/auth/profile", authMiddleware, async (req, res) => {
  try {
    const { first_name, last_name, username } = req.body;

    // Check if username is already taken (if changing)
    if (username) {
      const existing = await pool.query(
        "SELECT id FROM users WHERE username = $1 AND id != $2",
        [username, req.user.id],
      );
      if (existing.rows.length > 0) {
        return res.status(400).json({ error: "Username is already taken" });
      }
    }

    const result = await pool.query(
      `UPDATE users 
       SET first_name = COALESCE($1, first_name),
           last_name = COALESCE($2, last_name),
           username = COALESCE($3, username),
           updated_at = NOW()
       WHERE id = $4
       RETURNING id, email, username, first_name, last_name, tier`,
      [first_name, last_name, username, req.user.id],
    );

    res.json(result.rows[0]);
  } catch (error) {
    res
      .status(500)
      .json({ error: "Failed to update profile", details: error.message });
  }
});

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
app.get("/api/players/search", optionalAuth, async (req, res) => {
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
app.get("/api/players/:id/stats", optionalAuth, async (req, res) => {
  try {
    const userTier = req.userTier || "pro"; // default to pro if not logged in (off-season)
    const playerId = req.params.id;
    if (/^\d+$/.test(playerId)) {
      const altCheck = await pool.query(
        "SELECT 1 FROM players WHERE player_id = $1 LIMIT 1",
        [`P${playerId}`],
      );
      if (altCheck.rowCount > 0) playerId = `P${playerId}`;
    }
    // Ensure limit is a number, default to 10
    const limitParam = req.query.limit;
    const limit = limitParam !== undefined ? parseInt(limitParam, 10) : 50;
    const opponent = req.query.opponent;
    const seasonCode = req.query.season || getCurrentSeasonCode();
    const gameDate = req.query.date;
    const opposingPlayerId = req.query.oppPlayer;
    const withTeammateId = req.query.withTeammate;
    const withoutTeammateId = req.query.withoutTeammate;

    if (userTier === "free") {
      // Remove these filters — they're pro-only
      if (withTeammateId || withoutTeammateId || opposingPlayerId) {
        return res.status(403).json({
          error: "upgrade_required",
          message: "Teammate and opponent filters require a Pro subscription",
          currentTier: "free",
          requiredTier: "pro",
        });
      }
    }
    let query = `
       SELECT 
        bs.game_id,
        bs.team_id, 
        g.round,
        g.phase,
        g.date,
        g.team_id_a,
        g.team_id_b,
        g.team_a,
        g.team_b,
        g.score_a,
        g.score_b,
        bs.minutes,
        bs.points,
        bs.free_throws_made,
        bs.free_throws_attempted,
        bs.two_points_made,
        bs.two_points_attempted,
        bs.three_points_made,
        bs.three_points_attempted,
        bs.offensive_rebounds,
        bs.defensive_rebounds,
        bs.total_rebounds,
        bs.assists,
        bs.steals,
        bs.blocks_favour as blocks,
        bs.turnovers,
        bs.fouls_committed,
        bs.fouls_received,
        bs.plus_minus,
        bs.valuation as pir
       FROM box_scores bs
      JOIN games g ON bs.game_id = g.game_id
      WHERE bs.player_id = $1 
        AND g.score_quarter_1_a IS NOT NULL
        AND bs.minutes != 'DNP'
    `;

    let params = [playerId];
    let paramIndex = 2; // ✅ Changed to 2 because we removed the $2 date parameter

    if (withTeammateId) {
      query += ` AND EXISTS (
        SELECT 1 FROM box_scores bs2 
        WHERE bs2.game_id = bs.game_id 
          AND bs2.player_id = $${paramIndex} 
          AND bs2.team_id = bs.team_id
          AND bs2.minutes != 'DNP'
      )`;
      params.push(withTeammateId);
      paramIndex++;
    }

    if (withoutTeammateId) {
      query += ` AND NOT EXISTS (
        SELECT 1 FROM box_scores bs2 
        WHERE bs2.game_id = bs.game_id 
          AND bs2.player_id = $${paramIndex} 
          AND bs2.team_id = bs.team_id
          AND bs2.minutes != 'DNP'
      )`;
      params.push(withoutTeammateId);
      paramIndex++;
    }

    if (opposingPlayerId) {
      query += ` AND EXISTS (
        SELECT 1 FROM box_scores bs2 
        WHERE bs2.game_id = bs.game_id 
          AND bs2.player_id = $${paramIndex} 
          AND bs2.minutes != 'DNP'
          AND bs2.team_id != bs.team_id
      )`;
      params.push(opposingPlayerId);
      paramIndex++;
    }

    // Add season filter if provided
    if (seasonCode && seasonCode !== "all") {
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
      return res.json([]);
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

    // ==========================================
    // FIX: BATCH FETCH H2H DATA (No more N+1!)
    // ==========================================
    // Get all H2H games for ALL players against BOTH teams in this matchup
    const h2hAllRes = await pool.query(
      `SELECT 
        bs.player_id, bs.points, bs.assists, bs.total_rebounds, 
        bs.three_points_made, bs.minutes, g.date, bs.team_id, 
        g.team_id_a, g.team_id_b
      FROM box_scores bs
      JOIN games g ON bs.game_id = g.game_id
      WHERE bs.player_id = ANY($1)
        AND bs.minutes != 'DNP'
        AND (
          (g.team_id_a = $2 OR g.team_id_b = $2) OR 
          (g.team_id_a = $3 OR g.team_id_b = $3)
        )
      ORDER BY g.date DESC`,
      [allPlayerIds, game.team_id_a, game.team_id_b],
    );

    // Group H2H games by player_id for O(1) lookup
    const h2hMap = {};
    for (const row of h2hAllRes.rows) {
      if (!h2hMap[row.player_id]) h2hMap[row.player_id] = [];
      h2hMap[row.player_id].push(row);
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
          let hits = 0,
            attempts = 0;
          for (const g of gameList) {
            if (g.minutes === "DNP") continue;
            attempts++;
            const value = getMarketValue(g, m.market);
            if (value > line) hits++;
          }
          return { hits, attempts, rate: attempts > 0 ? hits / attempts : 0 };
        };

        const seasonHR = calcHitRate(games);
        const last5HR = calcHitRate(games.slice(0, 5));
        const last10HR = calcHitRate(games.slice(0, 10));
        const last15HR = calcHitRate(games.slice(0, 15));

        // ==========================================
        // FIX: USE THE MAP INSTEAD OF A NEW QUERY
        // ==========================================
        const allPlayerH2H = h2hMap[p.player_id] || [];

        // Filter the pre-fetched games to only include games against the specific opponent
        const h2hGames = allPlayerH2H.filter(
          (g) =>
            (g.team_id_a === opponentTeamId ||
              g.team_id_b === opponentTeamId) &&
            g.team_id !== opponentTeamId, // Player was NOT on the opponent team
        );

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
      const currentSeason = getCurrentSeasonCode();

      // 1. Get the Season baseline (Rank + Avg) from the fast Materialized View
      const baselineRes = await pool.query(
        `SELECT * FROM defense_rankings WHERE team_id = $1 AND position = $2`,
        [teamId, position],
      );
      const baseline = baselineRes.rows.length > 0 ? baselineRes.rows[0] : null;

      // 2. Get the last X PLAYED games for this team THIS SEASON
      const recentGamesRes = await pool.query(
        `SELECT game_id FROM games 
     WHERE (team_id_a = $1 OR team_id_b = $1) 
       AND season_code = $2
       AND date <= CURRENT_DATE
       AND score_quarter_1_a IS NOT NULL
     ORDER BY date DESC LIMIT $3`,
        [teamId, currentSeason, numLimit],
      );

      if (recentGamesRes.rows.length === 0) {
        return res.json({
          team_id: teamId,
          position: position,
          total_teams: baseline?.total_teams_in_position || null,
          stats: null,
        });
      }

      const gameIds = recentGamesRes.rows.map((g) => g.game_id);

      console.log(
        `🔍 [DEFENSE L${numLimit}] Team: ${teamId}, Position: ${position}`,
      );
      console.log(
        `🔍 [DEFENSE L${numLimit}] Game IDs: ${JSON.stringify(gameIds)}`,
      );

      // 3. Get opposing players' stats in those recent games
      const statsRes = await pool.query(
        `SELECT 
      ROUND(AVG(bs.points)::numeric, 2) as avg_points,
      ROUND(AVG(bs.total_rebounds)::numeric, 2) as avg_rebounds,
      ROUND(AVG(bs.assists)::numeric, 2) as avg_assists,
      ROUND(AVG(bs.three_points_made)::numeric, 2) as avg_threes,
      ROUND(AVG(bs.steals)::numeric, 2) as avg_steals,
      ROUND(AVG(bs.blocks_favour)::numeric, 2) as avg_blocks,
      COUNT(*) as sample_size
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

      console.log(
        `🔍 [DEFENSE L${numLimit}] Sample size: ${row?.sample_size}, Avg PTS: ${row?.avg_points}`,
      );

      // Helper to build stat object with trend calculation
      const buildStat = (recentAvg, seasonAvg, seasonRank, totalTeams) => {
        const recent = parseFloat(recentAvg) || 0;
        const season = parseFloat(seasonAvg) || 0;
        const diff = recent - season;

        return {
          avg: recent,
          rank: seasonRank,
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
// ROUTE 7: Similar Players Performance
// ==========================================
app.get(
  "/api/similar-players/:opponentId/:position/:market",
  authMiddleware,
  tierMiddleware("pro"),
  async (req, res) => {
    try {
      const { opponentId, position, market } = req.params;
      const targetAvg = parseFloat(req.query.targetAvg) || 10;

      // 1. Define similar positions
      const posMap = {
        PG: ["PG", "SG"],
        SG: ["PG", "SG"],
        SF: ["SF", "PF"],
        PF: ["SF", "PF", "C"],
        C: ["PF", "C"],
      };
      const positions = posMap[position] || [position];

      // 2. Map frontend market names to DB columns (WITH ALIASES INCLUDED)
      const statMap = {
        points: { col: "bs.points", avg: "pss.points_per_game" },
        rebounds: {
          col: "bs.total_rebounds",
          avg: "pss.total_rebounds_per_game",
        },
        assists: { col: "bs.assists", avg: "pss.assists_per_game" },
        threes_made: {
          col: "bs.three_points_made",
          avg: "pss.three_points_made_per_game",
        },
        steals: { col: "bs.steals", avg: "pss.steals_per_game" },
        blocks: { col: "bs.blocks_favour", avg: "pss.blocks_favour_per_game" },
        pa: {
          col: "(bs.points + bs.assists)",
          avg: "(pss.points_per_game + pss.assists_per_game)",
        },
        pr: {
          col: "(bs.points + bs.total_rebounds)",
          avg: "(pss.points_per_game + pss.total_rebounds_per_game)",
        },
        ra: {
          col: "(bs.total_rebounds + bs.assists)",
          avg: "(pss.total_rebounds_per_game + pss.assists_per_game)",
        },
        pra: {
          col: "(bs.points + bs.total_rebounds + bs.assists)",
          avg: "(pss.points_per_game + pss.total_rebounds_per_game + pss.assists_per_game)",
        },
      };

      const stat = statMap[market];
      if (!stat) return res.json([]);

      // 3. Fetch top players per game, filtered by similar average
      // NOTE: We use ${stat.col} and ${stat.avg} DIRECTLY without adding 'bs.' or 'pss.' in the query string!
      const query = `
        WITH matched_players AS (
          SELECT player_id FROM players WHERE position = ANY($1::text[])
        ),
        parsed_stats AS (
          SELECT 
            bs.player_id,
            bs.player,
            bs.team_id,
            ${stat.col}::numeric as game_stat,
            g.game_id,
            g.date,
            CAST(SPLIT_PART(bs.minutes, ':', 1) AS numeric) as mins_played,
            ROW_NUMBER() OVER(PARTITION BY g.game_id ORDER BY CAST(SPLIT_PART(bs.minutes, ':', 1) AS numeric) DESC) as game_rn
          FROM box_scores bs
          JOIN games g ON bs.game_id = g.game_id
          JOIN matched_players mp ON bs.player_id = mp.player_id
          WHERE (g.team_id_a = $2 OR g.team_id_b = $2)
            AND bs.team_id != $2
            AND bs.minutes != 'DNP'
        ),
        filtered_stats AS (
          SELECT 
            ps.player_id,
            ps.player,
            ps.team_id,
            ps.game_stat,
            ps.date,
            ${stat.avg}::numeric as avg_stat
          FROM parsed_stats ps
          JOIN player_season_stats pss 
            ON ps.player_id = pss.player_id 
            AND ps.team_id = pss.team_id 
            AND pss.season_code = $4
          WHERE ps.game_rn <= 2
            AND ${stat.avg} >= $3 * 0.6
            AND ${stat.avg} <= $3 * 1.4
        )
        SELECT 
          player_id, player, team_id, game_stat, date, avg_stat
        FROM filtered_stats
        ORDER BY date DESC
        LIMIT 10;
      `;

      const result = await pool.query(query, [
        positions,
        opponentId,
        targetAvg,
        getCurrentSeasonCode(),
      ]);
      res.json(result.rows);
    } catch (error) {
      console.error("SQL Error:", error);
      res.status(500).json({ error: "Failed to fetch similar players" });
    }
  },
);

// ==========================================
// ROUTE 10: Fetch Expanded Props from BrazilBet
// ==========================================
app.get("/api/odds/brazilbet/:leagueId", optionalAuth, async (req, res) => {
  const { leagueId } = req.params;

  // ===== MOCK MODE =====
  if (USE_MOCK_ODDS) {
    try {
      const result = await pool.query(
        "SELECT * FROM odds WHERE league_id = $1 ORDER BY start_time ASC",
        [leagueId],
      );

      const parsedData = result.rows.map((row) => ({
        ...row,
        line: row.line ? parseFloat(row.line) : 0,
        odds: row.odds ? parseFloat(row.odds) : 1.9,
        overOdds: row.overOdds
          ? parseFloat(row.overOdds)
          : row.overodds
            ? parseFloat(row.overodds)
            : undefined,
        underOdds: row.underOdds
          ? parseFloat(row.underOdds)
          : row.underodds
            ? parseFloat(row.underodds)
            : undefined,
        score: row.score ? parseFloat(row.score) : 0,
      }));

      return res.json(parsedData);
    } catch (error) {
      console.error("Error reading mock data from DB:", error);
      return res
        .status(500)
        .json({ error: "Failed to fetch mock data from DB" });
    }
  }

  try {
    // 1. Fetch League Data
    const leagueUrl = `https://www.brazilbet.rs/restapi/offer/sr/sport/SK/league/${leagueId}/mob?annex=51&mobileVersion=2.47.9.2&locale=sr`;
    const leagueRes = await fetch(leagueUrl);
    if (!leagueRes.ok) throw new Error("Failed to fetch league data");
    const leagueData = await leagueRes.json();

    if (!leagueData.esMatches || leagueData.esMatches.length === 0)
      return res.json([]);

    // 2. Fetch Match Details concurrently
    const detailPromises = leagueData.esMatches.map(async (match) => {
      try {
        const detailUrl = `https://www.brazilbet.rs/restapi/offer/sr/match/${match.id}?annex=51&mobileVersion=2.47.9.2&locale=sr`;
        const detailRes = await fetch(detailUrl);
        if (!detailRes.ok) return match;
        return await detailRes.json();
      } catch (err) {
        return match;
      }
    });

    const detailedMatches = await Promise.all(detailPromises);

    // ==========================================
    // OPTIMIZATION: BULK FETCH PLAYERS (1 Query)
    // ==========================================
    const allPlayersRes = await pool.query(
      `SELECT player_id, player_name, position, team_id FROM players`,
    );
    const allPlayers = allPlayersRes.rows;

    const findPlayer = (name) => {
      // 1. Clean up BrazilBet name (strip newlines, trim)
      const cleanName = name.replace(/\s+/g, " ").trim();

      // 2. Helper: strip punctuation (hyphens, apostrophes, periods) and lowercase
      // "Talen Horton-Tucker" -> "talen horton tucker"
      // "Oshae Brissett"      -> "oshae brissett"
      // "T.J. Shorts"         -> "t j shorts"
      const normalize = (str) =>
        str
          .toLowerCase()
          .replace(/'/g, "") // Remove apostrophes entirely (O'SHAE -> OSHAE)
          .replace(/\./g, "") // ✅ FIX: Remove periods entirely (A.J. -> AJ)
          .replace(/[^a-z0-9\s]/g, " ") // replace other punctuation with space
          .replace(/\s+/g, " ") // collapse multiple spaces
          .trim();

      const normalizedName = normalize(cleanName);
      const bbParts = normalizedName.split(" ").filter((p) => p.length > 1);
      // e.g., ["talen", "horton", "tucker"] or ["shorts"] (filters out "t" and "j")

      if (bbParts.length === 0) return null;

      let bestMatch = null;
      let bestScore = 0;

      for (const p of allPlayers) {
        const pNormalized = normalize(p.player_name);
        const dbParts = pNormalized.split(" ").filter((p) => p.length > 1);

        // 3. Score = how many words match EXACTLY (not substring)
        let score = 0;
        for (const bbPart of bbParts) {
          if (dbParts.includes(bbPart)) score++;
        }

        // 4. Determine if this is a good match
        // - For 1-2 word names (e.g., "Oshae Brissett"), we require ALL words to match.
        // - For 3+ word names (e.g., "Both Tut Gach"), we allow 1 missing word (middle name).
        const isGoodMatch =
          (bbParts.length <= 2 && score === bbParts.length) ||
          (bbParts.length >= 3 && score >= 2);

        if (isGoodMatch && score > bestScore) {
          bestScore = score;
          bestMatch = p;
        }
      }

      return bestMatch;
    };

    // ==========================================
    // PRE-MATCH PLAYERS & COLLECT IDS
    // ==========================================
    const matchedPlayersMap = {};
    const uniquePlayerIds = new Set();

    for (const match of detailedMatches) {
      const playerName = match.home;
      const dbPlayer = findPlayer(playerName);

      if (dbPlayer) {
        matchedPlayersMap[match.id] = dbPlayer;
        uniquePlayerIds.add(dbPlayer.player_id);
      } else {
        matchedPlayersMap[match.id] = {
          player_id: `BET_${playerName.replace(/\s/g, "_")}`,
          player_name: playerName,
          position: "G",
          team_id: "TBD",
        };
      }
    }

    const playerIdsArr = Array.from(uniquePlayerIds);

    if (playerIdsArr.length === 0) {
      return res.json([]);
    }

    // ==========================================
    // BULK FETCH TEAMS, GAMES, STATS
    // ==========================================
    const currentSeason = getCurrentSeasonCode();

    // ✅ STATIC TEAM MAPPING (No DB query needed)
    const TEAM_MAP = {
      Fenerbahce: "FEN",
      Partizan: "PAR",
      "Olimpia Milano": "MIL",
      Milano: "MIL",
      Dubai: "DUB",
      Valencia: "PAM",
      "Maccabi Tel Aviv": "TEL",
      Maccabi: "TEL",
      Hapoel: "HTA",
      "Real Madrid": "MAD",
      Madrid: "MAD",
      "Lyon-Villeurbanne": "ASV",
      Villeurbanne: "ASV",
      Asvel: "ASV",
      Baskonia: "BAS",
      Vitoria: "BAS",
      Barcelona: "BAR",
      Bayern: "MUN",
      Munich: "MUN",
      Berlin: "BER",
      Olympiacos: "OLY",
      Panathinaikos: "PAO",
      Zalgiris: "ZAL",
      Kaunas: "ZAL",
      Virtus: "VIL",
      Bologna: "VIL",
      "Crvena Zvezda": "RED",
      Belgrade: "RED",
      Efes: "IST",
      "Anadolu Efes": "IST",
      Istanbul: "IST",
      Paris: "PRS",
      Monaco: "MON",
    };

    const TEAM_ID_TO_NAME = {
      FEN: "Fenerbahce Beko Istanbul",
      PAR: "Partizan Mozzart Bet Belgrade",
      MIL: "Armani Olimpia Milan",
      DUB: "Dubai Basketball",
      PAM: "Valencia Basket",
      HTA: "Hapoel Tel Aviv",
      TEL: "Maccabi Rapyd Tel Aviv",
      MAD: "Real Madrid",
      ASV: "LDLC ASVEL Villeurbanne",
      BAS: "Cazoo Baskonia Vitoria Gasteiz",
      BAR: "FC Barcelona",
      MUN: "FC Bayern Munich",
      BER: "ALBA Berlin",
      OLY: "Olympiacos Piraeus",
      PAO: "Panathinaikos AK Athens",
      ZAL: "Zalgiris Kaunas",
      VIL: "Virtus Segafredo Bologna",
      RED: "Crvena Zvezda Meridianbet Belgrade",
      IST: "Anadolu Efes Istanbul",
      PRS: "Paris Basketball",
      MON: "AS Monaco",
      ULK: "Fenerbahce",
    };

    const resolveOpponentTeam = (name, excludeTeamId) => {
      if (!name) return null;
      const lower = name.toLowerCase().trim();
      for (const [key, id] of Object.entries(TEAM_MAP)) {
        if (id === excludeTeamId) continue;
        if (key.toLowerCase() === lower) return id;
      }
      for (const [key, id] of Object.entries(TEAM_MAP)) {
        if (id === excludeTeamId) continue;
        if (
          lower.includes(key.toLowerCase()) ||
          key.toLowerCase().includes(lower)
        )
          return id;
      }
      return null;
    };

    // 1. Get current teams for all matched players (fallback to most recent season)
    const teamsRes = await pool.query(
      `
      SELECT DISTINCT ON (player_id) player_id, team_id 
      FROM player_season_stats 
      WHERE player_id = ANY($1)
      ORDER BY player_id, season_code DESC
    `,
      [playerIdsArr],
    );

    // ✅ THIS IS THE VARIABLE THAT WAS ACCIDENTALLY DELETED
    const teamMap = {};
    teamsRes.rows.forEach((r) => (teamMap[r.player_id] = r.team_id));

    console.log(
      `🔍 [DEBUG] Season: ${currentSeason}, Matched players: ${playerIdsArr.length}, Found teams: ${teamsRes.rows.length}`,
    );

    // 2. Get next games for all those teams
    const teamIdsArr = Object.values(teamMap);
    let gameMap = {}; // team_id -> next game

    if (teamIdsArr.length > 0) {
      const gamesRes = await pool.query(
        `
        SELECT game_id, team_id_a, team_id_b, team_a, team_b 
        FROM games 
        WHERE (team_id_a = ANY($1) OR team_id_b = ANY($1)) 
          AND date >= CURRENT_DATE 
        ORDER BY date ASC
      `,
        [teamIdsArr],
      );

      gamesRes.rows.forEach((g) => {
        if (!gameMap[g.team_id_a]) gameMap[g.team_id_a] = g;
        if (!gameMap[g.team_id_b]) gameMap[g.team_id_b] = g;
      });
    }

    // ==========================================
    // FETCH STATS FOR CURRENT SEASON ONLY
    // ==========================================
    const statsRes = await pool.query(
      `
      SELECT bs.player_id, bs.points, bs.assists, bs.total_rebounds, 
             bs.three_points_made, bs.steals, bs.blocks_favour, bs.minutes, g.date
      FROM box_scores bs
      JOIN games g ON bs.game_id = g.game_id 
      WHERE bs.player_id = ANY($1) 
        AND g.season_code = $2
        AND g.date <= CURRENT_DATE 
        AND bs.minutes IS NOT NULL 
        AND bs.minutes != 'DNP' 
      ORDER BY bs.player_id, g.date DESC
    `,
      [playerIdsArr, currentSeason],
    );

    const statsMap = {};
    statsRes.rows.forEach((r) => {
      if (!statsMap[r.player_id]) statsMap[r.player_id] = [];
      statsMap[r.player_id].push(r);
    });

    // ==========================================
    // BULK FETCH H2H DATA (Cross-season)
    // ==========================================
    const opponentMap = {}; // player_id -> opponent_team_id
    for (const pid of playerIdsArr) {
      const tid = teamMap[pid];
      const nextGame = gameMap[tid];
      if (nextGame) {
        opponentMap[pid] =
          nextGame.team_id_a === tid ? nextGame.team_id_b : nextGame.team_id_a;
      }
    }

    const opponentIdsSet = new Set(Object.values(opponentMap));
    const opponentIdsArr = Array.from(opponentIdsSet);
    let h2hMap = {}; // player_id -> [games]

    if (opponentIdsArr.length > 0) {
      const h2hRes = await pool.query(
        `
        SELECT bs.player_id, bs.points, bs.assists, bs.total_rebounds, 
               bs.three_points_made, bs.steals, bs.blocks_favour, bs.minutes, g.date,
               g.team_id_a, g.team_id_b, bs.team_id as bs_team_id
        FROM box_scores bs
        JOIN games g ON bs.game_id = g.game_id 
        WHERE bs.player_id = ANY($1) 
          AND (g.team_id_a = ANY($2) OR g.team_id_b = ANY($2))
          AND g.date <= CURRENT_DATE
          AND bs.minutes != 'DNP'
        ORDER BY bs.player_id, g.date DESC
      `,
        [playerIdsArr, opponentIdsArr],
      );

      h2hRes.rows.forEach((r) => {
        const oppId = opponentMap[r.player_id];
        if (
          oppId &&
          (r.team_id_a === oppId || r.team_id_b === oppId) &&
          r.bs_team_id !== oppId
        ) {
          if (!h2hMap[r.player_id]) h2hMap[r.player_id] = [];
          h2hMap[r.player_id].push(r);
        }
      });
    }
    // ==========================================
    // ✅ FETCH INJURIES FROM DB
    // ==========================================
    const injuriesRes = await pool.query(
      `SELECT matched_player_id, team_id_el, position, injury_type, status 
       FROM injuries 
       WHERE status = 'OUT' AND matched_player_id IS NOT NULL`,
    );

    const injuriesByTeam = {};
    injuriesRes.rows.forEach((inj) => {
      if (!injuriesByTeam[inj.team_id_el]) injuriesByTeam[inj.team_id_el] = [];
      injuriesByTeam[inj.team_id_el].push(inj);
    });

    // Helper: Normalize positions into groups (handles both Euroleague PG/SG and RotoWire G/F/C)
    const getPositionGroup = (pos) => {
      if (!pos) return "Other";
      const upper = pos.toUpperCase();
      if (["PG", "SG", "G"].includes(upper)) return "Guard";
      if (["SF", "PF", "F"].includes(upper)) return "Forward";
      if (upper === "C") return "Center";
      return "Other";
    };
    // ==========================================
    // ✅ ALGORITHM V2: FETCH SEASON AVERAGES & DvP
    // ==========================================
    // 1. Get season averages for projection math
    const seasonAvgRes = await pool.query(
      `SELECT player_id, points_per_game, assists_per_game, total_rebounds_per_game, 
              three_points_made_per_game, steals_per_game, blocks_favour_per_game
       FROM player_season_stats 
       WHERE player_id = ANY($1) AND season_code = $2`,
      [playerIdsArr, currentSeason],
    );
    const seasonAvgMap = {};
    seasonAvgRes.rows.forEach((r) => (seasonAvgMap[r.player_id] = r));

    // 2. Get Defense vs Position for matchup multiplier
    const dvpRes = await pool.query(
      `SELECT team_id, position, avg_points, avg_rebounds, avg_assists, 
              points_rank, rebounds_rank, assists_rank, total_teams_in_position
       FROM defense_rankings`,
    );
    const dvpMap = {};
    dvpRes.rows.forEach((r) => {
      if (!dvpMap[r.team_id]) dvpMap[r.team_id] = {};
      dvpMap[r.team_id][r.position] = r;
    });

    // Helper to get market value from a game (for projection averages)
    const getMarketAvg = (gameList, market) => {
      if (!gameList || gameList.length === 0) return 0;
      const total = gameList.reduce(
        (sum, g) => sum + getMarketValue(g, market),
        0,
      );
      return total / gameList.length;
    };

    // Helper to calculate Standard Deviation (Variance)
    const calcStdDev = (gameList, market, mean) => {
      if (!gameList || gameList.length < 2) return 5; // Default STD if not enough data
      const squaredDiffs = gameList.map((g) =>
        Math.pow(getMarketValue(g, market) - mean, 2),
      );
      const variance =
        squaredDiffs.reduce((a, b) => a + b, 0) / (gameList.length - 1);
      return Math.sqrt(variance);
    };

    // ==========================================
    // BUILD TIPS (100% In-Memory, 0 DB Queries)
    // ==========================================
    const tips = [];

    for (const match of detailedMatches) {
      const dbPlayer = matchedPlayersMap[match.id];
      const opponentName = match.away || match.guest || match.opponent || "";
      const params = match.params || {};
      const odds = match.odds || {};
      const oddsArr = Object.values(odds);

      let realOpponentId = "TBD";
      let realOpponentName = opponentName || match.away || "Unknown";
      let realGameId = String(match.id);
      let currentTeamId = dbPlayer.team_id;
      let currentTeamName = dbPlayer.team_id;

      if (uniquePlayerIds.has(dbPlayer.player_id)) {
        // ✅ FIX: Prioritize players table (updated for current season)
        // over teamMap (which might be from last season if current stats aren't imported yet)
        currentTeamId = dbPlayer.team_id || teamMap[dbPlayer.player_id];
        currentTeamName = TEAM_ID_TO_NAME[currentTeamId] || currentTeamId;

        const nextGame = gameMap[currentTeamId];

        if (nextGame) {
          // Found an upcoming game in the DB
          realGameId = nextGame.game_id;
          if (nextGame.team_id_a === currentTeamId) {
            realOpponentId = nextGame.team_id_b;
            realOpponentName =
              TEAM_ID_TO_NAME[nextGame.team_id_b] ||
              nextGame.team_b ||
              nextGame.team_id_b;
          } else {
            realOpponentId = nextGame.team_id_a;
            realOpponentName =
              TEAM_ID_TO_NAME[nextGame.team_id_a] ||
              nextGame.team_a ||
              nextGame.team_id_a;
          }
        } else {
          // No upcoming game in DB — use static mapping from BrazilBet name
          const matchedOppId = resolveOpponentTeam(opponentName, currentTeamId);
          if (matchedOppId) {
            realOpponentId = matchedOppId;
            realOpponentName = TEAM_ID_TO_NAME[matchedOppId] || opponentName;
          } else {
            realOpponentId = "TBD";
            realOpponentName = opponentName || match.away || "Unknown";
          }
        }
      }
      // ==========================================
      // ✅ CHECK FOR INJURED TEAMMATES (FROM DB)
      // ==========================================
      let injuryBoost = 0;
      let injuredTeammates = [];

      if (currentTeamId && currentTeamId !== "TBD") {
        const teamInjuries = injuriesByTeam[currentTeamId] || [];
        const playerPosGroup = getPositionGroup(dbPlayer.position);

        for (const inj of teamInjuries) {
          const injPosGroup = getPositionGroup(inj.position);

          // Match if they share the same position group
          if (injPosGroup === playerPosGroup && playerPosGroup !== "Other") {
            injuredTeammates.push(inj);
          }
        }

        if (injuredTeammates.length > 0) {
          // +15 score points per injured same-position starter, cap at 30
          injuryBoost = Math.min(injuredTeammates.length * 15, 30);

          console.log(
            `🏥 [INJURY] ${dbPlayer.player_name} (${currentTeamId}) boosted +${injuryBoost} | Injured: ${injuredTeammates.map((i) => i.matched_player_id).join(", ")}`,
          );
        }
      }

      const marketConfigs = [
        {
          param: "ouPlPoints",
          market: "points",
          overOddsIdx: 0,
          underOddsIdx: 1,
        },
        {
          param: "ouPlAssists",
          market: "assists",
          overOddsIdx: 2,
          underOddsIdx: 3,
        },
        {
          param: "ouPlRebounds",
          market: "rebounds",
          overOddsIdx: 4,
          underOddsIdx: 5,
        },
        {
          param: "ouPlTPRA",
          market: "pra",
          overOddsId: 55215,
          underOddsId: 55217,
        },
        {
          param: "ouPlTPR",
          market: "pr",
          overOddsId: 55244,
          underOddsId: 55246,
        },
        {
          param: "ouPlTPA",
          market: "pa",
          overOddsId: 55247,
          underOddsId: 55249,
        },
        {
          param: "ouPlTRA",
          market: "ra",
          overOddsId: 55250,
          underOddsId: 55252,
        },
        {
          param: "ouPlSt",
          market: "steals",
          overOddsId: 55672,
          underOddsId: 55674,
        },
        {
          param: "ouPlB",
          market: "blocks",
          overOddsId: 55681,
          underOddsId: 55683,
        },
        {
          param: "ouPlP2",
          market: "points_alt",
          overOddsId: 55253,
          underOddsId: 55255,
        },
        {
          param: "ouPlP3",
          market: "points_alt2",
          overOddsId: 55256,
          underOddsId: 55258,
        },
        {
          param: "ouPlA3",
          market: "assists_alt",
          overOddsId: 55262,
          underOddsId: 55264,
        },
        {
          param: "ouPlR2",
          market: "rebounds_alt",
          overOddsId: 55265,
          underOddsId: 55267,
        },
        {
          param: "ouPlR3",
          market: "rebounds_alt2",
          overOddsId: 55268,
          underOddsId: 55270,
        },
      ];

      for (const config of marketConfigs) {
        const lineString = params[config.param];
        if (!lineString) continue;

        const line = parseFloat(lineString);
        let overOdds = 1.9;
        let underOdds = 1.9;

        if (config.overOddsIdx !== undefined) {
          overOdds = oddsArr[config.overOddsIdx] || 1.9;
          underOdds = oddsArr[config.underOddsIdx] || 1.9;
        } else {
          overOdds = odds[config.overOddsId] || 1.9;
          underOdds = odds[config.underOddsId] || 1.9;
        }

        let hitRates = {
          season: { hits: 0, attempts: 0, rate: 0 },
          last5: { hits: 0, attempts: 0, rate: 0 },
          last10: { hits: 0, attempts: 0, rate: 0 },
          last15: { hits: 0, attempts: 0, rate: 0 },
          vs_opp: { hits: 0, attempts: 0, rate: 0 },
        };
        let score = 50;
        let finalSelection = "over";

        // ✅ FIX: This array now ONLY contains current season games
        const games = statsMap[dbPlayer.player_id] || [];

        if (games.length > 0) {
          // ==========================================
          // 1. CALCULATE HIT RATES (For Frontend UI)
          // ==========================================
          const calcRateForSelection = (list, sel) => {
            let hits = 0,
              attempts = 0;
            for (const g of list) {
              const val = getMarketValue(g, config.market);
              attempts++;
              if (sel === "over" && val > line) hits++;
              if (sel === "under" && val < line) hits++;
            }
            return {
              sel,
              rate: attempts > 0 ? hits / attempts : 0,
              hits,
              attempts,
            };
          };

          // ==========================================
          // 2. ALGORITHM V2: PROJECTIONS & EDGE
          // ==========================================
          const seasonAvgs = seasonAvgMap[dbPlayer.player_id];

          // ✅ FIX: Use the proper per-game helper for season averages
          const seasonMean = getMarketAvgValue(seasonAvgs, config.market);

          const l10Mean = getMarketAvg(games.slice(0, 10), config.market);
          const h2hGames = h2hMap[dbPlayer.player_id] || [];
          const h2hMean = getMarketAvg(h2hGames, config.market);

          // A. Blended Projection
          let projection = seasonMean * 0.5 + l10Mean * 0.5;
          if (h2hGames.length >= 2) {
            projection = seasonMean * 0.3 + l10Mean * 0.4 + h2hMean * 0.3;
          }

          // B. Matchup Multiplier (DvP)
          const posGroup = getPositionGroup(dbPlayer.position);
          const oppDvP = dvpMap[realOpponentId]?.[posGroup];

          if (oppDvP) {
            const rankPct =
              (oppDvP.points_rank || 9) /
              (oppDvP.total_teams_in_position || 18);
            if (rankPct >= 0.75)
              projection *= 1.1; // Weak defense
            else if (rankPct <= 0.25) projection *= 0.9; // Strong defense
          }

          // C. Delta (Cushion) & Variance
          const delta = projection - line;
          const stdDev =
            calcStdDev(games.slice(0, 15), config.market, seasonMean) || 4; // Fallback STD

          // D. Determine Selection & Calculate Z-Score correctly
          let zScore;
          if (delta >= 0) {
            finalSelection = "over";
            zScore = delta / stdDev; // Positive z = high chance of Over
          } else {
            finalSelection = "under";
            zScore = Math.abs(delta) / stdDev; // Positive z = high chance of Under
          }

          // E. Calculate True Probability
          // zScore 0 = 50%, zScore 0.5 = ~62.5%, zScore 1.0 = 75%
          let trueProb = 50 + zScore * 25;
          trueProb = Math.max(10, Math.min(90, trueProb)); // Cap between 10% and 90%

          // F. Calculate Edge (vs Sportsbook Odds)
          const currentOdds = finalSelection === "over" ? overOdds : underOdds;
          const impliedProb = (1 / currentOdds) * 100;
          const edge = trueProb - impliedProb;

          // G. Convert Edge to Score
          let baseScore = edge * 5;

          // Sample Size Penalty
          if (games.length < 5) baseScore *= 0.5;
          else if (games.length < 10) baseScore *= 0.8;

          baseScore = Math.max(0, baseScore);

          // Add Injury Boost
          score = Math.round(baseScore) + injuryBoost;

          // ==========================================
          // 3. FINALIZE HIT RATES FOR UI
          // ==========================================
          const sA = calcRateForSelection(games, finalSelection);
          const l5A = calcRateForSelection(games.slice(0, 5), finalSelection);
          const l10A = calcRateForSelection(games.slice(0, 10), finalSelection);
          const l15A = calcRateForSelection(games.slice(0, 15), finalSelection);
          const vsOppA = calcRateForSelection(h2hGames, finalSelection);

          hitRates = {
            season: sA,
            last5: l5A,
            last10: l10A,
            last15: l15A,
            vs_opp: vsOppA,
          };
        }
        tips.push({
          id: `${realGameId}_${dbPlayer.player_id}_${config.market}_${line}`,
          game_id: realGameId,
          start_time: new Date(match.kickOffTime).toISOString(),
          player_id: dbPlayer.player_id,
          player: (dbPlayer.player_name || match.home || "")
            .replace(/\s+/g, " ")
            .trim(),
          team_id: currentTeamId,
          team: currentTeamName,
          opponent_team_id: realOpponentId,
          opponent: realOpponentName,
          position: dbPlayer.position,
          market: config.market,
          selection: finalSelection,
          line: line,
          odds: finalSelection === "over" ? overOdds : underOdds,
          overOdds: overOdds,
          underOdds: underOdds,
          hit_rates: hitRates,
          score: score,
          // ✅ INJURY DATA FOR FRONTEND
          injury_boost: injuryBoost,
          injured_teammates: injuredTeammates.map((i) => ({
            player_id: i.matched_player_id,
            position: i.position,
            injury: i.injury_type,
          })),
        });
      }
    }

    // Filter tips for free users — only show the daily game
    let filteredTips = tips;
    if (req.userTier === "free") {
      const dailyGameId = await getDailyGame(leagueId);
      if (dailyGameId) {
        filteredTips = tips.filter(
          (t) => String(t.game_id) === String(dailyGameId),
        );
      }
    }

    filteredTips.sort((a, b) => b.score - a.score);
    res.json(filteredTips);
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ error: "Failed to process odds", details: error.message });
  }
});

// ==========================================
// HELPER: Get or pick today's daily game for free users
// ==========================================
async function getDailyGame(leagueId) {
  const today = new Date().toISOString().split("T")[0];

  // Check if we already picked today's game
  const existing = await pool.query(
    "SELECT value FROM site_settings WHERE key = $1",
    [`daily_game_${today}`],
  );

  if (existing.rows.length > 0) {
    return existing.rows[0].value; // game_id
  }

  // Pick the first game chronologically from today's games
  const games = await pool.query(
    `SELECT game_id FROM games 
     WHERE date = $1 
     ORDER BY time ASC 
     LIMIT 1`,
    [today],
  );

  // If no games today, pick the next upcoming game
  let gameId;
  if (games.rows.length > 0) {
    gameId = games.rows[0].game_id;
  } else {
    const nextGame = await pool.query(
      `SELECT game_id FROM games 
       WHERE date > $1 
       ORDER BY date ASC, time ASC 
       LIMIT 1`,
      [today],
    );
    gameId = nextGame.rows[0]?.game_id || null;
  }

  if (gameId) {
    // Store it (upsert so it doesn't fail if race condition)
    await pool.query(
      `INSERT INTO site_settings (key, value, updated_at) 
       VALUES ($1, $2, NOW()) 
       ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW()`,
      [`daily_game_${today}`, gameId],
    );
  }

  return gameId;
}

// ==========================================
// ROUTE: Defense vs Position Full Table
// ==========================================
app.get("/api/defense-rankings-table", async (req, res) => {
  try {
    const view = req.query.view || "detailed"; // detailed | basic
    const position = req.query.position || "PG";

    const positionMapping = {
      Guard: ["PG", "SG"],
      Forward: ["SF", "PF"],
      Center: ["C"],
      PG: ["PG"],
      SG: ["SG"],
      SF: ["SF"],
      PF: ["PF"],
      C: ["C"],
    };

    const positionsToFetch = positionMapping[position] || [position];

    // 1. Fetch all relevant rows from the Materialized View
    const result = await pool.query(
      `SELECT team_id, position, avg_points, avg_rebounds, avg_assists, avg_threes, avg_steals, avg_blocks
       FROM defense_rankings 
       WHERE position = ANY($1)`,
      [positionsToFetch],
    );

    if (result.rows.length === 0) {
      return res.json([]);
    }

    // 2. Team Name Map
    const TEAM_NAMES = {
      FEN: "Fenerbahce",
      PAR: "Partizan",
      MIL: "Milan",
      DUB: "Dubai",
      PAM: "Valencia",
      HTA: "Hapoel",
      TEL: "Maccabi",
      MAD: "Real Madrid",
      ASV: "ASVEL",
      BAS: "Baskonia",
      BAR: "Barcelona",
      MUN: "Bayern",
      OLY: "Olympiacos",
      PAO: "Panathinaikos",
      ZAL: "Zalgiris",
      VIL: "Virtus",
      RED: "Crvena Zvezda",
      IST: "Efes",
      PRS: "Paris",
      MON: "Monaco",
      ULK: "Fenerbahce",
    };

    // 3. Aggregate by team_id (average the positions for Basic view)
    const teamMap = {};
    for (const row of result.rows) {
      if (!teamMap[row.team_id]) {
        teamMap[row.team_id] = {
          team_id: row.team_id,
          team_name: TEAM_NAMES[row.team_id] || row.team_id,
          count: 0,
          avg_points: 0,
          avg_rebounds: 0,
          avg_assists: 0,
          avg_threes: 0,
          avg_steals: 0,
          avg_blocks: 0,
        };
      }
      const t = teamMap[row.team_id];
      t.avg_points += parseFloat(row.avg_points) || 0;
      t.avg_rebounds += parseFloat(row.avg_rebounds) || 0;
      t.avg_assists += parseFloat(row.avg_assists) || 0;
      t.avg_threes += parseFloat(row.avg_threes) || 0;
      t.avg_steals += parseFloat(row.avg_steals) || 0;
      t.avg_blocks += parseFloat(row.avg_blocks) || 0;
      t.count++;
    }

    // Calculate final averages
    const teams = Object.values(teamMap).map((t) => {
      if (t.count > 0) {
        t.avg_points = t.avg_points / t.count;
        t.avg_rebounds = t.avg_rebounds / t.count;
        t.avg_assists = t.avg_assists / t.count;
        t.avg_threes = t.avg_threes / t.count;
        t.avg_steals = t.avg_steals / t.count;
        t.avg_blocks = t.avg_blocks / t.count;
      }
      return t;
    });

    // 4. Assign Ranks (Higher avg = worse defense = higher rank number)
    const assignRank = (arr, key) => {
      arr.sort((a, b) => b[key] - a[key]); // Descending
      arr.forEach((item, i) => {
        item[`rank_${key}`] = i + 1;
      });
    };

    assignRank(teams, "avg_points");
    assignRank(teams, "avg_rebounds");
    assignRank(teams, "avg_assists");
    assignRank(teams, "avg_threes");
    assignRank(teams, "avg_steals");
    assignRank(teams, "avg_blocks");

    // 5. Default sort: Worst points defense first
    teams.sort((a, b) => b.avg_points - a.avg_points);

    res.json(teams);
  } catch (error) {
    console.error("Defense table error:", error);
    res.status(500).json({ error: "Failed to fetch defense table" });
  }
});

// ==========================================
// START THE SERVER
// ==========================================
app.listen(PORT, () => {
  console.log(`🚀 Server is running on port ${PORT}`);
});
