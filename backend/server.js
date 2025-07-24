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
const botRoutes = require('./routes/bot');
// REMOVED: const { cleanupExpiredDuels } = require('./utils/duelUtils'); // This file does not exist

const app = express();
const PORT = process.env.PORT || 10000;

// --- CORS Configuration ---
const allowedOrigins = [
    'https://blox-battles-web.onrender.com',
    'http://localhost:5173'
];

const corsOptions = {
    origin: (origin, callback) => {
        if (!origin || allowedOrigins.indexOf(origin) !== -1) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
};
app.use(cors(corsOptions));


// --- Middleware ---
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000
    }
}));

app.use(passport.initialize());
app.use(passport.session());

// --- API Routes ---
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
app.use('/api/bot', botRoutes);
console.log("--- Finished loading backend routes. ---");


// --- Database and Service Initialization ---
async function initializeApp() {
    try {
        await db.connect();
        console.log('Successfully connected to the PostgreSQL database.');
        await db.initSchema();
        console.log('Database schema checked/initialized successfully.');

        console.log('Database is ready. Loading services...');
        await priceFeedService.initialize();
        console.log('Price Feed Service Initialized successfully.');
        await transactionListenerService.initialize();
        console.log('Transaction Listener Service Initialized.');
        await hdWalletService.initialize();
        console.log('HD Wallet Service Initialized successfully.');

        // REMOVED: The cron job that depended on the missing file.
        // cron.schedule('*/5 * * * *', () => {
        //     console.log('Running scheduled job: Cleaning up expired duels...');
        //     cleanupExpiredDuels();
        // });

        app.listen(PORT, () => {
            console.log(`Server is running on port ${PORT}`);
        });

    } catch (error) {
        console.error('Failed to initialize the application:', error);
        process.exit(1);
    }
}

initializeApp();
