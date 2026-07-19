const auth = require("./auth");
const api = require("./api");


/* ===========================
   FORMATAGE DES INFORMATIONS
=========================== */

function createDisconnectedStatus(
    message = "Compte Twitch non connecté."
) {
    return {
        success: true,
        connected: false,
        user: null,
        stream: null,
        followerCount: null,
        message
    };
}


function createConnectedStatus(
    summary,
    message = "Compte Twitch connecté."
) {
    return {
        success: true,
        connected: true,

        user: {
            id:
                summary.user.id,

            login:
                summary.user.login,

            displayName:
                summary.user.displayName,

            broadcasterType:
                summary.user.broadcasterType,

            profileImageUrl:
                summary.user.profileImageUrl,

            offlineImageUrl:
                summary.user.offlineImageUrl
        },

        stream: {
            isLive:
                Boolean(
                    summary.stream.isLive
                ),

            id:
                summary.stream.id,

            title:
                summary.stream.title || "",

            categoryId:
                summary.stream.categoryId || "",

            categoryName:
                summary.stream.categoryName || "",

            viewerCount:
                Number(
                    summary.stream.viewerCount
                ) || 0,

            startedAt:
                summary.stream.startedAt,

            thumbnailUrl:
                summary.stream.thumbnailUrl || "",

            language:
                summary.stream.language || "",

            mature:
                Boolean(
                    summary.stream.mature
                )
        },

        followerCount:
            summary.followerCount,

        message
    };
}


function createErrorStatus(
    error,
    connected = false
) {
    return {
        success: false,
        connected,
        user: null,
        stream: null,
        followerCount: null,

        message:
            error instanceof Error
                ? error.message
                : String(error)
    };
}


/* ===========================
   ÉTAT DU COMPTE
=========================== */

async function getStatus() {
    try {
        const session =
            await auth.getSession();

        if (!session.connected) {
            return createDisconnectedStatus();
        }

        const summary =
            await api.getChannelSummary();

        return createConnectedStatus(
            summary
        );
    } catch (error) {
        console.error(
            "Erreur statut Twitch :",
            error
        );

        return createErrorStatus(
            error,
            false
        );
    }
}


/* ===========================
   CONNEXION
=========================== */

async function connect() {
    try {
        await auth.connect();

        const summary =
            await api.getChannelSummary();

        return createConnectedStatus(
            summary,
            "Connexion Twitch réussie."
        );
    } catch (error) {
        console.error(
            "Erreur connexion Twitch :",
            error
        );

        return createErrorStatus(
            error,
            false
        );
    }
}


/* ===========================
   DÉCONNEXION
=========================== */

async function disconnect() {
    try {
        await auth.disconnect();

        return createDisconnectedStatus(
            "Compte Twitch déconnecté."
        );
    } catch (error) {
        console.error(
            "Erreur déconnexion Twitch :",
            error
        );

        return createErrorStatus(
            error,
            false
        );
    }
}


/* ===========================
   ACTUALISATION DE LA CHAÎNE
=========================== */

async function refreshChannel() {
    try {
        const session =
            await auth.getSession();

        if (!session.connected) {
            return createDisconnectedStatus();
        }

        const summary =
            await api.getChannelSummary();

        return createConnectedStatus(
            summary,
            "Informations Twitch actualisées."
        );
    } catch (error) {
        console.error(
            "Actualisation Twitch impossible :",
            error
        );

        const connected =
            await auth.isConnected()
                .catch(() => false);

        return createErrorStatus(
            error,
            connected
        );
    }
}


/* ===========================
   INFORMATIONS SIMPLES
=========================== */

async function isConnected() {
    return auth.isConnected();
}


async function getCurrentUser() {
    const session =
        await auth.getSession();

    if (!session.connected) {
        return null;
    }

    return api.getCurrentUser();
}


async function getFollowerCount() {
    const user =
        await getCurrentUser();

    if (!user) {
        return null;
    }

    return api.getFollowerCount(
        user.id
    );
}


/* ===========================
   EXPORTS
=========================== */

module.exports = {
    connect,
    disconnect,
    getStatus,
    refreshChannel,
    isConnected,
    getCurrentUser,
    getFollowerCount
};