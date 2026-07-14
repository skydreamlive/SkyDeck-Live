const {
    spawn,
    execFile
} = require("node:child_process");

const fs = require("node:fs");
const path = require("node:path");

const {
    getProgram
} = require("./programs");

const {
    getRunningProcesses,
    isProgramRunning
} = require("./processManager");


async function launchProgram(programId) {
    const program = getProgram(programId);

    if (!program) {
        return {
            success: false,
            message: "Programme inconnu."
        };
    }

    try {
        const runningProcesses =
            await getRunningProcesses();

        if (
            isProgramRunning(
                program,
                runningProcesses
            )
        ) {
            return {
                success: true,
                alreadyRunning: true,
                message:
                    `${program.name} est déjà ouvert.`
            };
        }
    } catch (error) {
        console.warn(
            "Détection impossible avant lancement :",
            error
        );
    }

    if (
        !program.useShellApp &&
        (
            !program.path ||
            !fs.existsSync(program.path)
        )
    ) {
        return {
            success: false,
            message:
                `${program.name} est introuvable.`
        };
    }

    try {
        if (program.useShellApp) {
            await launchShellApp(
                program.appId,
                program.args || []
            );
        } else if (program.useStartProcess) {
            await launchWithStartProcess(
                program.path,
                program.args || []
            );
        } else {
            await launchExecutable(
                program.path,
                program.args || []
            );
        }

        return {
            success: true,
            alreadyRunning: false,
            message: `${program.name} lancé.`
        };
    } catch (error) {
        console.error(
            `Erreur lancement ${program.name} :`,
            error
        );

        return {
            success: false,
            message:
                `Impossible de lancer ${program.name}.`
        };
    }
}


function launchExecutable(
    executablePath,
    args = []
) {
    return new Promise((resolve, reject) => {
        const launchedProcess = spawn(
            executablePath,
            args,
            {
                detached: true,
                stdio: "ignore",
                cwd: path.dirname(executablePath),
                shell: false
            }
        );

        launchedProcess.once(
            "error",
            reject
        );

        launchedProcess.once(
            "spawn",
            () => {
                launchedProcess.unref();
                resolve();
            }
        );
    });
}


function launchWithStartProcess(
    executablePath,
    args = []
) {
    return new Promise((resolve, reject) => {
        const safeExecutablePath =
            escapePowerShellValue(
                executablePath
            );

        const safeWorkingDirectory =
            escapePowerShellValue(
                path.dirname(executablePath)
            );

        const argumentList =
            Array.isArray(args) && args.length > 0
                ? ` -ArgumentList ${args
                    .map(argument =>
                        `'${escapePowerShellValue(argument)}'`
                    )
                    .join(", ")}`
                : "";

        const command =
            `Start-Process ` +
            `-FilePath '${safeExecutablePath}' ` +
            `-WorkingDirectory '${safeWorkingDirectory}'` +
            argumentList;

        execFile(
            "powershell.exe",
            [
                "-NoProfile",
                "-ExecutionPolicy",
                "Bypass",
                "-Command",
                command
            ],
            {
                windowsHide: true
            },
            (error, stdout, stderr) => {
                if (error) {
                    console.error(
                        "Erreur PowerShell :",
                        error,
                        stderr
                    );

                    reject(error);
                    return;
                }

                resolve();
            }
        );
    });
}


function launchShellApp(
    appId,
    args = []
) {
    return new Promise((resolve, reject) => {
        execFile(
            "cmd.exe",
            [
                "/d",
                "/c",
                "start",
                "",
                appId,
                ...args
            ],
            {
                windowsHide: true
            },
            (error, stdout, stderr) => {
                if (error) {
                    console.error(
                        "Erreur application Windows :",
                        error,
                        stderr
                    );

                    reject(error);
                    return;
                }

                resolve();
            }
        );
    });
}


function escapePowerShellValue(value) {
    return String(value).replaceAll(
        "'",
        "''"
    );
}


module.exports = {
    launchProgram
};