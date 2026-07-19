let skyDeckAudioContext = null;

function getAudioContext() {
    if (!skyDeckAudioContext) {
        const AudioContextClass =
            window.AudioContext || window.webkitAudioContext;

        if (!AudioContextClass) {
            console.warn("AudioContext non disponible");
            return null;
        }

        skyDeckAudioContext = new AudioContextClass();
    }

    return skyDeckAudioContext;
}

async function unlockSkyDeckAudio() {
    const audioContext = getAudioContext();

    if (!audioContext) {
        return;
    }

    if (audioContext.state === "suspended") {
        await audioContext.resume();
    }

    console.log("🔊 Audio SkyDeck activé");
}

/* Le premier clic sur la page active les sons */
document.addEventListener(
    "click",
    unlockSkyDeckAudio,
    { once: true }
);

function playTone(
    frequency,
    duration,
    delay = 0,
    volume = 0.12
) {
    const audioContext = getAudioContext();

    if (!audioContext) {
        return;
    }

    if (audioContext.state === "suspended") {
        console.warn(
            "Audio bloqué : clique une fois sur la page."
        );
        return;
    }

    const oscillator =
        audioContext.createOscillator();

    const gain =
        audioContext.createGain();

    const startTime =
        audioContext.currentTime + delay;

    oscillator.type = "sine";

    oscillator.frequency.setValueAtTime(
        frequency,
        startTime
    );

    gain.gain.setValueAtTime(
        0.001,
        startTime
    );

    gain.gain.exponentialRampToValueAtTime(
        volume,
        startTime + 0.025
    );

    gain.gain.exponentialRampToValueAtTime(
        0.001,
        startTime + duration
    );

    oscillator.connect(gain);
    gain.connect(audioContext.destination);

    oscillator.start(startTime);
    oscillator.stop(
        startTime + duration + 0.03
    );
}

/*
Les chemins commencent par /
pour chercher les fichiers depuis la racine du serveur.
*/
const followAudio =
    new Audio("/assets/sounds/follow.mp3");

const giftAudio =
    new Audio("/assets/sounds/gift.mp3");

const shareAudio =
    new Audio("/assets/sounds/share.mp3");

const takeoffAudio =
    new Audio("/assets/sounds/takeoff.mp3");

/* Préchargement des fichiers audio */
followAudio.preload = "auto";
giftAudio.preload = "auto";
shareAudio.preload = "auto";
takeoffAudio.preload = "auto";

async function playAudioFile(audio) {
    if (!audio) {
        return;
    }

    try {
        audio.pause();
        audio.currentTime = 0;

        audio.volume =
            window.SKYDECK_CONFIG?.volume ?? 1;

        await audio.play();

        console.log(
            "🔊 Son joué :",
            audio.src
        );
    } catch (error) {
        console.error(
            "❌ Lecture audio impossible :",
            error.name,
            error.message,
            audio.src
        );
    }
}

function playFollowSound() {
    console.log("Test du son Follow");
    playAudioFile(followAudio);
}

function playGiftSound() {
    console.log("Test du son Gift");
    playAudioFile(giftAudio);
}

function playShareSound() {
    console.log("Test du son Share");
    playAudioFile(shareAudio);
}

function playTakeoffSound() {
    console.log("Test du son Takeoff");
    playAudioFile(takeoffAudio);
}