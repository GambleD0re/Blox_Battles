// backend/services/transactionListenerService.js

require('dotenv').config();
const { Alchemy, Network, AlchemySubscription } = require('alchemy-sdk');
const db = require('../database/database');
const { handleTransaction, processRefund } = require('./transactionConfirmationService');

const settings = {
    apiKey: process.env.ALCHEMY_API_KEY,
    network: process.env.ETHEREUM_NETWORK === 'mainnet' ? Network.ETH_MAINNET : Network.ETH_SEPOLIA,
};
const alchemy = new Alchemy(settings);

let monitoredAddresses = new Set();

/**
 * Loads addresses from the database to monitor.
 * This is now compatible with the 'pg' library.
 */
async function loadMonitoredAddresses() {
    try {
        const { rows } = await db.query("SELECT address FROM monitored_addresses");
        const addresses = rows.map(row => row.address);
        monitoredAddresses = new Set(addresses);
        console.log(`[Listener] Loaded ${monitoredAddresses.size} addresses to monitor.`);
    } catch (err) {
        console.error('[Listener] Error loading addresses from database:', err);
    }
}

/**
 * Adds a new address to the database and the monitoring set.
 * This is now compatible with the 'pg' library.
 * @param {string} address The Ethereum address to monitor.
 */
async function addMonitoredAddress(address) {
    if (monitoredAddresses.has(address.toLowerCase())) {
        console.log(`[Listener] Address ${address} is already being monitored.`);
        return;
    }
    try {
        const sql = "INSERT INTO monitored_addresses (address) VALUES ($1) ON CONFLICT (address) DO NOTHING";
        await db.query(sql, [address.toLowerCase()]);
        monitoredAddresses.add(address.toLowerCase());
        console.log(`[Listener] Added new address to monitor: ${address}`);
        // We might need to restart the listener to include the new address,
        // or dynamically add it to the subscription if the library supports it.
        // For simplicity, a restart of the service would be the easiest way.
    } catch (err) {
        console.error(`[Listener] Error adding address ${address} to database:`, err);
    }
}

/**
 * Removes an address from the database and the monitoring set.
 * This is now compatible with the 'pg' library.
 * @param {string} address The Ethereum address to stop monitoring.
 */
async function removeMonitoredAddress(address) {
    try {
        const sql = "DELETE FROM monitored_addresses WHERE address = $1";
        await db.query(sql, [address.toLowerCase()]);
        monitoredAddresses.delete(address.toLowerCase());
        console.log(`[Listener] Removed address from monitoring: ${address}`);
    } catch (err) {
        console.error(`[Listener] Error removing address ${address} from database:`, err);
    }
}

// --- Main Listener Logic ---

// Initialize the listener by loading addresses from the DB
loadMonitoredAddresses();

// Subscribe to new pending transactions
alchemy.ws.on(
    {
        method: AlchemySubscription.PENDING_TRANSACTIONS,
        toAddress: Array.from(monitoredAddresses) // Note: This might need to be updated if addresses change at runtime
    },
    (tx) => {
        // We only care about transactions to our monitored addresses
        if (tx.to && monitoredAddresses.has(tx.to.toLowerCase())) {
            console.log(`[Listener] Detected pending transaction to ${tx.to}: ${tx.hash}`);
            handleTransaction(tx.hash, tx.to.toLowerCase());
        }
    }
);

console.log("Transaction Listener Service Initialized.");

module.exports = {
    addMonitoredAddress,
    removeMonitoredAddress,
    loadMonitoredAddresses
};
