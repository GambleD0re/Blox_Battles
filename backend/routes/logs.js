// backend/routes/logs.js
const express = require('express');
const router = express.Router();
const { authenticateToken, authorizeAdmin } = require('../middleware/auth');
// Updated to use the modern fs/promises API
const fs = require('fs').promises;
const fsSync = require('fs'); // Use fs/promises for async, and regular fs for sync checks
const path = require('path');

// The logs directory is expected to be in the parent directory of 'routes'
const logsDirectory = path.join(__dirname, '..', 'logs');

// Ensure logs directory exists on startup (using synchronous version for simplicity here)
if (!fsSync.existsSync(logsDirectory)) {
    fsSync.mkdirSync(logsDirectory, { recursive: true });
}

/**
 * @route   GET /api/logs
 * @desc    Get a list of all log files
 * @access  Private (Admin)
 */
router.get('/', authenticateToken, authorizeAdmin, async (req, res) => {
    try {
        // Use fs.readdir from fs/promises directly
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
router.get('/:filename', authenticateToken, authorizeAdmin, async (req, res) => {
    try {
        const { filename } = req.params;
        // Basic security check to prevent directory traversal
        if (filename.includes('..') || !filename.endsWith('.log')) {
            return res.status(400).send('Invalid filename');
        }

        const filePath = path.join(logsDirectory, filename);

        // Use fs.readFile from fs/promises directly
        const data = await fs.readFile(filePath, 'utf8');
        res.header('Content-Type', 'text/plain');
        res.send(data);
    } catch (error) {
        // Specifically handle file not found errors
        if (error.code === 'ENOENT') {
            return res.status(404).send('Log file not found');
        }
        console.error(`Error reading log file ${req.params.filename}:`, error);
        res.status(500).send('Server error');
    }
});

module.exports = router;
