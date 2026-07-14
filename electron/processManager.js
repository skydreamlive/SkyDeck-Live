const { execFile } = require("node:child_process");

const {
    getProgramsList,
    getProgram
} = require("./programs");


function getRunningProcesses() {
    return new Promise((resolve, reject) => {
        execFile(
            "tasklist.exe",
            [
                "/FO",
                "CSV",
                "/NH"
            ],
            {
                windowsHide: true,
                maxBuffer: 1024 * 1024 * 5
            },
            (error, stdout, stderr) => {
                if (error) {
                    console.error(
                        "Erreur tasklist :",
                        error,
                        stderr
                    );

                    reject(error);
                    return;
                }

                const runningProcesses = new Set();

                const lines = stdout
                    .split(/\r?\n/)
                    .filter(Boolean);

                for (const line of lines) {
                    const match =
                        line.match(/^"([^"]+)"/);

                    if (match) {
                        runningProcesses.add(
                            match[1].toLowerCase()
                        );
                    }
                }

                resolve(runningProcesses);
            }
        );
    });
}


function isProgramRunning(
    program,
    runningProcesses
) {
    if (
        !Array.isArray(program.processNames) ||
        program.processNames.length === 0
    ) {
        return false;
    }

    return program.processNames.some(
        processName =>
            runningProcesses.has(
                processName.toLowerCase()
            )
    );
}


async function getProgramStatuses(
    overlayWindow = null
) {
    try {
        const runningProcesses =
            await getRunningProcesses();

        const statuses = {};

        for (const program of getProgramsList()) {
            statuses[program.id] =
                isProgramRunning(
                    program,
                    runningProcesses
                );
        }

        statuses.overlay = Boolean(
            overlayWindow &&
            !overlayWindow.isDestroyed()
        );

        return {
            success: true,
            statuses
        };
    } catch (error) {
        console.error(
            "Erreur détection des programmes :",
            error
        );

        return {
            success: false,
            statuses: {}
        };
    }
}


async function closeProgram(programId) {
    const program = getProgram(programId);

    if (!program) {
        return {
            success: false,
            message: "Programme inconnu."
        };
    }

    if (
        !Array.isArray(program.processNames) ||
        program.processNames.length === 0
    ) {
        return {
            success: false,
            message: "Aucun processus configuré."
        };
    }

    try {
        let processClosed = false;

        for (const processName of program.processNames) {
            await new Promise(resolve => {
                execFile(
                    "taskkill.exe",
                    [
                        "/IM",
                        processName,
                        "/F",
                        "/T"
                    ],
                    {
                        windowsHide: true
                    },
                    error => {
                        if (!error) {
                            processClosed = true;
                        }

                        resolve();
                    }
                );
            });
        }

        if (!processClosed) {
            return {
                success: false,
                message:
                    `${program.name} n'était pas ouvert.`
            };
        }

        return {
            success: true,
            message: `${program.name} fermé.`
        };
    } catch (error) {
        console.error(
            `Erreur fermeture ${program.name} :`,
            error
        );

        return {
            success: false,
            message:
                `Impossible de fermer ${program.name}.`
        };
    }
}


module.exports = {
    getRunningProcesses,
    isProgramRunning,
    getProgramStatuses,
    closeProgram
};