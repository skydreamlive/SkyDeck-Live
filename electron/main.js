const path = require("node:path");

const {
    app,
    BrowserWindow,
    ipcMain,
    shell,
    dialog
} = require("electron");

const {
    launchProgram
} = require("./launcher");

const {
    getProgramStatuses,
    closeProgram
} = require("./processManager");

const {
    getProgramsList,
    replacePrograms
} = require("./programs");

const {
    savePrograms
} = require("./config");


/* ===========================
   CACHE ELECTRON
=========================== */

const userDataPath = path.join(
    process.env.APPDATA || app.getPath("appData"),
    "SkyDeckLive"
);

app.setPath("userData", userDataPath);

app.commandLine.appendSwitch(
    "disk-cache-dir",
    path.join(userDataPath, "Cache")
);


/* ===========================
   FENÊTRES
=========================== */

let dashboardWindow = null;
let overlayWindow = null;
let settingsWindow = null;


function createDashboardWindow() {
    dashboardWindow = new BrowserWindow({
        width: 1280,
        height: 720,

        minWidth: 1000,
        minHeight: 650,

        title: "SkyDeck Live",
        backgroundColor: "#081018",

        webPreferences: {
            preload: path.join(__dirname, "preload.js"),
            contextIsolation: true,
            nodeIntegration: false
        }
    });

    dashboardWindow.loadFile(
        path.join(__dirname, "dashboard.html")
    );

    dashboardWindow.on("closed", () => {
        dashboardWindow = null;
    });
}


function createOverlayWindow() {
    if (
        overlayWindow &&
        !overlayWindow.isDestroyed()
    ) {
        overlayWindow.show();
        overlayWindow.focus();

        return {
            success: true,
            alreadyRunning: true,
            message: "Overlay déjà ouvert."
        };
    }

    overlayWindow = new BrowserWindow({
        width: 800,
        height: 600,

        title: "SkyDeck Live Overlay",
        backgroundColor: "#081018",

        show: true,

        webPreferences: {
            contextIsolation: true,
            nodeIntegration: false
        }
    });

    overlayWindow.loadFile(
        path.join(__dirname, "..", "index.html")
    );

    overlayWindow.on("closed", () => {
        overlayWindow = null;
    });

    return {
        success: true,
        alreadyRunning: false,
        message: "Overlay ouvert."
    };
}
function createSettingsWindow() {
    
    console.log(
        "Création de la fenêtre Paramètres"
    );

    // reste de la fonction...
    if (
        settingsWindow &&
        !settingsWindow.isDestroyed()
    ) {
        settingsWindow.focus();

        return {
            success: true
        };
    }

    settingsWindow = new BrowserWindow({
        width: 950,
        height: 720,

        resizable: false,

        title: "SkyDeck Live - Paramètres",

        backgroundColor: "#081018",

        parent: dashboardWindow,

        webPreferences: {
            preload: path.join(
                __dirname,
                "preload.js"
            ),
            contextIsolation: true,
            nodeIntegration: false
        }
    });

    settingsWindow.loadFile(
        path.join(
            __dirname,
            "settings.html"
        )
    );

    settingsWindow.on(
        "closed",
        () => {
            settingsWindow = null;
        }
    );

    return {
        success: true
    };
}


/* ===========================
   DÉMARRAGE ELECTRON
=========================== */

app.whenReady().then(() => {
    ipcMain.handle(
        "launch-overlay",
        async () => {
            return createOverlayWindow();
        }
    );
ipcMain.handle(
    "open-settings",
    async () => {
        console.log(
            "Demande d’ouverture des Paramètres reçue"
        );

        return createSettingsWindow();
    }
);
    ipcMain.handle(
        "launch-program",
        async (_event, programId) => {
            return await launchProgram(programId);
        }
    );

    ipcMain.handle(
        "close-program",
        async (_event, programId) => {
            return await closeProgram(programId);
        }
    );

    ipcMain.handle(
        "get-program-statuses",
        async () => {
            return await getProgramStatuses(
                overlayWindow
            );
        }
    );

    ipcMain.handle(
        "open-restream",
        async () => {
            try {
                await shell.openExternal(
                    "https://restream.io/channel"
                );

                return {
                    success: true,
                    message: "Restream ouvert."
                };
            } catch (error) {
                console.error(
                    "Erreur ouverture Restream :",
                    error
                );

                return {
                    success: false,
                    message:
                        "Impossible d’ouvrir Restream."
                };
            }
        }
    );

    ipcMain.handle(
    "get-programs",
    async () => {
        return {
            success: true,
            programs: getProgramsList()
        };
    }
);

ipcMain.handle(
    "browse-program",
    async (_event, currentPath = "") => {
        const result =
            await dialog.showOpenDialog(
                settingsWindow || dashboardWindow,
                {
                    title: "Choisir un programme",
                    defaultPath:
                        currentPath || undefined,
                    properties: [
                        "openFile"
                    ],
                    filters: [
                        {
                            name: "Programmes Windows",
                            extensions: [
                                "exe",
                                "bat",
                                "cmd"
                            ]
                        },
                        {
                            name: "Tous les fichiers",
                            extensions: ["*"]
                        }
                    ]
                }
            );

        if (
            result.canceled ||
            result.filePaths.length === 0
        ) {
            return {
                success: false,
                canceled: true
            };
        }

        const selectedPath =
            result.filePaths[0];

        return {
            success: true,
            path: selectedPath,
            processName: path.basename(
                selectedPath
            ),
            suggestedName: path.basename(
                selectedPath,
                path.extname(selectedPath)
            )
        };
    }
);

ipcMain.handle(
    "save-programs",
    async (_event, programs) => {
        try {
            if (!Array.isArray(programs)) {
                throw new Error(
                    "La configuration doit être une liste."
                );
            }

            const cleanedPrograms =
                programs.map(program => ({
                    ...program,
                    id: String(program.id || "")
                        .trim(),
                    name: String(program.name || "")
                        .trim(),
                    path: program.path
                        ? String(program.path).trim()
                        : "",
                    processNames:
                        Array.isArray(
                            program.processNames
                        )
                            ? program.processNames
                                .map(name =>
                                    String(name).trim()
                                )
                                .filter(Boolean)
                            : []
                }));

            const invalidProgram =
                cleanedPrograms.find(
                    program =>
                        !program.id ||
                        !program.name ||
                        (
                            !program.useShellApp &&
                            !program.path
                        )
                );

            if (invalidProgram) {
                throw new Error(
                    "Un logiciel contient des informations incomplètes."
                );
            }

            const ids =
                cleanedPrograms.map(
                    program => program.id
                );

            if (
                new Set(ids).size !== ids.length
            ) {
                throw new Error(
                    "Deux logiciels utilisent le même identifiant."
                );
            }

            savePrograms(cleanedPrograms);
            replacePrograms(cleanedPrograms);

            return {
                success: true,
                message:
                    "Configuration enregistrée."
            };
        } catch (error) {
            console.error(
                "Erreur enregistrement programmes :",
                error
            );

            return {
                success: false,
                message: error.message
            };
        }
    }
);

    createDashboardWindow();

    app.on("activate", () => {
        if (
            BrowserWindow
                .getAllWindows()
                .length === 0
        ) {
            createDashboardWindow();
        }
    });
});


app.on("window-all-closed", () => {
    if (process.platform !== "darwin") {
        app.quit();
    }
});