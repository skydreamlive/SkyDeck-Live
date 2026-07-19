const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const crypto = require("node:crypto");

const {
    app,
    shell
} = require("electron");

const config = require("./config");

const CALLBACK_HOST = "127.0.0.1";
const CALLBACK_PORT = 3000;
const CALLBACK_PATH = "/auth/twitch/callback";

const AUTH_TIMEOUT_MS = 5 * 60 * 1000;


/* ===========================
   CONFIGURATION
=========================== */

function validateConfiguration() {
    const missingValues = [];

    if (!config.clientId) {
        missingValues.push("TWITCH_CLIENT_ID");
    }

    if (!config.clientSecret) {
        missingValues.push("TWITCH_CLIENT_SECRET");
    }

    if (!config.redirectUri) {
        missingValues.push("TWITCH_REDIRECT_URI");
    }

    if (missingValues.length > 0) {
        throw new Error(
            `Configuration Twitch incomplète : ${missingValues.join(", ")}`
        );
    }

    let redirectUrl;

    try {
        redirectUrl = new URL(config.redirectUri);
    } catch {
        throw new Error(
            "TWITCH_REDIRECT_URI n’est pas une URL valide."
        );
    }

    if (
        redirectUrl.hostname !== "localhost" &&
        redirectUrl.hostname !== "127.0.0.1"
    ) {
        throw new Error(
            "L’URL Twitch doit utiliser localhost ou 127.0.0.1."
        );
    }

    if (
        Number(redirectUrl.port || 80) !== CALLBACK_PORT ||
        redirectUrl.pathname !== CALLBACK_PATH
    ) {
        throw new Error(
            `TWITCH_REDIRECT_URI doit être exactement ` +
            `http://localhost:${CALLBACK_PORT}${CALLBACK_PATH}`
        );
    }
}


/* ===========================
   STOCKAGE LOCAL DES JETONS
=========================== */

function getTokenFilePath() {
    return path.join(
        app.getPath("userData"),
        "twitch-auth.json"
    );
}


function loadTokens() {
    try {
        const filePath = getTokenFilePath();

        if (!fs.existsSync(filePath)) {
            return null;
        }

        const content = fs.readFileSync(
            filePath,
            "utf8"
        );

        const tokens = JSON.parse(content);

        if (
            !tokens ||
            typeof tokens.accessToken !== "string" ||
            typeof tokens.refreshToken !== "string"
        ) {
            return null;
        }

        return tokens;
    } catch (error) {
        console.error(
            "Lecture des jetons Twitch impossible :",
            error
        );

        return null;
    }
}


function saveTokens(tokenResponse) {
    const filePath = getTokenFilePath();

    fs.mkdirSync(
        path.dirname(filePath),
        {
            recursive: true
        }
    );

    const tokens = {
        accessToken:
            tokenResponse.access_token,

        refreshToken:
            tokenResponse.refresh_token,

        tokenType:
            tokenResponse.token_type || "bearer",

        scopes:
            Array.isArray(tokenResponse.scope)
                ? tokenResponse.scope
                : [],

        expiresIn:
            Number(tokenResponse.expires_in) || 0,

        savedAt:
            Date.now()
    };

    fs.writeFileSync(
        filePath,
        JSON.stringify(
            tokens,
            null,
            2
        ),
        "utf8"
    );

    return tokens;
}


function deleteTokens() {
    try {
        const filePath = getTokenFilePath();

        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }
    } catch (error) {
        console.error(
            "Suppression des jetons Twitch impossible :",
            error
        );
    }
}


/* ===========================
   REQUÊTES OAUTH
=========================== */

async function parseResponse(response) {
    const text = await response.text();

    let data = null;

    if (text) {
        try {
            data = JSON.parse(text);
        } catch {
            data = {
                message: text
            };
        }
    }

    if (!response.ok) {
        throw new Error(
            data?.message ||
            data?.error_description ||
            `Erreur Twitch HTTP ${response.status}`
        );
    }

    return data;
}


async function exchangeAuthorizationCode(code) {
    const body = new URLSearchParams({
        client_id:
            config.clientId,

        client_secret:
            config.clientSecret,

        code,

        grant_type:
            "authorization_code",

        redirect_uri:
            config.redirectUri
    });

    const response = await fetch(
        `${config.authBaseUrl}/token`,
        {
            method: "POST",

            headers: {
                "Content-Type":
                    "application/x-www-form-urlencoded"
            },

            body
        }
    );

    return parseResponse(response);
}


async function refreshAccessToken(
    refreshToken
) {
    validateConfiguration();

    if (!refreshToken) {
        throw new Error(
            "Aucun jeton de renouvellement Twitch disponible."
        );
    }

    const body = new URLSearchParams({
        client_id:
            config.clientId,

        client_secret:
            config.clientSecret,

        grant_type:
            "refresh_token",

        refresh_token:
            refreshToken
    });

    const response = await fetch(
        `${config.authBaseUrl}/token`,
        {
            method: "POST",

            headers: {
                "Content-Type":
                    "application/x-www-form-urlencoded"
            },

            body
        }
    );

    const tokenResponse =
        await parseResponse(response);

    /*
     * Twitch peut retourner un nouveau refresh token.
     * S’il n’est pas présent, on conserve l’ancien.
     */
    if (!tokenResponse.refresh_token) {
        tokenResponse.refresh_token =
            refreshToken;
    }

    return saveTokens(tokenResponse);
}


async function validateAccessToken(
    accessToken
) {
    if (!accessToken) {
        return null;
    }

    const response = await fetch(
        `${config.authBaseUrl}/validate`,
        {
            headers: {
                Authorization:
                    `OAuth ${accessToken}`
            }
        }
    );

    if (response.status === 401) {
        return null;
    }

    return parseResponse(response);
}


/* ===========================
   SERVEUR DE RETOUR OAUTH
=========================== */

function createSuccessPage() {
    return `
<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <title>SkyDeck Live</title>

    <style>
        body {
            margin: 0;
            min-height: 100vh;
            display: grid;
            place-items: center;
            background: #071522;
            color: #ffffff;
            font-family: "Segoe UI", Arial, sans-serif;
        }

        main {
            width: min(520px, calc(100% - 40px));
            padding: 34px;
            text-align: center;
            background: rgba(12, 36, 56, 0.92);
            border: 1px solid rgba(94, 220, 255, 0.38);
            border-radius: 20px;
        }

        h1 {
            margin-top: 0;
            color: #75ddff;
        }

        p {
            line-height: 1.6;
        }
    </style>
</head>

<body>
    <main>
        <h1>Connexion Twitch réussie</h1>

        <p>
            Ton compte Twitch est maintenant connecté à SkyDeck Live.
        </p>

        <p>
            Tu peux fermer cette page et revenir dans l’application.
        </p>
    </main>
</body>
</html>
`;
}


function createErrorPage(message) {
    const safeMessage =
        String(message || "Connexion refusée.")
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll('"', "&quot;")
            .replaceAll("'", "&#039;");

    return `
<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <title>SkyDeck Live</title>

    <style>
        body {
            margin: 0;
            min-height: 100vh;
            display: grid;
            place-items: center;
            background: #071522;
            color: #ffffff;
            font-family: "Segoe UI", Arial, sans-serif;
        }

        main {
            width: min(520px, calc(100% - 40px));
            padding: 34px;
            text-align: center;
            background: rgba(64, 18, 25, 0.94);
            border: 1px solid rgba(255, 133, 133, 0.45);
            border-radius: 20px;
        }

        h1 {
            margin-top: 0;
            color: #ff8585;
        }

        p {
            line-height: 1.6;
        }
    </style>
</head>

<body>
    <main>
        <h1>Connexion Twitch impossible</h1>

        <p>${safeMessage}</p>

        <p>
            Tu peux fermer cette page et revenir dans SkyDeck Live.
        </p>
    </main>
</body>
</html>
`;
}


function waitForAuthorizationCode(
    expectedState
) {
    return new Promise(
        (
            resolve,
            reject
        ) => {
            let finished = false;

            const complete = (
                error,
                code = null
            ) => {
                if (finished) {
                    return;
                }

                finished = true;

                clearTimeout(timeout);

                server.close();

                if (error) {
                    reject(error);
                    return;
                }

                resolve(code);
            };

            const server = http.createServer(
                (
                    request,
                    response
                ) => {
                    try {
                        const requestUrl =
                            new URL(
                                request.url,
                                `http://${CALLBACK_HOST}:${CALLBACK_PORT}`
                            );

                        if (
                            requestUrl.pathname !==
                            CALLBACK_PATH
                        ) {
                            response.writeHead(
                                404,
                                {
                                    "Content-Type":
                                        "text/plain; charset=utf-8"
                                }
                            );

                            response.end(
                                "Page introuvable."
                            );

                            return;
                        }

                        const returnedState =
                            requestUrl.searchParams
                                .get("state");

                        const error =
                            requestUrl.searchParams
                                .get("error");

                        const errorDescription =
                            requestUrl.searchParams
                                .get(
                                    "error_description"
                                );

                        const code =
                            requestUrl.searchParams
                                .get("code");

                        if (
                            !returnedState ||
                            returnedState !==
                                expectedState
                        ) {
                            const message =
                                "La vérification de sécurité OAuth a échoué.";

                            response.writeHead(
                                400,
                                {
                                    "Content-Type":
                                        "text/html; charset=utf-8"
                                }
                            );

                            response.end(
                                createErrorPage(message)
                            );

                            complete(
                                new Error(message)
                            );

                            return;
                        }

                        if (error) {
                            const message =
                                errorDescription ||
                                error;

                            response.writeHead(
                                400,
                                {
                                    "Content-Type":
                                        "text/html; charset=utf-8"
                                }
                            );

                            response.end(
                                createErrorPage(message)
                            );

                            complete(
                                new Error(message)
                            );

                            return;
                        }

                        if (!code) {
                            const message =
                                "Twitch n’a retourné aucun code d’autorisation.";

                            response.writeHead(
                                400,
                                {
                                    "Content-Type":
                                        "text/html; charset=utf-8"
                                }
                            );

                            response.end(
                                createErrorPage(message)
                            );

                            complete(
                                new Error(message)
                            );

                            return;
                        }

                        response.writeHead(
                            200,
                            {
                                "Content-Type":
                                    "text/html; charset=utf-8"
                            }
                        );

                        response.end(
                            createSuccessPage()
                        );

                        complete(
                            null,
                            code
                        );
                    } catch (error) {
                        complete(error);
                    }
                }
            );

            server.once(
                "error",
                error => {
                    if (
                        error.code ===
                        "EADDRINUSE"
                    ) {
                        complete(
                            new Error(
                                `Le port ${CALLBACK_PORT} est déjà utilisé. ` +
                                "Ferme l’application qui l’utilise puis réessaie."
                            )
                        );

                        return;
                    }

                    complete(error);
                }
            );

            server.listen(
                CALLBACK_PORT,
                CALLBACK_HOST
            );

            const timeout = setTimeout(
                () => {
                    complete(
                        new Error(
                            "La connexion Twitch a expiré."
                        )
                    );
                },
                AUTH_TIMEOUT_MS
            );
        }
    );
}


/* ===========================
   CONNEXION
=========================== */

async function connect() {
    validateConfiguration();

    const state =
        crypto.randomBytes(32)
            .toString("hex");

    const authorizationUrl =
        new URL(
            `${config.authBaseUrl}/authorize`
        );

    authorizationUrl.search =
        new URLSearchParams({
            client_id:
                config.clientId,

            redirect_uri:
                config.redirectUri,

            response_type:
                "code",

            scope:
                config.scopes.join(" "),

            state,

            force_verify:
                "false"
        }).toString();

    /*
     * On démarre le serveur avant d’ouvrir Twitch,
     * sinon le retour OAuth pourrait arriver trop vite.
     */
    const authorizationPromise =
        waitForAuthorizationCode(state);

    await shell.openExternal(
        authorizationUrl.toString()
    );

    const authorizationCode =
        await authorizationPromise;

    const tokenResponse =
        await exchangeAuthorizationCode(
            authorizationCode
        );

    const tokens =
        saveTokens(tokenResponse);

    const validation =
        await validateAccessToken(
            tokens.accessToken
        );

    if (!validation) {
        deleteTokens();

        throw new Error(
            "Le jeton Twitch reçu est invalide."
        );
    }

    return {
        connected: true,
        accessToken:
            tokens.accessToken,
        validation
    };
}


/* ===========================
   SESSION
=========================== */

async function getValidAccessToken() {
    const tokens = loadTokens();

    if (!tokens) {
        return null;
    }

    const validation =
        await validateAccessToken(
            tokens.accessToken
        );

    if (validation) {
        return tokens.accessToken;
    }

    try {
        const refreshedTokens =
            await refreshAccessToken(
                tokens.refreshToken
            );

        const refreshedValidation =
            await validateAccessToken(
                refreshedTokens.accessToken
            );

        if (!refreshedValidation) {
            deleteTokens();
            return null;
        }

        return refreshedTokens.accessToken;
    } catch (error) {
        console.error(
            "Renouvellement Twitch impossible :",
            error
        );

        deleteTokens();

        return null;
    }
}


async function getSession() {
    const accessToken =
        await getValidAccessToken();

    if (!accessToken) {
        return {
            connected: false,
            accessToken: null,
            validation: null
        };
    }

    const validation =
        await validateAccessToken(
            accessToken
        );

    if (!validation) {
        deleteTokens();

        return {
            connected: false,
            accessToken: null,
            validation: null
        };
    }

    return {
        connected: true,
        accessToken,
        validation
    };
}


async function isConnected() {
    const session =
        await getSession();

    return session.connected;
}


async function disconnect() {
    deleteTokens();

    return {
        connected: false
    };
}


/* ===========================
   EXPORTS
=========================== */

module.exports = {
    connect,
    disconnect,
    isConnected,
    getSession,
    getValidAccessToken,
    validateAccessToken,
    refreshAccessToken
};