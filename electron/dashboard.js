const programGrid =
    document.getElementById("programGrid");

const dynamicProgramsAnchor =
    document.getElementById(
        "dynamicProgramsAnchor"
    );

const programElements = new Map();
const busyPrograms = new Set();

let programs = [];
let programsSignature = "";
let refreshInProgress = false;


/* ===========================
   OUTILS
=========================== */

function setStatusAppearance(
    statusElement,
    state
) {
    statusElement.classList.remove(
        "running",
        "stopped",
        "starting",
        "error"
    );

    if (state) {
        statusElement.classList.add(
            state
        );
    }
}


function createProgramsSignature(
    programsList
) {
    return JSON.stringify(
        programsList.map(program => ({
            id: program.id,
            name: program.name,
            path: program.path || "",
            appId: program.appId || "",
            processNames:
                program.processNames || []
        }))
    );
}


function getInitials(name) {
    const words =
        String(name || "")
            .trim()
            .split(/\s+/)
            .filter(Boolean);

    if (words.length === 0) {
        return "?";
    }

    return words
        .slice(0, 2)
        .map(word =>
            word.charAt(0).toUpperCase()
        )
        .join("");
}


/* ===========================
   ICÔNES
=========================== */

function createIconElement(program) {
    const container =
        document.createElement("div");

    container.className =
        "program-icon";

    const fallback =
        document.createElement("span");

    fallback.className =
        "program-icon-fallback";

    fallback.textContent =
        getInitials(program.name);

    container.appendChild(fallback);

    loadProgramIcon(
        program.id,
        container,
        fallback
    );

    return container;
}


async function loadProgramIcon(
    programId,
    container,
    fallback
) {
    try {
        const result =
            await window
                .skyDeckAPI
                .getProgramIcon(
                    programId
                );

        if (
            !result.success ||
            !result.iconDataUrl
        ) {
            return;
        }

        const image =
            document.createElement("img");

        image.className =
            "program-icon-image";

        image.alt = "";

        image.src =
            result.iconDataUrl;

        image.addEventListener(
            "load",
            () => {
                fallback.remove();
            }
        );

        image.addEventListener(
            "error",
            () => {
                image.remove();
            }
        );

        container.appendChild(image);
    } catch (error) {
        console.warn(
            `Icône indisponible pour ${programId} :`,
            error
        );
    }
}


/* ===========================
   CARTES DYNAMIQUES
=========================== */

function removeDynamicProgramCards() {
    for (
        const elements
        of programElements.values()
    ) {
        elements.card.remove();
    }

    programElements.clear();

    document
        .getElementById(
            "emptyProgramsMessage"
        )
        ?.remove();
}


function createProgramCard(program) {
    const card =
        document.createElement("article");

    card.className = "status";
    card.dataset.programId = program.id;

    const icon =
        createIconElement(program);

    const information =
        document.createElement("div");

    information.className =
        "program-info";

    const name =
        document.createElement("span");

    name.className =
        "program-name";

    name.textContent =
        program.name ||
        "Logiciel sans nom";

    const status =
        document.createElement("strong");

    status.className =
        "program-status stopped";

    status.textContent = "Arrêté";

    const button =
        document.createElement("button");

    button.type = "button";
    button.className =
        "program-button";
    button.textContent = "Lancer";

    information.appendChild(name);
    information.appendChild(status);

    card.appendChild(icon);
    card.appendChild(information);
    card.appendChild(button);

    button.addEventListener(
        "click",
        () => {
            handleProgramAction(
                program.id
            );
        }
    );

    programElements.set(
        program.id,
        {
            card,
            icon,
            name,
            status,
            button
        }
    );

    return card;
}


function renderPrograms() {
    removeDynamicProgramCards();

    if (programs.length === 0) {
        const emptyMessage =
            document.createElement("div");

        emptyMessage.id =
            "emptyProgramsMessage";

        emptyMessage.className =
            "empty-message";

        emptyMessage.textContent =
            "Aucun logiciel configuré. Utilise Paramètres pour en ajouter.";

        programGrid.insertBefore(
            emptyMessage,
            dynamicProgramsAnchor
        );

        return;
    }

    for (const program of programs) {
        programGrid.insertBefore(
            createProgramCard(program),
            dynamicProgramsAnchor
        );
    }
}


/* ===========================
   ÉTATS DES PROGRAMMES
=========================== */

function displayProgramStatus(
    programId,
    isRunning
) {
    const elements =
        programElements.get(
            programId
        );

    if (
        !elements ||
        busyPrograms.has(programId)
    ) {
        return;
    }

    elements.status.textContent =
        isRunning
            ? "Ouvert"
            : "Arrêté";

    setStatusAppearance(
        elements.status,
        isRunning
            ? "running"
            : "stopped"
    );

    elements.button.textContent =
        isRunning
            ? "Fermer"
            : "Lancer";

    elements.button.disabled = false;

    elements.card.classList.remove(
        "busy"
    );
}


function displayBusyState(
    programId,
    action
) {
    const elements =
        programElements.get(
            programId
        );

    if (!elements) {
        return;
    }

    busyPrograms.add(programId);

    elements.card.classList.add(
        "busy"
    );

    elements.status.textContent =
        action === "close"
            ? "Fermeture"
            : "Démarrage";

    setStatusAppearance(
        elements.status,
        "starting"
    );

    elements.button.textContent =
        action === "close"
            ? "Fermeture..."
            : "Lancement...";

    elements.button.disabled = true;
}


function displayProgramError(
    programId,
    previousAction
) {
    const elements =
        programElements.get(
            programId
        );

    if (!elements) {
        return;
    }

    busyPrograms.delete(programId);

    elements.card.classList.remove(
        "busy"
    );

    elements.status.textContent =
        "Erreur";

    setStatusAppearance(
        elements.status,
        "error"
    );

    elements.button.textContent =
        previousAction === "close"
            ? "Fermer"
            : "Réessayer";

    elements.button.disabled = false;
}


async function handleProgramAction(
    programId
) {
    const elements =
        programElements.get(
            programId
        );

    if (
        !elements ||
        busyPrograms.has(programId)
    ) {
        return;
    }

    const shouldClose =
        elements.button.textContent ===
        "Fermer";

    const action =
        shouldClose
            ? "close"
            : "launch";

    displayBusyState(
        programId,
        action
    );

    try {
        const result =
            shouldClose
                ? await window
                    .skyDeckAPI
                    .closeProgram(
                        programId
                    )
                : await window
                    .skyDeckAPI
                    .launchProgram(
                        programId
                    );

        if (!result.success) {
            displayProgramError(
                programId,
                action
            );

            return;
        }

        window.setTimeout(
            async () => {
                busyPrograms.delete(
                    programId
                );

                await refreshAll();
            },
            shouldClose
                ? 1200
                : 1600
        );
    } catch (error) {
        console.error(
            `Erreur action ${programId} :`,
            error
        );

        displayProgramError(
            programId,
            action
        );
    }
}


/* ===========================
   CHARGEMENT ET ACTUALISATION
=========================== */

async function loadPrograms(
    forceRender = false
) {
    try {
        const result =
            await window
                .skyDeckAPI
                .getPrograms();

        if (!result.success) {
            throw new Error(
                "Impossible de charger la liste des logiciels."
            );
        }

        const nextPrograms =
            Array.isArray(
                result.programs
            )
                ? result.programs
                : [];

        const nextSignature =
            createProgramsSignature(
                nextPrograms
            );

        if (
            forceRender ||
            nextSignature !==
                programsSignature
        ) {
            programs =
                structuredClone(
                    nextPrograms
                );

            programsSignature =
                nextSignature;

            renderPrograms();
        }

        return true;
    } catch (error) {
        console.error(
            "Erreur chargement programmes :",
            error
        );

        return false;
    }
}


function displayOverlayStatus(
    isRunning
) {
    const status =
        document.getElementById(
            "overlayStatus"
        );

    const button =
        document.getElementById(
            "launchOverlay"
        );

    status.textContent =
        isRunning
            ? "Ouvert"
            : "Fermé";

    setStatusAppearance(
        status,
        isRunning
            ? "running"
            : "stopped"
    );

    button.textContent =
        isRunning
            ? "Afficher"
            : "Ouvrir";

    button.disabled = false;
}


function resetRestreamStatus() {
    const status =
        document.getElementById(
            "restreamStatus"
        );

    const button =
        document.getElementById(
            "openRestream"
        );

    status.textContent =
        "Service web";

    setStatusAppearance(
        status,
        null
    );

    button.textContent = "Ouvrir";
    button.disabled = false;
}


async function refreshStatuses() {
    try {
        const result =
            await window
                .skyDeckAPI
                .getProgramStatuses();

        if (!result.success) {
            return;
        }

        for (const program of programs) {
            displayProgramStatus(
                program.id,
                Boolean(
                    result.statuses[
                        program.id
                    ]
                )
            );
        }

        displayOverlayStatus(
            Boolean(
                result.statuses.overlay
            )
        );

        resetRestreamStatus();
    } catch (error) {
        console.error(
            "Erreur actualisation états :",
            error
        );
    }
}


async function refreshAll() {
    if (refreshInProgress) {
        return;
    }

    refreshInProgress = true;

    try {
        await loadPrograms();
        await refreshStatuses();
    } finally {
        refreshInProgress = false;
    }
}


/* ===========================
   OVERLAY
=========================== */

document
    .getElementById(
        "launchOverlay"
    )
    .addEventListener(
        "click",
        async event => {
            const button =
                event.currentTarget;

            button.disabled = true;

            try {
                await window
                    .skyDeckAPI
                    .launchOverlay();

                await refreshStatuses();
            } catch (error) {
                console.error(
                    "Erreur Overlay :",
                    error
                );

                button.disabled = false;
            }
        }
    );


/* ===========================
   CHAT TIKTOK
=========================== */

document
    .getElementById(
        "openChat"
    )
    .addEventListener(
        "click",
        async event => {
            const button =
                event.currentTarget;

            const status =
                document.getElementById(
                    "chatStatus"
                );

            button.disabled = true;
            button.textContent =
                "Ouverture...";

            try {
                const result =
                    await window
                        .skyDeckAPI
                        .openChat();

                if (!result.success) {
                    throw new Error(
                        result.message ||
                        "Ouverture impossible."
                    );
                }

                status.textContent =
                    "Ouvert au premier plan";

                setStatusAppearance(
                    status,
                    "running"
                );

                button.textContent =
                    "Afficher";
            } catch (error) {
                console.error(
                    "Erreur ouverture du chat :",
                    error
                );

                status.textContent =
                    "Erreur";

                setStatusAppearance(
                    status,
                    "error"
                );

                button.textContent =
                    "Réessayer";
            } finally {
                button.disabled = false;
            }
        }
    );


/* ===========================
   RESTREAM
=========================== */

document
    .getElementById(
        "openRestream"
    )
    .addEventListener(
        "click",
        async event => {
            const button =
                event.currentTarget;

            button.disabled = true;

            button.textContent =
                "Ouverture...";

            try {
                const result =
                    await window
                        .skyDeckAPI
                        .openRestream();

                if (!result.success) {
                    const status =
                        document.getElementById(
                            "restreamStatus"
                        );

                    status.textContent =
                        "Erreur";

                    setStatusAppearance(
                        status,
                        "error"
                    );

                    button.textContent =
                        "Réessayer";

                    return;
                }
            } catch (error) {
                console.error(
                    "Erreur Restream :",
                    error
                );

                const status =
                    document.getElementById(
                        "restreamStatus"
                    );

                status.textContent =
                    "Erreur";

                setStatusAppearance(
                    status,
                    "error"
                );

                button.textContent =
                    "Réessayer";

                return;
            } finally {
                window.setTimeout(
                    resetRestreamStatus,
                    250
                );
            }
        }
    );


/* ===========================
   TWITCH
=========================== */

function getTwitchElements() {
    return {
        status: document.getElementById(
            "twitchStatus"
        ),

        channel: document.getElementById(
            "twitchChannelName"
        ),

        followers: document.getElementById(
            "twitchFollowers"
        ),

        live: document.getElementById(
            "twitchLiveStatus"
        ),

        connectButton: document.getElementById(
            "twitchConnect"
        ),

        refreshButton: document.getElementById(
            "twitchRefresh"
        )
    };
}


function getTwitchChannelName(result) {
    return result?.channel?.displayName ||
        result?.channel?.display_name ||
        result?.channel?.login ||
        result?.user?.displayName ||
        result?.user?.display_name ||
        result?.user?.login ||
        result?.displayName ||
        result?.display_name ||
        result?.login ||
        "Chaîne connectée";
}


function getTwitchFollowerCount(result) {
    const value =
        result?.followerCount ??
        result?.followers ??
        result?.channel?.followerCount ??
        result?.channel?.followers;

    return Number.isFinite(Number(value))
        ? Number(value)
        : null;
}


function getTwitchLiveState(result) {
    const stream =
        result?.stream ||
        result?.channel?.stream ||
        null;

    const isLive = Boolean(
        result?.isLive ??
        result?.live ??
        stream?.isLive ??
        stream?.is_live ??
        stream
    );

    return {
        isLive,
        title:
            result?.streamTitle ||
            result?.title ||
            stream?.title ||
            "",
        viewers:
            result?.viewerCount ??
            result?.viewers ??
            stream?.viewerCount ??
            stream?.viewer_count ??
            null
    };
}


function displayTwitchDisconnected(
    message = "Non connecté"
) {
    const elements = getTwitchElements();

    if (elements.status) {
        elements.status.textContent = message;

        setStatusAppearance(
            elements.status,
            "stopped"
        );
    }

    if (elements.channel) {
        elements.channel.textContent = "—";
    }

    if (elements.followers) {
        elements.followers.textContent = "—";
    }

    if (elements.live) {
        elements.live.textContent = "Hors ligne";

        setStatusAppearance(
            elements.live,
            "stopped"
        );
    }

    if (elements.connectButton) {
        elements.connectButton.textContent =
            "Connecter";
        elements.connectButton.disabled = false;
        elements.connectButton.dataset.connected =
            "false";
    }

    if (elements.refreshButton) {
        elements.refreshButton.disabled = true;
    }
}


function displayTwitchConnected(result) {
    const elements = getTwitchElements();
    const followerCount =
        getTwitchFollowerCount(result);
    const liveState =
        getTwitchLiveState(result);

    if (elements.status) {
        elements.status.textContent = "Connecté";

        setStatusAppearance(
            elements.status,
            "running"
        );
    }

    if (elements.channel) {
        elements.channel.textContent =
            getTwitchChannelName(result);
    }

    if (elements.followers) {
        elements.followers.textContent =
            followerCount === null
                ? "—"
                : followerCount.toLocaleString(
                    "fr-FR"
                );
    }

    if (elements.live) {
        if (liveState.isLive) {
            const viewerText =
                liveState.viewers === null
                    ? ""
                    : ` · ${Number(
                        liveState.viewers
                    ).toLocaleString(
                        "fr-FR"
                    )} spectateurs`;

            elements.live.textContent =
                liveState.title
                    ? `En direct · ${liveState.title}${viewerText}`
                    : `En direct${viewerText}`;

            setStatusAppearance(
                elements.live,
                "running"
            );
        } else {
            elements.live.textContent =
                "Hors ligne";

            setStatusAppearance(
                elements.live,
                "stopped"
            );
        }
    }

    if (elements.connectButton) {
        elements.connectButton.textContent =
            "Déconnecter";
        elements.connectButton.disabled = false;
        elements.connectButton.dataset.connected =
            "true";
    }

    if (elements.refreshButton) {
        elements.refreshButton.disabled = false;
        elements.refreshButton.textContent =
            "Actualiser";
    }
}


async function refreshTwitchStatus() {
    if (!window.skyDeckAPI?.twitch) {
        return;
    }

    const elements = getTwitchElements();

    if (
        !elements.status &&
        !elements.channel &&
        !elements.followers &&
        !elements.live &&
        !elements.connectButton &&
        !elements.refreshButton
    ) {
        return;
    }

    try {
        const result =
            await window.skyDeckAPI
                .twitch
                .getStatus();

        const connected = Boolean(
            result?.connected ??
            result?.isConnected ??
            (
                result?.success &&
                (
                    result?.channel ||
                    result?.user ||
                    result?.login
                )
            )
        );

        if (!connected) {
            displayTwitchDisconnected(
                result?.message ||
                "Non connecté"
            );

            return;
        }

        let completeResult = result;

        try {
            const followersResult =
                await window.skyDeckAPI
                    .twitch
                    .getFollowers();

            if (
                followersResult &&
                followersResult.followerCount !==
                    undefined
            ) {
                completeResult = {
                    ...result,
                    followerCount:
                        followersResult
                            .followerCount
                };
            }
        } catch (error) {
            console.warn(
                "Abonnés Twitch indisponibles :",
                error
            );
        }

        displayTwitchConnected(
            completeResult
        );
    } catch (error) {
        console.error(
            "Erreur état Twitch :",
            error
        );

        displayTwitchDisconnected(
            "Erreur"
        );

        if (elements.status) {
            setStatusAppearance(
                elements.status,
                "error"
            );
        }
    }
}


const twitchConnectButton =
    document.getElementById(
        "twitchConnect"
    );

if (twitchConnectButton) {
    twitchConnectButton.addEventListener(
        "click",
        async event => {
            const button = event.currentTarget;
            const connected =
                button.dataset.connected ===
                "true";

            button.disabled = true;
            button.textContent = connected
                ? "Déconnexion..."
                : "Connexion...";

            try {
                const result = connected
                    ? await window.skyDeckAPI
                        .twitch
                        .disconnect()
                    : await window.skyDeckAPI
                        .twitch
                        .connect();

                if (result?.success === false) {
                    throw new Error(
                        result.message ||
                        "Action Twitch impossible."
                    );
                }

                await refreshTwitchStatus();
            } catch (error) {
                console.error(
                    "Erreur connexion Twitch :",
                    error
                );

                const elements =
                    getTwitchElements();

                if (elements.status) {
                    elements.status.textContent =
                        "Erreur";

                    setStatusAppearance(
                        elements.status,
                        "error"
                    );
                }

                button.disabled = false;
                button.textContent = connected
                    ? "Déconnecter"
                    : "Réessayer";
            }
        }
    );
}


const twitchRefreshButton =
    document.getElementById(
        "twitchRefresh"
    );

if (twitchRefreshButton) {
    twitchRefreshButton.addEventListener(
        "click",
        async event => {
            const button = event.currentTarget;

            button.disabled = true;
            button.textContent =
                "Actualisation...";

            try {
                const result =
                    await window.skyDeckAPI
                        .twitch
                        .refresh();

                if (result?.success === false) {
                    throw new Error(
                        result.message ||
                        "Actualisation Twitch impossible."
                    );
                }

                await refreshTwitchStatus();
            } catch (error) {
                console.error(
                    "Erreur actualisation Twitch :",
                    error
                );

                const elements =
                    getTwitchElements();

                if (elements.status) {
                    elements.status.textContent =
                        "Erreur";

                    setStatusAppearance(
                        elements.status,
                        "error"
                    );
                }
            } finally {
                button.disabled = false;
                button.textContent =
                    "Actualiser";
            }
        }
    );
}


/* ===========================
   PARAMÈTRES
=========================== */

document
    .getElementById(
        "openSettings"
    )
    .addEventListener(
        "click",
        async () => {
            try {
                await window
                    .skyDeckAPI
                    .openSettings();
            } catch (error) {
                console.error(
                    "Erreur ouverture Paramètres :",
                    error
                );
            }
        }
    );


/* ===========================
   INITIALISATION
=========================== */

window.addEventListener(
    "focus",
    async () => {
        await refreshAll();
        await refreshTwitchStatus();
    }
);


async function initializeDashboard() {
    resetRestreamStatus();

    const loaded =
        await loadPrograms(true);

    if (loaded) {
        await refreshStatuses();
    }

    await refreshTwitchStatus();

    window.setInterval(
        refreshAll,
        3000
    );

    window.setInterval(
        refreshTwitchStatus,
        30000
    );
}


initializeDashboard();
