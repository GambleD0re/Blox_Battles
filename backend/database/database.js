// backend/database/database.js

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Check for the DATABASE_URL environment variable, which is standard for services like Render.
if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL environment variable is not set. Please configure it in your deployment environment.");
}

// Create a new pool instance to connect to your PostgreSQL database.
// The 'pg' library automatically uses the DATABASE_URL environment variable.
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // If you're using this on a platform that requires SSL for database connections (like Render),
  // you might need to enable it like this.
  ssl: {
    rejectUnauthorized: false
  }
});

// Test the connection
pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error('Error connecting to the PostgreSQL database', err.stack);
  } else {
    console.log('Successfully connected to the PostgreSQL database.');
    // Initialize the database schema if it hasn't been initialized.
    initializeSchema();
  }
});

// Function to read the schema.sql file and execute it.
const initializeSchema = async () => {
  try {
    const schemaSql = fs.readFileSync(path.join(__dirname, 'schema.sql')).toString();
    await pool.query(schemaSql);
    console.log('Database schema checked/initialized successfully.');
  } catch (err) {
    console.error('Error initializing database schema:', err);
  }
};

// Export an object with a query method that uses the pool.
// This makes it a near drop-in replacement for the old db object.
module.exports = {
  query: (text, params) => pool.query(text, params),
};
