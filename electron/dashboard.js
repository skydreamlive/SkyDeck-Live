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
    refreshAll
);


async function initializeDashboard() {
    resetRestreamStatus();

    const loaded =
        await loadPrograms(true);

    if (loaded) {
        await refreshStatuses();
    }

    window.setInterval(
        refreshAll,
        3000
    );
}


initializeDashboard();
