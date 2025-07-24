// backend/server.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const session = require('express-session');
const passport = require('passport');
const db = require('./database/database');
const path = require('path');
const cron = require('node-cron');

// Import services and routes
const priceFeedService = require('./services/priceFeedService');
const transactionListenerService = require('./services/transactionListenerService');
const hdWalletService = require('./services/hdWalletService');

const authRoutes = require('./routes/auth');
const adminRoutes = require('./routes/admin');
const duelRoutes = require('./routes/duels');
const duelHistoryRoutes = require('./routes/duelHistory');
const gameDataRoutes = require('./routes/gameData');
const historyRoutes = require('./routes/history');
const inboxRoutes = require('./routes/inbox');
const leaderboardRoutes = require('./routes/leaderboard');
const logRoutes = require('./routes/logs');
const paymentRoutes = require('./routes/payments');
const payoutRoutes = require('./routes/payouts');
const statusRoutes = require('./routes/status');
const subscriptionRoutes = require('./routes/subscriptions');
const taskRoutes = require('./routes/tasks');
const userRoutes = require('./routes/users');
const { cleanupExpiredDuels } = require('./utils/duelUtils');

const app = express();
const PORT = process.env.PORT || 10000;

// --- CORS Configuration ---
// This is the critical part. We are explicitly telling the backend
// to trust and allow requests coming from our deployed frontend URL.
const allowedOrigins = [
    'https://blox-battles-web.onrender.com',
    'http://localhost:5173' // Also allow your local dev environment for testing
];

const corsOptions = {
    origin: (origin, callback) => {
        // Allow requests with no origin (like mobile apps or curl requests)
        if (!origin) return callback(null, true);
        if (allowedOrigins.indexOf(origin) === -1) {
            const msg = 'The CORS policy for this site does not allow access from the specified Origin.';
            return callback(new Error(msg), false);
        }
        return callback(null, true);
    },
    credentials: true, // This is important for sessions and cookies
};
app.use(cors(corsOptions));


// --- Middleware ---
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session configuration
app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: process.env.NODE_ENV === 'production', // Use secure cookies in production
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
}));

// Passport initialization
app.use(passport.initialize());
app.use(passport.session());

// --- Routes ---
console.log("--- Loading backend routes ---");
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/duels', duelRoutes);
app.use('/api/duel-history', duelHistoryRoutes);
app.use('/api/gamedata', gameDataRoutes);
app.use('/api/history', historyRoutes);
app.use('/api/inbox', inboxRoutes);
app.use('/api/leaderboard', leaderboardRoutes);
app.use('/api/logs', logRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/payouts', payoutRoutes);
app.use('/api/status', statusRoutes);
app.use('/api/subscriptions', subscriptionRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/user', userRoutes);
console.log("--- Finished loading backend routes. ---");


// --- Database and Service Initialization ---
async function initializeApp() {
    try {
        await db.connect();
        console.log('Successfully connected to the PostgreSQL database.');
        await db.initSchema();
        console.log('Database schema checked/initialized successfully.');

        console.log('Database is ready. Loading services and routes...');
        await priceFeedService.initialize();
        console.log('Price Feed Service Initialized successfully.');
        await transactionListenerService.initialize();
        console.log('Transaction Listener Service Initialized.');
        await hdWalletService.initialize();
        console.log('HD Wallet Service Initialized successfully.');

        // Schedule cron jobs
        cron.schedule('*/5 * * * *', () => {
            console.log('Running scheduled job: Cleaning up expired duels...');
            cleanupExpiredDuels();
        });

        app.listen(PORT, () => {
            console.log(`Server is running on port ${PORT}`);
        });

    } catch (error) {
        console.error('Failed to initialize the application:', error);
        process.exit(1);
    }
}

initializeApp();
