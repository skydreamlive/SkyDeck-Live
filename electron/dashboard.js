alert("NOUVEAU DASHBOARD.JS CHARGÉ");
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
   LISTE DES PROGRAMMES
=========================== */

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
    card.dataset.programId =
        program.id;


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

    status.textContent =
        "Arrêté";


    const button =
        document.createElement("button");

    button.type = "button";

    button.className =
        "program-button";

    button.textContent =
        "Lancer";


    information.appendChild(name);
    information.appendChild(status);

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
        const card =
            createProgramCard(program);

        programGrid.insertBefore(
            card,
            dynamicProgramsAnchor
        );
    }
}


/* ===========================
   APPARENCE DES STATUTS
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


function displayProgramStatus(
    programId,
    isRunning
) {
    const elements =
        programElements.get(programId);

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
        programElements.get(programId);

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
        programElements.get(programId);

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


/* ===========================
   LANCER / FERMER
=========================== */

async function handleProgramAction(
    programId
) {
    const elements =
        programElements.get(programId);

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
                    .closeProgram(programId)
                : await window
                    .skyDeckAPI
                    .launchProgram(programId);

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
   CHARGEMENT DES PROGRAMMES
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


/* ===========================
   ACTUALISATION DES STATUTS
=========================== */

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
    } catch (error) {
        console.error(
            "Erreur actualisation états :",
            error
        );
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

            const status =
                document.getElementById(
                    "restreamStatus"
                );

            button.disabled = true;

            button.textContent =
                "Ouverture...";

            /*
             * Restream est une page web externe.
             * SkyDeck ne peut pas détecter si
             * l'onglet du navigateur est ouvert
             * ou fermé.
             */
            status.textContent =
                "Service web";

            setStatusAppearance(
                status,
                null
            );

            try {
                const result =
                    await window
                        .skyDeckAPI
                        .openRestream();

                if (!result.success) {
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

                /*
                 * On conserve toujours un état neutre.
                 * On n'affiche jamais "Ouvert".
                 */
                status.textContent =
                    "Service web";

                setStatusAppearance(
                    status,
                    null
                );

                button.textContent =
                    "Ouvrir";
            } catch (error) {
                console.error(
                    "Erreur Restream :",
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
   DÉMARRAGE DU DASHBOARD
=========================== */

window.addEventListener(
    "focus",
    () => {
        refreshAll();
    }
);


async function initializeDashboard() {
    /*
     * Force immédiatement l’état neutre
     * de Restream, même si une ancienne
     * version affichait "Ouvert".
     */
    const restreamStatus =
        document.getElementById(
            "restreamStatus"
        );

    restreamStatus.textContent =
        "Service web";

    setStatusAppearance(
        restreamStatus,
        null
    );

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