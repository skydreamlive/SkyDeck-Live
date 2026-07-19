const alertBox =
    document.getElementById("alertBox");

const alertIcon =
    document.getElementById("alertIcon");

const alertTitle =
    document.getElementById("alertTitle");

const alertUsername =
    document.getElementById("alertUsername");

const alertMessage =
    document.getElementById("alertMessage");

const currentFollowersElement =
    document.getElementById(
        "currentFollowers"
    );

const goalFollowersElement =
    document.getElementById(
        "goalFollowers"
    );

const goalRemainingElement =
    document.getElementById(
        "goalRemaining"
    );

const goalProgressElement =
    document.getElementById(
        "goalProgress"
    );

const goalPlaneElement =
    document.getElementById(
        "goalPlane"
    );

const goalPercentElement =
    document.getElementById(
        "goalPercent"
    );

let hideTimer = null;

/*
 * L'alerte de démonstration reste cachée au démarrage.
 * Elle n'apparaît que lors d'un véritable événement TikFinity
 * ou lorsque le mode test est activé.
 */
if (alertBox) {
    alertBox.style.right = "-500px";
}



/* ===========================
   ALERTES
=========================== */

function showAlert(
    icon,
    title,
    username,
    message
) {
    alertIcon.textContent = icon;
    alertTitle.textContent = title;
    alertUsername.textContent = username;
    alertMessage.textContent = message;

    alertBox.style.right = "150px";

    clearTimeout(hideTimer);

    hideTimer = setTimeout(
        () => {
            alertBox.style.right =
                "-500px";
        },
        window
            .SKYDECK_CONFIG
            .alertDuration
    );
}


/* ===========================
   SYNCHRONISATION TIKTOK
=========================== */

async function synchronizeTikTokFollowers() {
    const syncUrl =
        window
            .SKYDECK_CONFIG
            .followerSyncUrl ||
        "/api/tiktok/followers";

    try {
        const response =
            await fetch(
                syncUrl,
                {
                    cache: "no-store"
                }
            );

        if (!response.ok) {
            throw new Error(
                `Erreur HTTP ${response.status}`
            );
        }

        const result =
            await response.json();

        if (
            !result.success ||
            !result.connected ||
            !Number.isFinite(
                result.followerCount
            )
        ) {
            console.warn(
                "TikTok non synchronisé, valeur locale conservée.",
                result.message || ""
            );

            return false;
        }

        window
            .SKYDECK_CONFIG
            .currentFollowers =
            result.followerCount;

        updateFollowerGoal(
            result.followerCount
        );

        console.log(
            `✅ ${result.followerCount.toLocaleString(
                "fr-FR"
            )} abonnés TikTok synchronisés`
        );

        return true;
    } catch (error) {
        console.warn(
            "Synchronisation TikTok indisponible :",
            error.message
        );

        /*
         * L’overlay reste utilisable avec
         * la valeur de secours de config.js.
         */
        return false;
    }
}


/* ===========================
   ÉVÉNEMENTS TIKFINITY
=========================== */

function getEventType(event) {
    return String(
        event?.event ||
        event?.eventType ||
        event?.type ||
        event?.data?.event ||
        event?.data?.eventType ||
        event?.data?.type ||
        ""
    ).toLowerCase();
}


function getUsername(event) {
    return (
        event?.data?.nickname ||
        event?.data?.uniqueId ||
        event?.nickname ||
        event?.uniqueId ||
        event?.username ||
        "Passager"
    );
}


function getGiftName(event) {
    return (
        event?.data?.giftName ||
        event?.data?.gift?.name ||
        event?.giftName ||
        "Cadeau"
    );
}


function getGiftCount(event) {
    return (
        event?.data?.repeatCount ||
        event?.data?.giftCount ||
        event?.data?.count ||
        event?.repeatCount ||
        1
    );
}


function handleTikFinityEvent(event) {
    const type =
        getEventType(event);

    const username =
        getUsername(event);

    switch (type) {
        case "follow":
            showAlert(
                "✈️",
                "Nouveau passager",
                username,
                "Bienvenue à bord"
            );

            playFollowSound();

            window
                .SKYDECK_CONFIG
                .currentFollowers += 1;

            updateFollowerGoal(
                window
                    .SKYDECK_CONFIG
                    .currentFollowers
            );
            break;

        case "gift":
            showAlert(
                "🎁",
                "Soutien reçu",
                username,
                `${getGiftName(event)} ×${getGiftCount(event)}`
            );

            playGiftSound();
            break;

        case "share":
            showAlert(
                "📡",
                "Vol partagé",
                username,
                "Merci d’avoir partagé le live"
            );

            playShareSound();
            break;

        case "like":
            console.log(
                `Like reçu de ${username}`
            );
            break;

        case "join":
            console.log(
                `${username} rejoint le live`
            );
            break;

        default:
            console.log(
                "Événement ignoré :",
                type
            );
    }
}


function connectTikFinity() {
    const socket =
        new WebSocket(
            window
                .SKYDECK_CONFIG
                .websocketUrl
        );

    socket.addEventListener(
        "open",
        () => {
            console.log(
                "✅ SkyDeck Live connecté à TikFinity"
            );
        }
    );

    socket.addEventListener(
        "message",
        message => {
            let event;

            try {
                event =
                    JSON.parse(
                        message.data
                    );
            } catch {
                return;
            }

            console.log(event);

            handleTikFinityEvent(
                event
            );
        }
    );

    socket.addEventListener(
        "close",
        () => {
            console.log(
                "❌ Déconnecté — reconnexion dans 3 secondes"
            );

            setTimeout(
                connectTikFinity,
                3000
            );
        }
    );

    socket.addEventListener(
        "error",
        () => {
            socket.close();
        }
    );
}


/* ===========================
   BOUTONS DE TEST
=========================== */

document
    .getElementById("testFollow")
    ?.addEventListener(
        "click",
        () => {
            showAlert(
                "✈️",
                "Nouveau passager",
                "SkyPilot75",
                "Bienvenue à bord"
            );

            playFollowSound();

            window
                .SKYDECK_CONFIG
                .currentFollowers += 1;

            updateFollowerGoal(
                window
                    .SKYDECK_CONFIG
                    .currentFollowers
            );
        }
    );


document
    .getElementById("testGift")
    ?.addEventListener(
        "click",
        () => {
            showAlert(
                "🎁",
                "Soutien reçu",
                "AeroFan",
                "Rose ×10"
            );

            playGiftSound();
        }
    );


document
    .getElementById("testShare")
    ?.addEventListener(
        "click",
        () => {
            showAlert(
                "📡",
                "Vol partagé",
                "Captain22",
                "Merci d'avoir partagé le live"
            );

            playShareSound();
        }
    );


const testPanel =
    document.getElementById(
        "testPanel"
    );

if (testPanel) {
    testPanel.style.display =
        window
            .SKYDECK_CONFIG
            .testMode
                ? "block"
                : "none";
}


/* ===========================
   INITIALISATION
=========================== */

async function initializeOverlay() {
    /*
     * Affichage immédiat de la valeur
     * de secours, puis remplacement
     * par le compteur TikTok réel.
     */
    updateFollowerGoal(
        window
            .SKYDECK_CONFIG
            .currentFollowers
    );

    await synchronizeTikTokFollowers();

    connectTikFinity();
}


initializeOverlay();
