const {
    loadPrograms
} = require("./config");


const DEFAULT_PROGRAMS = [
    {
        id: "obs",
        name: "OBS Studio",
        path: "C:\\Program Files\\obs-studio\\bin\\64bit\\obs64.exe",
        processNames: ["obs64.exe"]
    },

    {
        id: "tikfinity",
        name: "TikFinity",
        path: "C:\\Users\\GERAUD Pierre\\AppData\\Local\\Programs\\tikfinity\\TikFinity.exe",
        processNames: ["TikFinity.exe"]
    },

    {
        id: "trackir",
        name: "TrackIR",
        path: "C:\\Program Files (x86)\\TrackIR5\\TrackIR5.exe",
        processNames: ["TrackIR5.exe"]
    },

    {
        id: "aplv2",
        name: "A Pilot's Life V2",
        path: "C:\\Users\\GERAUD Pierre\\AppData\\Local\\Programs\\SIMBITWORLD\\A PILOT'S LIFE - CHAPTER 2\\SBW_APL_V2.exe",
        processNames: ["SBW_APL_V2.exe"]
    },

    {
        id: "sayintentions",
        name: "SayIntentions AI",
        path: "C:\\Users\\GERAUD Pierre\\AppData\\Roaming\\SayIntentionsAI\\SayIntentionsAI\\SayIntentionsAI.exe",
        processNames: ["SayIntentionsAI.exe"]
    },

    {
        id: "logitech",
        name: "Logitech Driver",
        path: "C:\\Program Files\\Logitech\\Microsoft Flight Simulator Plugin\\LogiMicrosoftFlightSimulator.exe",
        args: ["-r"],
        processNames: [
            "LogiMicrosoftFlightSimulator.exe"
        ]
    },

    {
        id: "mobiflight",
        name: "MobiFlight",
        path: "C:\\Users\\GERAUD Pierre\\AppData\\Local\\MobiFlight\\MobiFlight Connector\\MFConnector.exe",
        useStartProcess: true,
        processNames: ["MFConnector.exe"]
    },

    {
        id: "fsuipc",
        name: "FSUIPC7",
        path: "C:\\FSUIPC7\\FSUIPC7.exe",
        processNames: ["FSUIPC7.exe"]
    },

    {
        id: "msfs24",
        name: "MSFS 2024",
        appId:
            "shell:AppsFolder\\Microsoft.Limitless_8wekyb3d8bbwe!App",
        args: ["-FastLaunch"],
        useShellApp: true,
        processNames: [
            "FlightSimulator2024.exe",
            "FlightSimulator.exe"
        ],
        locked: true
    }
];


let programsList =
    loadPrograms(DEFAULT_PROGRAMS);


function getProgramsList() {
    return programsList;
}


function getProgram(programId) {
    return programsList.find(
        program => program.id === programId
    );
}


function replacePrograms(newPrograms) {
    programsList = newPrograms;
}


module.exports = {
    DEFAULT_PROGRAMS,
    getProgramsList,
    getProgram,
    replacePrograms
};