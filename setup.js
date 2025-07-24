// This script is run once from the root directory to initialize or reset the database.
// Usage: node setup.js

const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const readline = require('readline');

// Define the path to the database file and the schema file.
const dbPath = path.join(__dirname, 'backend', 'database', 'blox_battles.db');
const schemaPath = path.join(__dirname, 'backend', 'database', 'schema.sql');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

// Main function to run the setup logic
const runSetup = () => {
    // Read the SQL schema file.
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');

    // Create a new database connection.
    // This will create the .db file if it doesn't exist.
    const db = new sqlite3.Database(dbPath, (err) => {
        if (err) {
            console.error('Error connecting to database:', err.message);
            rl.close();
            return;
        }
        console.log('Successfully connected to the SQLite database.');
    });

    // Execute the schema script to create tables.
    db.exec(schemaSql, (err) => {
        if (err) {
            console.error('Error executing schema:', err.message);
        } else {
            console.log('Database and tables created successfully from schema.sql.');
        }

        // Close the database connection.
        db.close((err) => {
            if (err) {
                console.error('Error closing database connection:', err.message);
            } else {
                console.log('Database connection closed.');
            }
            rl.close();
        });
    });
};

// --- Script Execution Starts Here ---

// Check if the database file already exists.
if (fs.existsSync(dbPath)) {
    rl.question(
        'Database file already exists. Do you want to delete it and re-create it from schema.sql? (y/n): ',
        (answer) => {
            if (answer.toLowerCase() === 'y') {
                console.log('Deleting existing database...');
                fs.unlinkSync(dbPath);
                console.log('Existing database deleted.');
                runSetup();
            } else {
                console.log('Setup aborted. Existing database was not changed.');
                rl.close();
            }
        }
    );
} else {
    // If the database doesn't exist, just create it.
    console.log('No existing database found. Creating a new one...');
    runSetup();
}
