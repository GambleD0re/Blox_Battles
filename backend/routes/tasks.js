// backend/routes/tasks.js
const express = require('express');
const router = express.Router();
const db = require('../database/database');
const { authenticateToken, authorizeAdmin } = require('../middleware/auth');

/**
 * @route   GET /api/tasks/unseen-results
 * @desc    Get duel results that the user hasn't seen yet.
 * @access  Private
 */
router.get('/unseen-results', authenticateToken, async (req, res) => {
    try {
        const query = `
            SELECT 
                d.id, 
                d.status, 
                d.winner_id,
                p1.linked_roblox_username as player1_username,
                p2.linked_roblox_username as player2_username
            FROM duels d
            JOIN users p1 ON d.player1_id = p1.id
            JOIN users p2 ON d.player2_id = p2.id
            WHERE (d.player1_id = $1 OR d.player2_id = $1) AND d.status = 'completed_unseen'
        `;
        const { rows } = await db.query(query, [req.user.userId]);
        res.json(rows);
    } catch (error) {
        console.error('Error fetching unseen duel results:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

/**
 * @route   POST /api/tasks/confirm-result/:duelId
 * @desc    Mark a duel result as seen by the user.
 * @access  Private
 */
router.post('/confirm-result/:duelId', authenticateToken, async (req, res) => {
    const { duelId } = req.params;
    try {
        // First, verify the user is part of this duel to prevent unauthorized confirmations.
        const duelCheckQuery = 'SELECT * FROM duels WHERE id = $1 AND (player1_id = $2 OR player2_id = $2)';
        const duelCheckResult = await db.query(duelCheckQuery, [duelId, req.user.userId]);

        if (duelCheckResult.rows.length === 0) {
            return res.status(403).json({ message: 'You are not authorized to confirm this duel result.' });
        }

        // If authorized, update the status.
        const updateQuery = "UPDATE duels SET status = 'completed' WHERE id = $1 AND status = 'completed_unseen'";
        const result = await db.query(updateQuery, [duelId]);

        if (result.rowCount > 0) {
            res.status(200).json({ message: 'Duel result confirmed.' });
        } else {
            // This can happen if the result was already confirmed in another session.
            res.status(409).json({ message: 'Result already confirmed or duel not in correct state.' });
        }
    } catch (error) {
        console.error(`Error confirming result for duel ${duelId}:`, error);
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;
