import pool from "./db.js";

async function testConnection() {
  try {
    const result = await pool.query("SELECT COUNT(*) FROM players");
    console.log("✅ Connected to database!");
    console.log(`🏀 Total players in database: ${result.rows[0].count}`);
  } catch (error) {
    console.error("❌ Connection failed:", error.message);
  } finally {
    await pool.end(); // Close the connection when done
  }
}

testConnection();
