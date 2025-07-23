// backend/server.js
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const passport = require('passport');
const cookieParser = require('cookie-parser');
const morgan = require('morgan');
const webpush = require('web-push');
const db = require('./database/database');
const util = require('util');
const crypto = require('crypto');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const { botLogger } = require('./middleware/botLogger');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const { startTransactionListener } = require('./services/transactionListenerService');
const { startConfirmationService } = require('./services/transactionConfirmationService');

db.get = util.promisify(db.get);
db.run = util.promisify(db.run);
db.all = util.promisify(db.all);

const app = express();
const PORT = process.env.PORT || 3001;

// --- Web Push Configuration ---
if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
    webpush.setVapidDetails(
        'mailto:youremail@example.com',
        process.env.VAPID_PUBLIC_KEY,
        process.env.VAPID_PRIVATE_KEY
    );
    console.log("Web Push configured successfully.");
} else {
    console.warn("VAPID keys not found in .env file. Push notifications will be disabled.");
}

// --- Middleware Setup ---
// [MODIFIED] CORS is now configured for production.
const corsOptions = {
    origin: 'https://www.blox-battles.com', // Allow requests from your frontend domain
    credentials: true,
};
app.use(cors(corsOptions));
app.use(cookieParser());
app.use(passport.initialize());
app.use(morgan('dev'));


// --- Stripe Webhook Handler ---
app.post('/api/payments/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
    const sig = req.headers['stripe-signature'];
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    let event;

    try {
        event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
    } catch (err) {
        console.error(`Webhook signature verification failed.`, err.message);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    if (event.type === 'checkout.session.completed') {
        const session = event.data.object;
        const { userId, gemAmount } = session.metadata;
        const sessionId = session.id;
        const amountPaid = session.amount_total;
        const currency = session.currency;
        const gemAmountInt = parseInt(gemAmount, 10);

        try {
            const existingPurchase = await db.get('SELECT id FROM gem_purchases WHERE stripe_session_id = ?', [sessionId]);
            if (existingPurchase) {
                return res.status(200).json({ received: true, message: 'Duplicate event.' });
            }

            await db.run('BEGIN TRANSACTION');
            
            await db.run('UPDATE users SET gems = gems + ? WHERE id = ?', [gemAmountInt, userId]);
            
            await db.run(
                'INSERT INTO gem_purchases (user_id, stripe_session_id, gem_amount, amount_paid, currency, status) VALUES (?, ?, ?, ?, ?, ?)',
                [userId, sessionId, gemAmountInt, amountPaid, currency, 'completed']
            );

            await db.run(
                'INSERT INTO transaction_history (user_id, type, amount_gems, description) VALUES (?, ?, ?, ?)',
                [userId, 'deposit_stripe', gemAmountInt, `${gemAmountInt} Gems purchased via Card`]
            );

            await db.run('COMMIT');
            console.log(`Gems awarded successfully for session ${sessionId}.`);
        } catch (dbError) {
            await db.run('ROLLBACK').catch(console.error);
            console.error(`DATABASE ERROR during webhook processing for session ${sessionId}:`, dbError.message);
            return res.status(500).json({ error: 'Database processing failed.' });
        }
    }

    res.status(200).json({ received: true });
});

app.use(express.json());


// --- Passport Strategy ---
passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: `/api/auth/google/callback`
  },
  async function(accessToken, refreshToken, profile, done) {
    const googleId = profile.id;
    const email = profile.emails[0].value;
    try {
      let user = await db.get('SELECT * FROM users WHERE google_id = ?', [googleId]);
      if (user) { return done(null, user); }
      user = await db.get('SELECT * FROM users WHERE email = ?', [email]);
      if (user) {
        await db.run('UPDATE users SET google_id = ? WHERE id = ?', [googleId, user.id]);
        const updatedUser = await db.get('SELECT * FROM users WHERE id = ?', [user.id]);
        return done(null, updatedUser);
      }
      const newUserId = crypto.randomUUID();
      await db.run('INSERT INTO users (id, google_id, email) VALUES (?, ?, ?)', [newUserId, googleId, email]);
      const newUser = await db.get('SELECT * FROM users WHERE id = ?', [newUserId]);
      return done(null, newUser);
    } catch (err) {
      console.error("Google Strategy Error:", err);
      return done(err);
    }
  }
));

// --- API Routes ---
const apiRoutes = require('./routes');
app.use('/api', botLogger, apiRoutes);

// --- Server Startup ---
// [MODIFIED] The server now listens on host 0.0.0.0, which is required by Render.
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Backend API server listening on http://0.0.0.0:${PORT}`);
    
    // Crypto deposit services are started here
    startTransactionListener();
    startConfirmationService();
});