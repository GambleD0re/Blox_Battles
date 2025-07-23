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
const morgan = require('morgan'); // Correctly require morgan
const cron = require('node-cron'); // Require the cron library

// Import services and routes
const db = require('./database/database.js'); // This now correctly points to the new pg setup
require('./services/priceFeedService.js');
require('./services/transactionListenerService.js');

const authRoutes = require('./routes/auth');
const usersRoutes = require('./routes/users');
const duelsRoutes = require('./routes/duels');
const adminRoutes = require('./routes/admin');
const duelHistoryRoutes = require('./routes/duelHistory');
const subscriptionsRoutes = require('./routes/subscriptions');
const paymentsRoutes = require('./routes/payments');
const payoutsRoutes = require('./routes/payouts');
const statusRoutes = require('./routes/status');

const app = express();
const server = http.createServer(app);

// --- Middleware ---
app.use(cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true
}));
app.use(morgan('dev')); // Use morgan for logging
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

// --- Routes ---
app.use('/api/auth', authRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/duels', duelsRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/duel-history', duelHistoryRoutes);
app.use('/api/subscriptions', subscriptionsRoutes);
app.use('/api/payments', paymentsRoutes);
app.use('/api/payouts', payoutsRoutes);
app.use('/api/status', statusRoutes);

// --- Cron Job for Expired Duels ---
// This job runs every minute to clean up pending duels older than 5 minutes.
cron.schedule('* * * * *', async () => {
    console.log('Running scheduled job: Cleaning up expired duels...');
    try {
        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
        const query = `
            DELETE FROM duels
            WHERE status = 'pending' AND created_at < $1
        `;
        const result = await db.query(query, [fiveMinutesAgo]);
        if (result.rowCount > 0) {
            console.log(`Successfully cleaned up ${result.rowCount} expired duels.`);
        }
    } catch (err) {
        console.error('Error during expired duel cleanup cron job:', err);
    }
});


// Serve frontend static files in production
if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.join(__dirname, '../../frontend/dist')));
    app.get('*', (req, res) => {
        res.sendFile(path.resolve(__dirname, '../../frontend/dist', 'index.html'));
    });
}

// --- Server Activation ---
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

module.exports = { app, server };
