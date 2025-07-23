// v1
// src/services/api.js
// This file centralizes all API calls to the backend.
import axios from 'axios';

/**
 * --- Strict API Endpoint Configuration ---
 * This configuration ensures the frontend can only connect to the backend API
 * when the endpoint is explicitly defined in an environment variable.
 *
 * The `VITE_API_URL` environment variable MUST be set.
 * - In Production (on Render): This will be set by the Render build process to the
 * public URL of our deployed backend service (e.g., "https://blox_battles_api.onrender.com/api").
 * - In Development (Local Machine): You must create a `.env` file in the `frontend`
 * directory and define `VITE_API_URL=http://localhost:3001/api`.
 *
 * If this variable is not found, the application will throw an error and refuse to start.
 * This prevents a misconfigured deployment from running.
 */
const API_BASE_URL = import.meta.env.VITE_API_URL;

if (!API_BASE_URL) {
  throw new Error(
    'CRITICAL ERROR: VITE_API_URL is not defined. Please create a .env file in the /frontend directory and set the variable. The application cannot start without a configured backend API endpoint.'
  );
}

// Create a global Axios instance.
// All API requests will be made through this instance, which simplifies configuration.
const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true, // Necessary for sending session cookies for authentication
});

/**
 * A helper function to handle API requests using the configured Axios instance.
 * It automatically includes the auth token in the headers if one is provided.
 * This function maintains the same signature as the original `apiRequest` for compatibility.
 * @param {string} endpoint - The API endpoint to call (e.g., '/auth/login').
 * @param {string} [method='GET'] - The HTTP method to use.
 * @param {object|null} [body=null] - The request body for POST/PUT requests.
 * @param {string|null} [token=null] - The user's authentication token.
 * @returns {Promise<any>} - The data from the API response.
 */
const apiRequest = async (endpoint, method = 'GET', body = null, token = null) => {
    const config = {
        method,
        url: endpoint,
        headers: {},
    };

    // If a token is explicitly passed or found in localStorage, add it to the request.
    const authToken = token || localStorage.getItem('token');
    if (authToken) {
        config.headers['Authorization'] = `Bearer ${authToken}`;
    }

    if (body) {
        config.data = body;
    }

    try {
        const response = await api(config);
        return response.data;
    } catch (error) {
        // Log a more descriptive error message.
        const errorMessage = error.response?.data?.message || error.message || `Error: ${error.request?.status}`;
        console.error(`API request failed: ${method} ${endpoint}`, {
            message: errorMessage,
            status: error.response?.status,
        });
        // Re-throw the error with a consistent message format.
        throw new Error(errorMessage);
    }
};


// --- AUTHENTICATION ---
export const loginUser = (credentials) => apiRequest('/auth/login', 'POST', credentials);
export const registerUser = (userData) => apiRequest('/auth/register', 'POST', userData);
export const googleLogin = () => {
    // Redirect the user to the backend Google OAuth endpoint.
    window.location.href = `${API_BASE_URL}/auth/google`;
};

// --- USER & DASHBOARD ---
export const getDashboardData = (token) => apiRequest('/user-data', 'GET', null, token);
export const verifyRobloxAccount = (robloxUsername, token) => apiRequest('/roblox/verify', 'POST', { robloxUsername }, token);
export const getInbox = (token) => apiRequest('/inbox', 'GET', null, token);
export const getTransactionHistory = (token) => apiRequest('/history', 'GET', null, token);


// --- DUELS & DISPUTES ---
export const getDuelHistory = (token) => apiRequest('/duels/history', 'GET', null, token);
export const getDetailedDuelHistory = (token) => apiRequest('/duel-history', 'GET', null, token);
export const findPlayer = (robloxUsername, token) => apiRequest(`/duels/find-player?roblox_username=${encodeURIComponent(robloxUsername)}`, 'GET', null, token);
export const sendChallenge = (challengeData, token) => apiRequest('/duels/challenge', 'POST', challengeData, token);
export const respondToDuel = (responseData, token) => apiRequest('/duels/respond', 'POST', responseData, token);
export const cancelDuel = (duelId, token) => apiRequest(`/duels/cancel/${duelId}`, 'DELETE', null, token);
export const getTranscript = (duelId, token) => apiRequest(`/duels/transcript/${duelId}`, 'GET', null, token);
export const startDuel = (duelId, token) => apiRequest(`/duels/${duelId}/start`, 'POST', null, token);
export const forfeitDuel = (duelId, token) => apiRequest(`/duels/${duelId}/forfeit`, 'POST', null, token);
export const getUnseenResults = (token) => apiRequest('/duels/unseen-results', 'GET', null, token);
export const confirmDuelResult = (duelId, token) => apiRequest(`/duels/${duelId}/confirm-result`, 'POST', null, token);
export const fileDispute = (duelId, disputeData, token) => apiRequest(`/duels/${duelId}/dispute`, 'POST', disputeData, token);


// --- STATIC DATA ---
export const getGameData = (token) => apiRequest('/gamedata', 'GET', null, token);

// --- SYSTEM STATUS ---
export const getBotStatus = (token) => apiRequest('/status', 'GET', null, token);

// --- PAYMENTS & PAYOUTS ---
export const createCheckoutSession = (packageId, token) => apiRequest('/payments/create-checkout-session', 'POST', { packageId }, token);
export const getCryptoDepositAddress = (token) => apiRequest('/payments/crypto-address', 'GET', null, token);
export const getCryptoQuote = (packageId, tokenType, token) => apiRequest('/payments/crypto-quote', 'POST', { packageId, tokenType }, token);
export const requestCryptoWithdrawal = (gemAmount, recipientAddress, tokenType, token) => apiRequest('/payouts/request-crypto', 'POST', { gemAmount, recipientAddress, tokenType }, token);
export const cancelWithdrawalRequest = (requestId, token) => apiRequest(`/payouts/cancel-request/${requestId}`, 'POST', null, token);
export const updateWithdrawalDetails = (requestId, details, token) => apiRequest(`/payouts/update-request/${requestId}`, 'PUT', details, token);


// --- SETTINGS ---
export const updatePassword = (passwordData, token) => apiRequest('/user/password', 'PUT', passwordData, token);
export const unlinkRoblox = (token) => apiRequest('/user/unlink/roblox', 'POST', null, token);
export const deleteAccount = (password, token) => apiRequest('/user/delete/account', 'DELETE', null, { password }, token);
export const updateNotificationPreference = (enabled, token) => apiRequest('/user/notification-preference', 'PUT', { enabled }, token);

// --- ADMIN ---
export const getAdminStats = (token) => apiRequest('/admin/stats', 'GET', null, token);
export const getAdminLogs = (token) => apiRequest('/admin/logs', 'GET', null, token);
export const getAdminUsers = (searchQuery, token, status) => {
    const params = new URLSearchParams();
    if (searchQuery) {
        params.append('search', searchQuery);
    }
    if (status) {
        params.append('status', status);
    }
    return apiRequest(`/admin/users?${params.toString()}`, 'GET', null, token);
};
export const updateUserGems = (userId, amount, token) => apiRequest(`/admin/users/${userId}/gems`, 'POST', { amount }, token);
export const banUser = (userId, reason, duration_hours, token) => apiRequest(`/admin/users/${userId}/ban`, 'POST', { reason, duration_hours }, token);
export const unbanUser = (userId, token) => apiRequest(`/admin/users/${userId}/ban`, 'DELETE', null, token);
export const deleteUserAccount = (userId, token) => apiRequest(`/admin/users/${userId}`, 'DELETE', null, token);
export const getAdminServers = (token) => apiRequest('/admin/servers', 'GET', null, token);
export const addAdminServer = (serverData, token) => apiRequest('/admin/servers', 'POST', serverData, token);
export const deleteAdminServer = (serverId, token) => apiRequest(`/admin/servers/${serverId}`, 'DELETE', null, token);
export const getPendingDisputes = (token) => apiRequest('/admin/disputes', 'GET', null, token);
export const resolveDispute = (disputeId, resolutionType, token) => apiRequest(`/admin/disputes/${disputeId}/resolve`, 'POST', { resolutionType }, token);
export const getAdminPayoutRequests = (token) => apiRequest('/admin/payout-requests', 'GET', null, token);
export const getAdminUserDetailsForPayout = (userId, payoutId, token) => apiRequest(`/admin/users/${userId}/details-for-payout/${payoutId}`, 'GET', null, token);
export const approvePayoutRequest = (requestId, token) => apiRequest(`/admin/payout-requests/${requestId}/approve`, 'POST', null, token);
export const declinePayoutRequest = (requestId, reason, token) => apiRequest(`/admin/payout-requests/${requestId}/decline`, 'POST', { reason }, token);
