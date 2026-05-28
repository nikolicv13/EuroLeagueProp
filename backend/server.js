import express from "express";
import cors from "cors";
import pool from "./db.js";
import fs from "fs";
import { fileURLToPath } from "url";
import path from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());
const USE_MOCK_ODDS = true;

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
    const opposingPlayerId = req.query.oppPlayer;
    const withTeammateId = req.query.withTeammate;
    const withoutTeammateId = req.query.withoutTeammate;

    // 1. FIX: Define currentDate (use today if no date is provided)
    const currentDate = gameDate || new Date().toISOString().split("T")[0];

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
        AND g.date <= $2
        AND bs.minutes != 'DNP'
    `;

    let params = [playerId, currentDate];
    let paramIndex = 3; // 3 because $1 and $2 are already used above

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
// ROUTE 7: Similar Players Performance
// ==========================================
app.get(
  "/api/similar-players/:opponentId/:position/:market",
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
            AND pss.season_code = 'E2025'
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
      ]);
      res.json(result.rows);
    } catch (error) {
      console.error("SQL Error:", error);
      res.status(500).json({ error: "Failed to fetch similar players" });
    }
  },
);
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
// ROUTE 10: Fetch Expanded Props from BrazilBet
// ==========================================
app.get("/api/odds/brazilbet/:leagueId", async (req, res) => {
  // ===== MOCK MODE =====
  if (USE_MOCK_ODDS) {
    try {
      // Read the saved file and return it instantly
      const filePath = path.join(__dirname, "mocks", "brazilbet_odds_2.json");
      const mockData = fs.readFileSync(filePath, "utf8");
      return res.json(JSON.parse(mockData));
    } catch (error) {
      console.error("Error reading mock file:", error);
      return res
        .status(500)
        .json({ error: "Mock data file not found or invalid" });
    }
  }

  const { leagueId } = req.params;

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

    // Helper to match "First Last" or "LAST FIRST" using JS instead of DB queries
    const findPlayer = (name) => {
      const parts = name
        .toLowerCase()
        .split(" ")
        .filter((p) => p.length > 1);
      return allPlayers.find((p) => {
        const pLower = p.player_name.toLowerCase();
        return parts.every((part) => pLower.includes(part));
      });
    };

    // ==========================================
    // OPTIMIZATION: PRE-MATCH PLAYERS & COLLECT IDS
    // ==========================================
    const matchedPlayersMap = {}; // match.id -> dbPlayer
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

    // Early exit if no players matched
    if (playerIdsArr.length === 0) {
      // ... build empty tips fallback if needed, or just return empty
      return res.json([]);
    }

    // ==========================================
    // OPTIMIZATION: BULK FETCH TEAMS, GAMES, STATS (3 Queries)
    // ==========================================

    // 1. Get current teams for all matched players
    const teamsRes = await pool.query(
      `
      SELECT DISTINCT ON (player_id) player_id, team_id 
      FROM player_season_stats 
      WHERE player_id = ANY($1) AND season_code = 'E2025'
    `,
      [playerIdsArr],
    );
    const teamMap = {}; // player_id -> team_id
    teamsRes.rows.forEach((r) => (teamMap[r.player_id] = r.team_id));

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

    // 3. Get Stats for ALL matched players (Last 50 games per player)
    const statsRes = await pool.query(
      `
      SELECT bs.player_id, bs.points, bs.assists, bs.total_rebounds, 
             bs.three_points_made, bs.steals, bs.blocks_favour, bs.minutes, g.date
      FROM box_scores bs
      JOIN games g ON bs.game_id = g.game_id 
      WHERE bs.player_id = ANY($1) 
        AND g.date <= CURRENT_DATE 
        AND bs.minutes IS NOT NULL 
        AND bs.minutes != 'DNP' 
      ORDER BY bs.player_id, g.date DESC
    `,
      [playerIdsArr],
    );

    const statsMap = {}; // player_id -> array of games (max 50)
    statsRes.rows.forEach((r) => {
      if (!statsMap[r.player_id]) statsMap[r.player_id] = [];
      if (statsMap[r.player_id].length < 50) {
        statsMap[r.player_id].push(r);
      }
    });

    // ==========================================
    // OPTIMIZATION: BULK FETCH H2H DATA
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
          AND bs.minutes != 'DNP'
        ORDER BY bs.player_id, g.date DESC
      `,
        [playerIdsArr, opponentIdsArr],
      );

      // Filter to ensure it's against the SPECIFIC opponent for that player
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
    // BUILD TIPS (100% In-Memory, 0 DB Queries)
    // ==========================================
    const tips = [];

    for (const match of detailedMatches) {
      const dbPlayer = matchedPlayersMap[match.id];
      const opponentName = match.away;
      const params = match.params || {};
      const odds = match.odds || {};
      const oddsArr = Object.values(odds);

      let realOpponentId = "TBD";
      let realOpponentName = opponentName || match.away || "Unknown"; // Fallback
      let realGameId = String(match.id);
      let currentTeamId = dbPlayer.team_id;
      let currentTeamName = dbPlayer.team_id;

      // Only process DB logic if we actually matched the player earlier
      if (uniquePlayerIds.has(dbPlayer.player_id)) {
        currentTeamId = teamMap[dbPlayer.player_id] || dbPlayer.team_id;

        const nextGame = gameMap[currentTeamId];
        if (nextGame) {
          realGameId = nextGame.game_id;
          if (nextGame.team_id_a === currentTeamId) {
            realOpponentId = nextGame.team_id_b;
            realOpponentName = nextGame.team_b || nextGame.team_id_b; // Fallback to ID
            currentTeamName = nextGame.team_a || nextGame.team_id_a; // Fallback to ID
          } else {
            realOpponentId = nextGame.team_id_a;
            realOpponentName = nextGame.team_a || nextGame.team_id_a; // Fallback to ID
            currentTeamName = nextGame.team_b || nextGame.team_id_b; // Fallback to ID
          }
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

        // Get pre-fetched stats for this player
        const games = statsMap[dbPlayer.player_id] || [];

        if (games.length > 0) {
          // Determine master selection based on L10
          let l10Over = 0,
            l10Under = 0,
            l10Attempts = 0;
          const last10 = games.slice(0, 10);
          for (const g of last10) {
            const val = getMarketValue(g, config.market); // USE HELPER HERE
            l10Attempts++;
            if (val > line) l10Over++;
            else if (val < line) l10Under++;
          }

          finalSelection =
            l10Attempts > 0 ? (l10Over >= l10Under ? "over" : "under") : "over";

          // Calculate hit rates STRICTLY for the locked-in finalSelection
          const calcRate = (list) => {
            let hits = 0,
              attempts = 0;
            for (const g of list) {
              const val = getMarketValue(g, config.market); // USE HELPER HERE
              attempts++;
              if (finalSelection === "over" && val > line) hits++;
              if (finalSelection === "under" && val < line) hits++;
            }
            return {
              sel: finalSelection,
              rate: attempts > 0 ? hits / attempts : 0,
              hits,
              attempts,
            };
          };

          const sA = calcRate(games);
          const l5A = calcRate(games.slice(0, 5));
          const l10A = calcRate(games.slice(0, 10));
          const l15A = calcRate(games.slice(0, 15));

          // --- ADD H2H CALCULATION HERE ---
          const h2hGames = h2hMap[dbPlayer.player_id] || [];
          const vsOppA = calcRate(h2hGames);

          // --- UPDATE vs_opp WITH vsOppA ---
          hitRates = {
            season: sA,
            last5: l5A,
            last10: l10A,
            last15: l15A,
            vs_opp: vsOppA,
          };
          score = Math.round(l5A.rate * 40 + l10A.rate * 30 + 30);
        }

        tips.push({
          id: `${realGameId}_${dbPlayer.player_id}_${config.market}_${line}`,
          game_id: realGameId,
          start_time: new Date(match.kickOffTime).toISOString(),
          player_id: dbPlayer.player_id,
          player: dbPlayer.player_name || match.home,
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
        });
      }
    }

    tips.sort((a, b) => b.score - a.score);
    res.json(tips);
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ error: "Failed to process odds", details: error.message });
  }
});
// ==========================================
// START THE SERVER
// ==========================================
app.listen(PORT, () => {
  console.log(`🚀 Server is running on http://localhost:${PORT}`);
});
