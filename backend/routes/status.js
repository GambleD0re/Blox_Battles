// backend/routes/status.js
const express = require('express');
const { body } = require('express-validator');
const db = require('../database/database');
// Note: Ensure the path to your middleware is correct.
// Assuming it's in a 'middleware' folder at the same level as 'routes'.
const { authenticateToken, authenticateBot, handleValidationErrors } = require('../middleware/auth');

const router = express.Router();

// In-memory store for bot heartbeats. This is a simple and effective way
// to track live status without needing database writes for every heartbeat.
const botStatus = new Map();
const BOT_OFFLINE_THRESHOLD = 45 * 1000; // Bots are considered offline after 45 seconds without a heartbeat.

// --- ROUTES ---

/**
 * @route   GET /api/status/health
 * @desc    Public health check endpoint for the hosting service (e.g., Render).
 * @access  Public
 * @important This is the URL you must use in your hosting service's health check settings.
 * It is intentionally simple and does not check the database, ensuring that
 * the service can be marked as "healthy" as long as the server process is running.
 */
router.get('/health', (req, res) => {
    // This route is intentionally public and does not use authentication.
    res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

/**
 * @route   POST /api/status/heartbeat
 * @desc    Endpoint for your regional bots to send a "heartbeat" to signal they are online.
 * @access  Private (Bot Only - requires a valid bot authentication token)
 */
router.post('/heartbeat',
    authenticateBot, // Middleware to ensure only authorized bots can access this.
    body('region').isIn(['Oceania', 'Europe', 'North America']), // Validate the 'region' field.
    handleValidationErrors, // Middleware to handle any validation errors cleanly.
    (req, res) => {
        const { region } = req.body;
        botStatus.set(region, Date.now()); // Store the current timestamp for the given region.
        res.status(200).json({ message: 'Heartbeat received.' });
    }
);

/**
 * @route   GET /api/status/bots
 * @desc    Endpoint for the frontend to get the live status of all regional bots.
 * @access  Private (User Only - requires a valid user authentication token)
 */
router.get('/bots', authenticateToken, (req, res) => {
    const regions = ['North America', 'Europe', 'Oceania'];
    const now = Date.now();

    const statuses = regions.map(region => {
        const lastHeartbeat = botStatus.get(region);
        const isOnline = lastHeartbeat && (now - lastHeartbeat < BOT_OFFLINE_THRESHOLD);
        
        return {
            region: region,
            status: isOnline ? 'online' : 'offline'
        };
    });

    res.status(200).json(statuses);
});

/**
 * @route   GET /api/status/db
 * @desc    Private endpoint to perform a "deep" health check on the database connection.
 * @access  Private (Authenticated Users Only)
 */
router.get('/db', authenticateToken, async (req, res) => {
    try {
        const result = await db.query('SELECT NOW()');
        res.status(200).json({
            status: 'ok',
            database: 'connected',
            db_time: result.rows[0].now
        });
    } catch (error) {
        console.error("Database status check failed:", error);
        res.status(503).json({ // Using 503 Service Unavailable is appropriate here.
            status: 'error',
            database: 'disconnected',
            error: error.message
        });
    }
});

module.exports = router;
