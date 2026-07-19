require("dotenv").config();

module.exports = {
    clientId: process.env.TWITCH_CLIENT_ID,
    clientSecret: process.env.TWITCH_CLIENT_SECRET,
    redirectUri: process.env.TWITCH_REDIRECT_URI,

    scopes: [
        "user:read:chat",
        "user:write:chat",
        "channel:read:subscriptions",
        "moderator:read:followers",
        "channel:read:redemptions",
        "bits:read"
    ],

    authBaseUrl: "https://id.twitch.tv/oauth2",
    apiBaseUrl: "https://api.twitch.tv/helix"
};