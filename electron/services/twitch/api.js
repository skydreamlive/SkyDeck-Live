const config = require("./config");
const auth = require("./auth");


/* ===========================
   OUTILS HTTP
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
            `Erreur Twitch HTTP ${response.status}`
        );
    }

    return data;
}


async function helixRequest(
    endpoint,
    {
        method = "GET",
        query = null,
        body = null
    } = {}
) {
    const accessToken =
        await auth.getValidAccessToken();

    if (!accessToken) {
        throw new Error(
            "Le compte Twitch n’est pas connecté."
        );
    }

    const url = new URL(
        `${config.apiBaseUrl}${endpoint}`
    );

    if (query) {
        for (
            const [key, value]
            of Object.entries(query)
        ) {
            if (
                value === undefined ||
                value === null ||
                value === ""
            ) {
                continue;
            }

            if (Array.isArray(value)) {
                for (const item of value) {
                    url.searchParams.append(
                        key,
                        String(item)
                    );
                }

                continue;
            }

            url.searchParams.set(
                key,
                String(value)
            );
        }
    }

    const headers = {
        Authorization:
            `Bearer ${accessToken}`,

        "Client-Id":
            config.clientId
    };

    const requestOptions = {
        method,
        headers
    };

    if (body !== null) {
        headers["Content-Type"] =
            "application/json";

        requestOptions.body =
            JSON.stringify(body);
    }

    const response = await fetch(
        url,
        requestOptions
    );

    /*
     * Si Twitch refuse le jeton entre deux validations,
     * on tente un renouvellement une seule fois.
     */
    if (response.status === 401) {
        const session =
            await auth.getSession();

        if (!session.connected) {
            throw new Error(
                "La session Twitch a expiré. Reconnecte ton compte."
            );
        }

        headers.Authorization =
            `Bearer ${session.accessToken}`;

        const retryResponse =
            await fetch(
                url,
                requestOptions
            );

        return parseResponse(
            retryResponse
        );
    }

    return parseResponse(response);
}


/* ===========================
   UTILISATEUR CONNECTÉ
=========================== */

async function getCurrentUser() {
    const result =
        await helixRequest(
            "/users"
        );

    const user =
        Array.isArray(result.data)
            ? result.data[0]
            : null;

    if (!user) {
        throw new Error(
            "Twitch n’a retourné aucune information de compte."
        );
    }

    return {
        id:
            user.id,

        login:
            user.login,

        displayName:
            user.display_name,

        broadcasterType:
            user.broadcaster_type || "",

        description:
            user.description || "",

        profileImageUrl:
            user.profile_image_url || "",

        offlineImageUrl:
            user.offline_image_url || "",

        createdAt:
            user.created_at || null
    };
}


/* ===========================
   INFORMATIONS DU LIVE
=========================== */

async function getStreamByUserId(
    userId
) {
    if (!userId) {
        throw new Error(
            "Identifiant Twitch manquant."
        );
    }

    const result =
        await helixRequest(
            "/streams",
            {
                query: {
                    user_id:
                        userId
                }
            }
        );

    const stream =
        Array.isArray(result.data)
            ? result.data[0]
            : null;

    if (!stream) {
        return {
            isLive: false,
            id: null,
            title: "",
            categoryId: "",
            categoryName: "",
            viewerCount: 0,
            startedAt: null,
            thumbnailUrl: "",
            language: "",
            mature: false
        };
    }

    return {
        isLive: true,

        id:
            stream.id,

        title:
            stream.title || "",

        categoryId:
            stream.game_id || "",

        categoryName:
            stream.game_name || "",

        viewerCount:
            Number(
                stream.viewer_count
            ) || 0,

        startedAt:
            stream.started_at || null,

        thumbnailUrl:
            stream.thumbnail_url || "",

        language:
            stream.language || "",

        mature:
            Boolean(stream.is_mature)
    };
}


/* ===========================
   ABONNÉS
=========================== */

async function getFollowerCount(
    broadcasterId
) {
    if (!broadcasterId) {
        throw new Error(
            "Identifiant du diffuseur manquant."
        );
    }

    const result =
        await helixRequest(
            "/channels/followers",
            {
                query: {
                    broadcaster_id:
                        broadcasterId,

                    first:
                        1
                }
            }
        );

    return Number(
        result.total
    ) || 0;
}


/* ===========================
   RÉSUMÉ DE CHAÎNE
=========================== */

async function getChannelSummary() {
    const user =
        await getCurrentUser();

    const [
        stream,
        followerCount
    ] = await Promise.all([
        getStreamByUserId(
            user.id
        ),

        getFollowerCount(
            user.id
        ).catch(error => {
            console.warn(
                "Nombre de followers Twitch indisponible :",
                error.message
            );

            return null;
        })
    ]);

    return {
        connected: true,

        user: {
            id:
                user.id,

            login:
                user.login,

            displayName:
                user.displayName,

            broadcasterType:
                user.broadcasterType,

            profileImageUrl:
                user.profileImageUrl,

            offlineImageUrl:
                user.offlineImageUrl
        },

        stream,

        followerCount
    };
}


/* ===========================
   EXPORTS
=========================== */

module.exports = {
    helixRequest,
    getCurrentUser,
    getStreamByUserId,
    getFollowerCount,
    getChannelSummary
};