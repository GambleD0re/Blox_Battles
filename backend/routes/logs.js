// backend/routes/logs.js
const express = require('express');
const router = express.Router();
// We only need authenticateToken now, removing the problematic authorizeAdmin
const { authenticateToken } = require('../middleware/auth');
const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const db = require('../database/database'); // Import db for the admin check

const logsDirectory = path.join(__dirname, '..', 'logs');

// Ensure logs directory exists on startup
if (!fsSync.existsSync(logsDirectory)) {
    fsSync.mkdirSync(logsDirectory, { recursive: true });
}

// --- Self-contained Admin Check Middleware ---
// This function checks if the user is an admin. We include it directly
// in this file to avoid the import/export issue causing the crash.
const checkAdmin = async (req, res, next) => {
    if (!req.user || !req.user.userId) {
        return res.status(403).json({ message: 'Forbidden: No user context.' });
    }
    try {
        const result = await db.query('SELECT is_admin FROM users WHERE id = $1', [req.user.userId]);
        if (result.rows.length > 0 && result.rows[0].is_admin) {
            next(); // User is an admin, proceed
        } else {
            res.status(403).json({ message: 'Forbidden: Admin access required.' });
        }
    } catch (error) {
        console.error("Authorization error in logs route:", error);
        res.status(500).json({ message: 'Internal server error during authorization.' });
    }
};


/**
 * @route   GET /api/logs
 * @desc    Get a list of all log files
 * @access  Private (Admin)
 */
router.get('/', authenticateToken, checkAdmin, async (req, res) => {
    try {
        const files = await fs.readdir(logsDirectory);
        const logFiles = files.filter(file => file.endsWith('.log')).reverse();
        res.json(logFiles);
    } catch (error) {
        console.error('Error reading logs directory:', error);
        res.status(500).send('Server error');
    }
});

/**
 * @route   GET /api/logs/:filename
 * @desc    Get the content of a specific log file
 * @access  Private (Admin)
 */
router.get('/:filename', authenticateToken, checkAdmin, async (req, res) => {
    try {
        const { filename } = req.params;
        if (filename.includes('..') || !filename.endsWith('.log')) {
            return res.status(400).send('Invalid filename');
        }

        const filePath = path.join(logsDirectory, filename);
        const data = await fs.readFile(filePath, 'utf8');
        res.header('Content-Type', 'text/plain');
        res.send(data);
    } catch (error) {
        if (error.code === 'ENOENT') {
            return res.status(404).send('Log file not found');
        }
        console.error(`Error reading log file ${req.params.filename}:`, error);
        res.status(500).send('Server error');
    }
});

module.exports = router;
