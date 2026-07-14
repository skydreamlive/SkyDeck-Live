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

    gain.gain.setValueAtTime(0.001, startTime);

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
    oscillator.stop(startTime + duration + 0.03);
}
const followAudio =
    new Audio("assets/sounds/follow.mp3");

const giftAudio =
    new Audio("assets/sounds/gift.mp3");

const shareAudio =
    new Audio("assets/sounds/share.mp3");
const takeoffAudio =
    new Audio("assets/sounds/takeoff.mp3");

function playAudioFile(audio) {
    if (!audio) {
        return;
    }

    audio.currentTime = 0;
    audio.volume = window.SKYDECK_CONFIG.volume ?? 1;

    audio.play().catch(error => {
        console.warn(
            "Lecture audio impossible :",
            error
        );
    });
}

function playFollowSound() {
    playAudioFile(followAudio);
}


function playGiftSound() {
    playAudioFile(giftAudio);
}


function playShareSound() {
    playAudioFile(shareAudio);
}
function playTakeoffSound() {
    playAudioFile(takeoffAudio);
}