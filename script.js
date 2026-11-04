
"use strict";

const $ = id => document.getElementById(id);

let mode = "friend";
let locked = false;
let recognition = null;
let voices = [];
let listeningEnabled = false;
let awakeUntil = 0;
let restartTimer = null;
let memory = {};

const WAKE_WORDS = [
  "hey jarvis",
  "hi jarvis",
  "hello jarvis"
];

const modeNames = {
  friend: "BEST FRIEND MODE",
  professional: "PROFESSIONAL MODE",
  funny: "FUNNY MODE",
  motivation: "MOTIVATION MODE"
};

function addMessage(text, type) {
  const el = document.createElement("div");
  el.className = "message " + type;
  el.textContent = text;
  $("chat").appendChild(el);
  $("chat").scrollTop = $("chat").scrollHeight;
}

function speak(text) {
  if (!("speechSynthesis" in window) || locked) return;

  speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = $("language").value;
  utterance.rate = Number($("rate").value);

  const selected = $("voice").value;
  const chosen = voices.find(v => v.name === selected);

  if (chosen) utterance.voice = chosen;

  speechSynthesis.speak(utterance);
}

function respond(text) {
  addMessage("JARVIS: " + text, "jarvis");
  speak(text);
}

function loadVoices() {
  if (!("speechSynthesis" in window)) return;

  voices = speechSynthesis.getVoices();
  const select = $("voice");
  const previous = select.value;

  select.replaceChildren(
    new Option("Automatic voice", "")
  );

  voices.forEach(voice => {
    select.add(new Option(
      voice.name + " (" + voice.lang + ")",
      voice.name
    ));
  });

  select.value = previous;
}

if ("speechSynthesis" in window) {
  loadVoices();
  speechSynthesis.onvoiceschanged = loadVoices;
}

function setMode(nextMode) {
  if (!modeNames[nextMode] || locked) return;

  mode = nextMode;

  document.querySelectorAll(".mode").forEach(button => {
    button.classList.toggle(
      "active",
      button.dataset.mode === mode
    );
  });

  $("modeLabel").textContent = modeNames[mode];

  const replies = {
    friend: "Best friend mode activated. Sollunga, enna matter?",
    professional: "Professional mode activated. How may I assist you?",
    funny: "Funny mode activated. Comedy department ready!",
    motivation: "Motivation mode activated. Let's make progress!"
  };

  respond(replies[mode]);
}

document.querySelectorAll(".mode").forEach(button => {
  button.addEventListener("click", () => {
    setMode(button.dataset.mode);
  });
});

function getReply(text) {
  const lower = text.toLowerCase();

  if (/^(hi|hello|hey|hai)\b/.test(lower)) {
    return "Hey! Sollunga. Enna plan innaiku?";
  }

  if (lower.includes("time")) {
    return "The current time is " +
      new Date().toLocaleTimeString();
  }

  if (lower.includes("date")) {
    return "Today's date is " +
      new Date().toLocaleDateString();
  }

  if (lower.includes("status")) {
    return "JARVIS local voice interface is active. Cloud AI and device integrations are pending.";
  }

  if (lower.includes("your name")) {
    return "I am JARVIS, your personal AI companion.";
  }

  if (lower.includes("joke")) {
    return "Why did the computer go to the doctor? Because it had a virus!";
  }

  if (lower.includes("sad") || lower.includes("upset")) {
    return "Enna aachu? Comfortable-ah irundha sollunga. Namma pesalam.";
  }

  if (lower.includes("thank")) {
    return "You're welcome! Always ready to help.";
  }

  if (lower.includes("stop speaking")) {
    speechSynthesis.cancel();
    return "Okay. I have stopped speaking.";
  }

  if (mode === "funny") {
    return "Naan ready! Innum oru command kudunga. Comedy mode active!";
  }

  if (mode === "motivation") {
    return "Small steps daily. Consistency dhaan progress. Keep going!";
  }

  if (mode === "professional") {
    return "Command received. General AI answers require the AI backend connection.";
  }

  return "Hmm, puriyudhu. Konjam detail-ah sollunga. Namma figure out pannalam.";
}

function activateOmega() {
  if (locked) return;

  locked = true;
  listeningEnabled = false;
  clearTimeout(restartTimer);

  if (recognition) {
    try {
      recognition.stop();
    } catch (e) {}
  }

  if ("speechSynthesis" in window) {
    speechSynthesis.cancel();
  }

  $("voiceStatus").textContent = "OMEGA ZERO LOCKDOWN";
  $("modeLabel").textContent = "SYSTEM LOCKED";

  document.body.classList.add("locked");

  document.querySelectorAll(
    "button, input, select"
  ).forEach(el => {
    el.disabled = true;
  });

  addMessage(
    "OMEGA ZERO: Local browser assistant locked. Listening stopped. External devices are not affected.",
    "jarvis"
  );
}

function processCommand(raw) {
  const text = raw.trim();
  if (!text || locked) return;

  const lower = text.toLowerCase();

  if (
    lower === "omega zero" ||
    lower.includes("activate omega zero")
  ) {
    addMessage("YOU: " + text, "user");
    activateOmega();
    return;
  }

  addMessage("YOU: " + text, "user");

  if (lower.includes("stop listening")) {
    listeningEnabled = false;

    if (recognition) {
      recognition.stop();
    }

    $("voiceStatus").textContent =
      "VOICE LISTENING STOPPED";

    respond("Voice listening stopped. Enable hands-free again when you need me.");
    return;
  }

  if (lower.includes("stop speaking")) {
    speechSynthesis.cancel();
    respond("Okay. I stopped speaking.");
    return;
  }

  if (lower.includes("best friend mode")) {
    setMode("friend");
    return;
  }

  if (lower.includes("professional mode")) {
    setMode("professional");
    return;
  }

  if (lower.includes("funny mode")) {
    setMode("funny");
    return;
  }

  if (lower.includes("motivation mode")) {
    setMode("motivation");
    return;
  }

  if (lower.includes("speak tamil")) {
    $("language").value = "ta-IN";
    respond("Tamil voice selected.");
    return;
  }

  if (lower.includes("speak english")) {
    $("language").value = "en-IN";
    respond("English voice selected.");
    return;
  }

  if (lower.includes("help")) {
    respond("Ask me the time, date, or status. You can also change modes or stop listening.");
    return;
  }

  if (lower.startsWith("remember that ")) {
    const preference = text.slice(14).trim();

    if (preference) {
      memory.preference = preference;
      $("memoryFeedback").textContent =
        "Preference saved for this session.";
      respond("Okay, I saved that preference for this session.");
    }
    return;
  }

  respond(getReply(text));
}

function handleVoiceText(transcript) {
  if (locked) return;

  const text = transcript.trim();
  const lower = text.toLowerCase();

  const wakeWord = WAKE_WORDS.find(word =>
    lower.includes(word)
  );

  if (wakeWord) {
    const index = lower.indexOf(wakeWord);
    const remaining = text.slice(
      index + wakeWord.length
    ).trim();

    awakeUntil = Date.now() + 20000;

    $("voiceStatus").textContent = "JARVIS ACTIVATED";
    $("reactor").classList.add("active");

    if (remaining) {
      processCommand(remaining);
    } else {
      respond("At your service. Sollunga!");
    }

    return;
  }

  if (Date.now() < awakeUntil) {
    awakeUntil = Date.now() + 20000;
    processCommand(text);
  }
}

function startListening() {
  if (locked || !recognition || !listeningEnabled) return;

  try {
    recognition.start();
  } catch (error) {
    // Recognition may already be running.
  }
}

function setupVoice() {
  const SpeechRecognition =
    window.SpeechRecognition ||
    window.webkitSpeechRecognition;

  if (!SpeechRecognition) {
    $("voiceStatus").textContent =
      "VOICE RECOGNITION NOT SUPPORTED";

    $("voiceEngine").textContent =
      "Not supported by this browser";

    return;
  }

  $("voiceEngine").textContent =
    "Browser speech recognition available";

  recognition = new SpeechRecognition();
  recognition.continuous = true;
  recognition.interimResults = false;
  recognition.lang = $("language").value;

  recognition.onstart = () => {
    $("voiceStatus").textContent =
      "LISTENING FOR HEY JARVIS...";

    $("reactor").classList.add("active");
  };

  recognition.onresult = event => {
    for (
      let i = event.resultIndex;
      i < event.results.length;
      i++
    ) {
      if (event.results[i].isFinal) {
        handleVoiceText(
          event.results[i][0].transcript
        );
      }
    }
  };

  recognition.onerror = event => {
    $("voiceStatus").textContent =
      "VOICE ERROR: " + event.error;
  };

  recognition.onend = () => {
    $("reactor").classList.remove("active");

    if (listeningEnabled && !locked) {
      clearTimeout(restartTimer);
      restartTimer = setTimeout(
        startListening,
        1000
      );
    } else if (!locked) {
      $("voiceStatus").textContent =
        "VOICE LISTENING STOPPED";
    }
  };
}

setupVoice();

$("listen").addEventListener("click", async () => {
  if (locked) return;

  if (!recognition) {
    respond("This browser does not support speech recognition. Please use a supported browser.");
    return;
  }

  listeningEnabled = true;
  recognition.lang = $("language").value;

  startListening();
});

$("send").addEventListener("click", () => {
  if (locked) return;

  const text = $("command").value;
  $("command").value = "";
  processCommand(text);
});

$("command").addEventListener("keydown", event => {
  if (event.key === "Enter") {
    $("send").click();
  }
});

$("lockdown").addEventListener("click", () => {
  if (!locked && confirm("Activate OMEGA ZERO lockdown?")) {
    activateOmega();
  }
});

$("saveMemory").addEventListener("click", () => {
  if (locked) return;

  const value = $("memoryInput").value.trim();

  if (!value) {
    $("memoryFeedback").textContent =
      "Enter a preference first.";
    return;
  }

  memory.preference = value;

  $("memoryFeedback").textContent =
    "Preference saved for this session.";

  $("memoryInput").value = "";
});
