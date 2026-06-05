import pg from "pg";
import fs from "fs";
import "dotenv/config";

const { Pool } = pg;

// Connect to Supabase
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function seedOdds() {
  try {
    // 1. Read your local JSON file
    const rawData = fs.readFileSync("./mocks/brazilbet_odds_2.json", "utf-8");
    const oddsData = JSON.parse(rawData);

    console.log(`Found ${oddsData.length} odds. Inserting into Supabase...`);

    // 2. Loop through and insert each odd
    for (const tip of oddsData) {
      await pool.query(
        `INSERT INTO odds (
          id, game_id, start_time, player_id, player, team_id, team, 
          opponent_team_id, opponent, team_abbr, opponent_abbr, position, 
          market, selection, line, odds, overOdds, underOdds, hit_rates, score, league_id
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21
        ) ON CONFLICT (id) DO NOTHING`,
        [
          tip.id,
          tip.game_id,
          tip.start_time,
          tip.player_id,
          tip.player,
          tip.team_id,
          tip.team,
          tip.opponent_team_id,
          tip.opponent,
          tip.team_abbr,
          tip.opponent_abbr,
          tip.position,
          tip.market,
          tip.selection,
          tip.line,
          tip.odds,
          tip.overOdds || null,
          tip.underOdds || null,
          JSON.stringify(tip.hit_rates),
          tip.score,
          "631799", // Defaulting to Euroleague ID
        ],
      );
    }

    console.log("✅ Successfully seeded all odds to Supabase!");
    process.exit(0);
  } catch (err) {
    console.error("❌ Error seeding odds:", err);
    process.exit(1);
  }
}

seedOdds();
