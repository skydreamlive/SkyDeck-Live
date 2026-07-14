const fs = require("node:fs");
const path = require("node:path");
const { app } = require("electron");

function getConfigPath() {
    return path.join(
        app.getPath("userData"),
        "programs.json"
    );
}

function loadPrograms(defaultPrograms = []) {
    try {
        const configPath = getConfigPath();

        if (!fs.existsSync(configPath)) {
            savePrograms(defaultPrograms);
            return defaultPrograms;
        }

        const content = fs.readFileSync(
            configPath,
            "utf8"
        );

        const programs = JSON.parse(content);

        if (!Array.isArray(programs)) {
            throw new Error(
                "Le fichier programs.json doit contenir une liste."
            );
        }

        return programs;
    } catch (error) {
        console.error(
            "Erreur lecture configuration :",
            error
        );

        return defaultPrograms;
    }
}

function savePrograms(programs) {
    const configPath = getConfigPath();

    fs.mkdirSync(
        path.dirname(configPath),
        {
            recursive: true
        }
    );

    fs.writeFileSync(
        configPath,
        JSON.stringify(programs, null, 2),
        "utf8"
    );
}

module.exports = {
    getConfigPath,
    loadPrograms,
    savePrograms
};