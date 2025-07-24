// backend/routes/status.js
const express = require('express');
const { body } = require('express-validator');
const db = require('../database/database');
const { authenticateToken, authenticateBot, handleValidationErrors } = require('../middleware/auth');

const router = express.Router();

// In-memory store for bot heartbeats.
const botStatus = new Map();
const BOT_OFFLINE_THRESHOLD = 45 * 1000; // 45 seconds

// --- ROUTES ---

/**
 * @route   GET /api/status/health
 * @desc    Public health check endpoint for the hosting service (e.g., Render).
 * @access  Public
 * @important This is the URL you must use in your hosting service's health check settings.
 */
router.get('/health', (req, res) => {
    // This route is intentionally public and does not use authentication.
    res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

/**
 * @route   POST /api/status/heartbeat
 * @desc    Endpoint for bots to send their heartbeat.
 * @access  Private (Bot Only)
 */
router.post('/heartbeat',
    authenticateBot,
    body('region').isIn(['Oceania', 'Europe', 'North America']),
    handleValidationErrors,
    (req, res) => {
        const { region } = req.body;
        botStatus.set(region, Date.now());
        res.status(200).json({ message: 'Heartbeat received.' });
    }
);

/**
 * @route   GET /api/status/bots
 * @desc    Endpoint for the frontend to get the live status of all regional bots.
 * @access  Private (User Only)
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
 * @desc    Private endpoint to check the database connection status.
 * @access  Private (Admin Only - or authenticated users)
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
        res.status(500).json({
            status: 'error',
            database: 'disconnected',
            error: error.message
        });
    }
});


module.exports = router;
