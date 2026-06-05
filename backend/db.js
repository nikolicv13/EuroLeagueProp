import pkg from "pg";
const { Pool } = pkg;
import dotenv from "dotenv";

dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
});

// Test the connection
pool.query("SELECT NOW()", (err, res) => {
  if (err) console.error("❌ Database connection error:", err);
  else console.log("✅ Successfully connected to Supabase!");
});

export default pool;
