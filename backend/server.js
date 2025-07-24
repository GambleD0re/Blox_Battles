// backend/server.js

require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const passport = require('passport');
const path = require('path');
const morgan = require('morgan');
const cron = require('node-cron');
const db = require('./database/database.js');

/**
 * Main async function to start the server. This ensures a proper startup sequence.
 */
async function startServer() {
    // 1. Initialize the database FIRST.
    await db.initializeDatabase();

    // 2. Now that the database is ready, load all services and routes.
    console.log("Database is ready. Loading services and routes...");
    
    // Services
    require('./services/priceFeedService.js');
    require('./services/transactionListenerService.js');
    require('./services/hdWalletService.js');

    // Routes
    const authRoutes = require('./routes/auth');
    const usersRoutes = require('./routes/users');
    const duelsRoutes = require('./routes/duels');
    const adminRoutes = require('./routes/admin');
    const duelHistoryRoutes = require('./routes/duelHistory');
    const subscriptionsRoutes = require('./routes/subscriptions');
    const paymentsRoutes = require('./routes/payments');
    const payoutsRoutes = require('./routes/payouts');
    // --- THIS LINE IS NOW UNCOMMENTED ---
    const statusRoutes = require('./routes/status');

    const app = express();
    const server = http.createServer(app);

    // --- Middleware ---
    app.use(cors({
        origin: process.env.FRONTEND_URL || 'http://localhost:3000',
        credentials: true
    }));
    app.use(morgan('dev'));
    app.use(bodyParser.json());
    app.use(bodyParser.urlencoded({ extended: true }));
    app.use(cookieParser());
    app.use(session({
        secret: process.env.SESSION_SECRET || 'supersecret',
        resave: false,
        saveUninitialized: false,
        cookie: { secure: process.env.NODE_ENV === 'production' }
    }));
    app.use(passport.initialize());
    app.use(passport.session());

    // --- API Routes ---
    app.use('/api/auth', authRoutes);
    app.use('/api/users', usersRoutes);
    app.use('/api/duels', duelsRoutes);
    app.use('/api/admin', adminRoutes);
    app.use('/api/duel-history', duelHistoryRoutes);
    app.use('/api/subscriptions', subscriptionsRoutes);
    app.use('/api/payments', paymentsRoutes);
    app.use('/api/payouts', payoutsRoutes);
    // --- THIS LINE IS NOW UNCOMMENTED ---
    app.use('/api/status', statusRoutes);

    // --- Cron Job for Expired Duels ---
    cron.schedule('* * * * *', async () => {
        console.log('Running scheduled job: Cleaning up expired duels...');
        try {
            const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
            const query = `DELETE FROM duels WHERE status = 'pending' AND created_at < $1`;
            const result = await db.query(query, [fiveMinutesAgo]);
            if (result.rowCount > 0) {
                console.log(`Successfully cleaned up ${result.rowCount} expired duels.`);
            }
        } catch (err) {
            console.error('Error during expired duel cleanup cron job:', err);
        }
    });

    // --- Server Activation ---
    const PORT = process.env.PORT || 3001;
    server.listen(PORT, () => {
        console.log(`Server is running on port ${PORT}`);
    });
}

// Start the application by calling our async startup function.
startServer().catch(err => {
    console.error("Failed to start server:", err);
});
