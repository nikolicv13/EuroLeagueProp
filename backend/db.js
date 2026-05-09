import "dotenv/config"; // Loads the secrets from .env
import pg from "pg";

const { Pool } = pg;

// Create a "pool" of connections to your database
const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_DATABASE,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});

export default pool;
