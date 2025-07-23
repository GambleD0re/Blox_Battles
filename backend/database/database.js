// v1
const { Pool } = require('pg');

// In development, load environment variables from the .env file located in the backend directory.
// In production (like on Render), these variables will be set directly in the environment.
if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config({ path: __dirname + '/../.env' });
}

// --- Database Connection Configuration ---
// This logic ensures the application can connect to the database in both
// local development and the Render production environment.
//
// 1. In Production (on Render):
//    Render provides a single, secure `DATABASE_URL` environment variable.
//    We use this URL directly and enable SSL, which Render requires.
//
// 2. In Development (Local Machine):
//    If `DATABASE_URL` is not found, we assume a local environment and
//    construct the connection details from the individual PG_* variables
//    in the .env file. SSL is disabled for local connections.

const isProduction = process.env.NODE_ENV === 'production';

const connectionConfig = {
  // Use the DATABASE_URL from Render's environment if it exists.
  // Otherwise, fallback to local configuration (which doesn't use a single string).
  connectionString: process.env.DATABASE_URL,
  user: process.env.PG_USER,
  host: process.env.PG_HOST,
  database: process.env.PG_DATABASE,
  password: process.env.PG_PASSWORD,
  port: process.env.PG_PORT,
  // Render requires SSL for its managed PostgreSQL databases.
  // We set `rejectUnauthorized` to `false` to allow self-signed certificates,
  // which is a standard practice for connecting to services like Render/Heroku.
  // This is only applied in the production environment.
  ssl: isProduction ? { rejectUnauthorized: false } : false,
};

// If connectionString is provided (from Render), it takes precedence over individual properties.
// So, we can remove the individual properties if the connectionString exists to avoid conflicts.
if (connectionConfig.connectionString) {
    delete connectionConfig.user;
    delete connectionConfig.host;
    delete connectionConfig.database;
    delete connectionConfig.password;
    delete connectionConfig.port;
}


const pool = new Pool(connectionConfig);

/**
 * Tests the connection to the database to ensure it's configured correctly.
 * Logs a success or error message to the console.
 */
async function testConnection() {
  let client;
  try {
    client = await pool.connect();
    console.log('Successfully connected to the database.');
  } catch (error) {
    console.error('Failed to connect to the database:', error);
    // In case of a connection error, log more details if they are available.
    if (error.routine) {
        console.error(`Database Error Details:
        - Routine: ${error.routine}
        - Code: ${error.code}
        - Message: ${error.message}`);
    }
  } finally {
    // Ensure the client is always released back to the pool.
    if (client) {
      client.release();
    }
  }
}

// Export the query function and the test function for use throughout the application.
module.exports = {
  query: (text, params) => pool.query(text, params),
  testConnection,
};
