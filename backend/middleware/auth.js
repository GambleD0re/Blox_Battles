// backend/middleware/auth.js
const jwt = require('jsonwebtoken');
const { validationResult } = require('express-validator');
const db = require('../database/database'); // pg-compatible module

// --- Environment Variable Checks ---
// Ensure critical secrets are defined at startup.
if (!process.env.JWT_SECRET) {
    throw new Error("FATAL ERROR: JWT_SECRET is not defined in .env file.");
}
if (!process.env.BOT_API_KEY) {
    console.warn("Warning: BOT_API_KEY is not defined. Bot authentication will fail.");
}

const ADMIN_TEST_KEY = process.env.ADMIN_TEST_API_KEY;

/**
 * Middleware to authenticate a user's JWT token or a special admin test key.
 */
const authenticateToken = async (req, res, next) => {
    // 1. Check for Admin Test Key
    const testKey = req.headers['x-admin-test-key'];
    if (ADMIN_TEST_KEY && testKey === ADMIN_TEST_KEY) {
        req.user = { id: 'admin-test-user', role: 'admin', username: 'CURL_Admin' };
        return next();
    }

    // 2. Check for JWT Token
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (token == null) {
        return res.status(401).json({ message: 'Access token is missing or invalid.' });
    }

    // 3. Verify JWT and Fetch User
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const userQuery = 'SELECT id, username, email, balance, role, status, avatar_url FROM users WHERE id = $1';
        const { rows } = await db.query(userQuery, [decoded.id]);
        const user = rows[0];

        if (!user) {
            return res.status(404).json({ message: "User not found." });
        }
        
        req.user = user;
        next();
    } catch (err) {
        return res.status(403).json({ message: 'Forbidden: Invalid or expired token.' });
    }
};

/**
 * Middleware to authenticate the bot via its API key.
 */
const authenticateBot = (req, res, next) => {
    const apiKey = req.headers['x-api-key'];
    const botApiKey = process.env.BOT_API_KEY;

    if (!botApiKey) {
        console.error("Server configuration error: BOT_API_KEY is not defined.");
        return res.status(500).json({ message: 'Server configuration error.' });
    }
    if (!apiKey || apiKey !== botApiKey) {
        console.warn(`Unauthorized bot access attempt from IP: ${req.ip}`);
        return res.status(401).json({ message: 'Unauthorized: Invalid or missing API key.' });
    }
    next();
};

/**
 * Middleware to handle validation errors from express-validator.
 */
const handleValidationErrors = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        const errorMessages = errors.array().map(err => err.msg);
        return res.status(400).json({ message: errorMessages[0] });
    }
    next();
};

/**
 * Validates the password against the defined policy.
 */
const validatePassword = (password) => {
    const minLength = 8;
    const hasNumber = /\d/;
    const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/;
    if (password.length < minLength) {
        return { valid: false, message: 'Password must be at least 8 characters long.' };
    }
    if (!hasNumber.test(password)) {
        return { valid: false, message: 'Password must contain at least one number.' };
    }
    if (!hasSpecialChar.test(password)) {
        return { valid: false, message: 'Password must contain at least one special character.' };
    }
    return { valid: true };
};

/**
 * Middleware to check if the authenticated user is an administrator.
 * This should run *after* authenticateToken.
 */
const isAdmin = (req, res, next) => {
    if (req.user && req.user.role === 'admin') {
        next();
    } else {
        res.status(403).json({ message: 'Forbidden: Requires admin privileges.' });
    }
};

module.exports = {
    authenticateToken,
    handleValidationErrors,
    validatePassword,
    isAdmin,
    authenticateBot
};
