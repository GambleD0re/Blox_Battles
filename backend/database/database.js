// backend/database/database.js

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Check for the DATABASE_URL environment variable.
if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL environment variable is not set. Please configure it in your deployment environment.");
}

// Create a new pool instance to connect to your PostgreSQL database.
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // This is often required for cloud database providers like Render.
  ssl: {
    rejectUnauthorized: false
  }
});

/**
 * Connects to the database and runs the schema.sql script to ensure
 * all tables are created. This function will now be called explicitly
 * at server startup.
 */
const initializeDatabase = async () => {
  try {
    // 1. Test the connection
    await pool.query('SELECT NOW()');
    console.log('Successfully connected to the PostgreSQL database.');

    // 2. Read and execute the schema file to create tables if they don't exist.
    const schemaSql = fs.readFileSync(path.join(__dirname, 'schema.sql')).toString();
    await pool.query(schemaSql);
    console.log('Database schema checked/initialized successfully.');
  } catch (err) {
    console.error('CRITICAL: Error during database initialization:', err);
    // If the database can't be initialized, the application cannot run.
    process.exit(1);
  }
};

// Export the query method and the new initialization function.
module.exports = {
  query: (text, params) => pool.query(text, params),
  initializeDatabase
};
