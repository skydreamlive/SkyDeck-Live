const crypto = require("node:crypto");
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const { app, safeStorage, shell } = require("electron");
const dotenv = require("dotenv");

function loadEnvironment() {
    const candidates = [
        path.join(process.cwd(), ".env"),
        path.join(app.getAppPath(), ".env")
    ];

    const envPath = candidates.find(fs.existsSync);
    dotenv.config(envPath ? { path: envPath } : undefined);
}

loadEnvironment();

const CONFIG = {
    clientKey: process.env.TIKTOK_CLIENT_KEY || "",
    clientSecret: process.env.TIKTOK_CLIENT_SECRET || "",
    redirectUri:
        process.env.TIKTOK_REDIRECT_URI ||
        "http://127.0.0.1:3000/callback/",
    scopes: [
        "user.info.basic",
        "user.info.profile",
        "user.info.stats"
    ],
    authorizationUrl:
        "https://www.tiktok.com/v2/auth/authorize/",
    tokenUrl:
        "https://open.tiktokapis.com/v2/oauth/token/",
    revokeUrl:
        "https://open.tiktokapis.com/v2/oauth/revoke/",
    userInfoUrl:
        "https://open.tiktokapis.com/v2/user/info/"
};

const CALLBACK_TIMEOUT_MS = 5 * 60 * 1000;
const EXPIRY_MARGIN_MS = 5 * 60 * 1000;

function validateConfiguration() {
    const missing = [];

    if (!CONFIG.clientKey) missing.push("TIKTOK_CLIENT_KEY");
    if (!CONFIG.clientSecret) missing.push("TIKTOK_CLIENT_SECRET");
    if (!CONFIG.redirectUri) missing.push("TIKTOK_REDIRECT_URI");

    if (missing.length) {
        throw new Error(
            `Configuration TikTok manquante : ${missing.join(", ")}`
        );
    }

    const url = new URL(CONFIG.redirectUri);

    if (!["127.0.0.1", "localhost"].includes(url.hostname)) {
        throw new Error(
            "L’URI TikTok Desktop doit utiliser 127.0.0.1 ou localhost."
        );
    }

    if (!url.port) {
        throw new Error(
            "L’URI TikTok Desktop doit contenir un port."
        );
    }
}

function randomString(length = 64) {
    const chars =
        "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~";
    const bytes = crypto.randomBytes(length);
    let output = "";

    for (let index = 0; index < length; index += 1) {
        output += chars[bytes[index] % chars.length];
    }

    return output;
}

function createCodeChallenge(verifier) {
    return crypto
        .createHash("sha256")
        .update(verifier)
        .digest("hex");
}

function tokenFilePath() {
    return path.join(
        app.getPath("userData"),
        "tiktok-token.json"
    );
}

function saveTokens(response) {
    if (!safeStorage.isEncryptionAvailable()) {
        throw new Error(
            "Le chiffrement sécurisé Electron n’est pas disponible."
        );
    }

    const now = Date.now();
    const tokenData = {
        accessToken: response.access_token,
        refreshToken: response.refresh_token,
        openId: response.open_id || "",
        scope: response.scope || "",
        accessTokenExpiresAt:
            now + Number(response.expires_in || 0) * 1000,
        refreshTokenExpiresAt:
            now + Number(response.refresh_expires_in || 0) * 1000
    };

    const encrypted = safeStorage
        .encryptString(JSON.stringify(tokenData))
        .toString("base64");

    const filePath = tokenFilePath();
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(
        filePath,
        JSON.stringify({ encrypted }, null, 2),
        "utf8"
    );

    return tokenData;
}

function loadTokens() {
    const filePath = tokenFilePath();

    if (!fs.existsSync(filePath)) return null;
    if (!safeStorage.isEncryptionAvailable()) return null;

    try {
        const wrapper = JSON.parse(
            fs.readFileSync(filePath, "utf8")
        );
        const buffer = Buffer.from(wrapper.encrypted, "base64");
        return JSON.parse(safeStorage.decryptString(buffer));
    } catch (error) {
        console.error("Lecture des jetons TikTok impossible :", error);
        return null;
    }
}

function deleteTokens() {
    const filePath = tokenFilePath();
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
}

async function parseResponse(response) {
    const text = await response.text();
    let payload = {};

    if (text) {
        try {
            payload = JSON.parse(text);
        } catch {
            payload = { rawResponse: text };
        }
    }

    if (!response.ok) {
        throw new Error(
            payload.error_description ||
            payload.error?.message ||
            payload.message ||
            payload.error ||
            `Erreur HTTP ${response.status}`
        );
    }

    return payload;
}

async function postForm(url, values) {
    const response = await fetch(url, {
        method: "POST",
        headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            "Cache-Control": "no-cache"
        },
        body: new URLSearchParams(values)
    });

    return parseResponse(response);
}

async function exchangeCode(code, verifier) {
    return postForm(CONFIG.tokenUrl, {
        client_key: CONFIG.clientKey,
        client_secret: CONFIG.clientSecret,
        code,
        grant_type: "authorization_code",
        redirect_uri: CONFIG.redirectUri,
        code_verifier: verifier
    });
}

async function refreshAccessToken(refreshToken) {
    const response = await postForm(CONFIG.tokenUrl, {
        client_key: CONFIG.clientKey,
        client_secret: CONFIG.clientSecret,
        grant_type: "refresh_token",
        refresh_token: refreshToken
    });

    return saveTokens(response);
}

function callbackHtml(success, message) {
    const color = success ? "#49e58b" : "#ff7b7b";
    const symbol = success ? "✓" : "×";
    const safeMessage = String(message)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;");

    return `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>SkyDeck Live</title>
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#081018;color:white;font-family:Segoe UI,Arial;padding:24px}.p{max-width:520px;padding:34px;text-align:center;border:2px solid ${color};border-radius:22px;background:#0b1721}.s{color:${color};font-size:52px;font-weight:900}p{color:#a9b9c4}</style></head>
<body><main class="p"><div class="s">${symbol}</div><h1>${success ? "Connexion réussie" : "Connexion impossible"}</h1><p>${safeMessage}</p></main></body></html>`;
}

function waitForCallback(expectedState) {
    return new Promise((resolve, reject) => {
        const redirect = new URL(CONFIG.redirectUri);
        const expectedPath = redirect.pathname;
        let finished = false;

        const finish = (error, code) => {
            if (finished) return;
            finished = true;
            clearTimeout(timeout);
            server.close();
            error ? reject(error) : resolve(code);
        };

        const server = http.createServer((request, response) => {
            try {
                const url = new URL(request.url, CONFIG.redirectUri);

                if (url.pathname !== expectedPath) {
                    response.writeHead(404);
                    response.end("Page introuvable");
                    return;
                }

                const oauthError = url.searchParams.get("error");
                const description =
                    url.searchParams.get("error_description");
                const state = url.searchParams.get("state");
                const code = url.searchParams.get("code");

                if (oauthError) {
                    const message = description || oauthError;
                    response.writeHead(400, {
                        "Content-Type": "text/html; charset=utf-8"
                    });
                    response.end(callbackHtml(false, message));
                    finish(new Error(message));
                    return;
                }

                if (state !== expectedState) {
                    const message =
                        "La vérification de sécurité TikTok a échoué.";
                    response.writeHead(400, {
                        "Content-Type": "text/html; charset=utf-8"
                    });
                    response.end(callbackHtml(false, message));
                    finish(new Error(message));
                    return;
                }

                if (!code) {
                    const message =
                        "TikTok n’a pas renvoyé de code d’autorisation.";
                    response.writeHead(400, {
                        "Content-Type": "text/html; charset=utf-8"
                    });
                    response.end(callbackHtml(false, message));
                    finish(new Error(message));
                    return;
                }

                response.writeHead(200, {
                    "Content-Type": "text/html; charset=utf-8"
                });
                response.end(
                    callbackHtml(
                        true,
                        "Tu peux fermer cette page et revenir dans SkyDeck Live."
                    )
                );
                finish(null, code);
            } catch (error) {
                finish(error);
            }
        });

        server.on("error", error => {
            if (error.code === "EADDRINUSE") {
                finish(
                    new Error(
                        "Le port 3000 est déjà utilisé. Ferme le programme qui utilise ce port puis réessaie."
                    )
                );
            } else {
                finish(error);
            }
        });

        server.listen(Number(redirect.port), redirect.hostname);

        const timeout = setTimeout(
            () => finish(new Error("La connexion TikTok a expiré.")),
            CALLBACK_TIMEOUT_MS
        );
    });
}

function authorizationUrl(state, challenge) {
    const url = new URL(CONFIG.authorizationUrl);
    url.search = new URLSearchParams({
        client_key: CONFIG.clientKey,
        response_type: "code",
        scope: CONFIG.scopes.join(","),
        redirect_uri: CONFIG.redirectUri,
        state,
        code_challenge: challenge,
        code_challenge_method: "S256"
    }).toString();
    return url.toString();
}

async function connect() {
    validateConfiguration();

    const state = randomString(48);
    const verifier = randomString(64);
    const challenge = createCodeChallenge(verifier);
    const callbackPromise = waitForCallback(state);

    await shell.openExternal(authorizationUrl(state, challenge));
    const code = await callbackPromise;
    const tokenResponse = await exchangeCode(code, verifier);
    const tokens = saveTokens(tokenResponse);

    return {
        success: true,
        connected: true,
        scope: tokens.scope
    };
}

function accessTokenValid(tokens) {
    return Boolean(
        tokens?.accessToken &&
        tokens.accessTokenExpiresAt > Date.now() + EXPIRY_MARGIN_MS
    );
}

function refreshTokenValid(tokens) {
    return Boolean(
        tokens?.refreshToken &&
        tokens.refreshTokenExpiresAt > Date.now()
    );
}

async function validTokens() {
    validateConfiguration();
    const tokens = loadTokens();

    if (!tokens) throw new Error("TikTok n’est pas connecté.");
    if (accessTokenValid(tokens)) return tokens;

    if (!refreshTokenValid(tokens)) {
        deleteTokens();
        throw new Error(
            "La connexion TikTok a expiré. Une nouvelle connexion est nécessaire."
        );
    }

    return refreshAccessToken(tokens.refreshToken);
}

function isConnected() {
    const tokens = loadTokens();
    return Boolean(
        tokens &&
        (accessTokenValid(tokens) || refreshTokenValid(tokens))
    );
}

async function getAccountInfo() {
    const tokens = await validTokens();
    const url = new URL(CONFIG.userInfoUrl);

    url.searchParams.set(
        "fields",
        "display_name,follower_count"
    );

    const response = await fetch(url, {
        headers: {
            Authorization:
                `Bearer ${tokens.accessToken}`
        }
    });

    const payload =
        await parseResponse(response);

    if (
        payload.error?.code &&
        payload.error.code !== "ok"
    ) {
        throw new Error(
            payload.error.message ||
            payload.error.code
        );
    }

    const user =
        payload.data?.user;

    const followerCount =
        user?.follower_count;

    if (
        !Number.isFinite(
            followerCount
        )
    ) {
        throw new Error(
            "TikTok n’a pas renvoyé le nombre d’abonnés."
        );
    }

    return {
        displayName:
            String(
                user?.display_name || ""
            ).trim(),

        followerCount
    };
}


async function getFollowerCount() {
    const account =
        await getAccountInfo();

    return account.followerCount;
}


async function disconnect() {
    const tokens = loadTokens();

    try {
        if (tokens?.accessToken) {
            validateConfiguration();
            await postForm(CONFIG.revokeUrl, {
                client_key: CONFIG.clientKey,
                client_secret: CONFIG.clientSecret,
                token: tokens.accessToken
            });
        }
    } catch (error) {
        console.warn("Révocation TikTok impossible :", error.message);
    } finally {
        deleteTokens();
    }

    return { success: true, connected: false };
}

module.exports = {
    connect,
    disconnect,
    getAccountInfo,
    getFollowerCount,
    isConnected
};
