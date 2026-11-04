
/* ==========================================
   JARVIS-01 | NATURAL VOICE ENGINE
   Free browser speech APIs
========================================== */

const $ = id => document.getElementById(id);

const JARVIS = {
  workerURL: localStorage.getItem("jarvis_worker_url") || "",
  history: [],
  recognition: null,
  listening: false,
  micRunning: false,
  sleeping: false,
  speaking: false,
  busy: false,
  emergency: false,
  restarting: false,
  requestController: null,
  voiceList: [],
  voiceTimer: null
};

const SpeechRecognition =
  window.SpeechRecognition ||
  window.webkitSpeechRecognition;

const synth = window.speechSynthesis;

/* ---------- STATUS ---------- */

function status(text) {
  const element = $("status");
  if (element) element.textContent = text;
}

/* ---------- CHAT DISPLAY ---------- */

function addMessage(role, message) {
  const area = $("messages");
  if (!area) return;

  const item = document.createElement("div");
  item.className = `message ${role}`;
  item.textContent = message;

  area.appendChild(item);
  area.scrollTop = area.scrollHeight;
}

/* ---------- VOICE MANAGEMENT ---------- */

function loadVoices() {
  if (!synth) return;

  JARVIS.voiceList = synth.getVoices();

  const selector = $("voiceSelect");
  if (!selector) return;

  const previous = selector.value;
  selector.innerHTML = "";

  JARVIS.voiceList.forEach((voice, index) => {
    const option = document.createElement("option");
    option.value = String(index);
    option.textContent = `${voice.name} (${voice.lang})`;
    selector.appendChild(option);
  });

  if (
    previous &&
    [...selector.options].some(o => o.value === previous)
  ) {
    selector.value = previous;
  }
}

if (synth) {
  loadVoices();
  synth.onvoiceschanged = loadVoices;
}

/* ---------- LANGUAGE DETECTION ---------- */

function detectLanguage(text) {
  // Tamil script
  if (/[\u0B80-\u0BFF]/.test(text)) {
    return "ta-IN";
  }

  // Common Tanglish words
  const tanglishWords =
    /\b(naan|neenga|irukka|irukku|epdi|enna|sollu|sollunga|seri|illa|vanakkam|pannu|pannunga|saptiya|epadi)\b/i;

  if (tanglishWords.test(text)) {
    return "ta-IN";
  }

  return "en-IN";
}

/* ---------- NATURAL VOICE SELECTION ---------- */

function selectVoice(language) {
  const voices = JARVIS.voiceList;

  if (!voices.length) return null;

  const preferredIndex = $("voiceSelect")?.value;

  if (
    preferredIndex !== undefined &&
    preferredIndex !== "" &&
    voices[Number(preferredIndex)]
  ) {
    return voices[Number(preferredIndex)];
  }

  const matching = voices.filter(v =>
    v.lang.toLowerCase().startsWith(
      language.toLowerCase().slice(0, 2)
    )
  );

  if (!matching.length) {
    return voices.find(v => v.lang === "en-IN") ||
      voices.find(v => v.lang.startsWith("en")) ||
      voices[0];
  }

  const preferredNames = [
    /google/i,
    /natural/i,
    /neural/i,
    /premium/i
  ];

  for (const pattern of preferredNames) {
    const match = matching.find(v =>
      pattern.test(v.name)
    );
    if (match) return match;
  }

  return matching[0];
}

/* ---------- MICROPHONE CONTROL ---------- */

function pauseMicrophone() {
  if (JARVIS.recognition && JARVIS.micRunning) {
    try {
      JARVIS.recognition.stop();
    } catch (_) {}
  }
}

function resumeMicrophone() {
  if (
    !JARVIS.listening ||
    JARVIS.sleeping ||
    JARVIS.emergency ||
    JARVIS.speaking ||
    JARVIS.busy ||
    !JARVIS.recognition ||
    JARVIS.micRunning ||
    JARVIS.restarting
  ) return;

  JARVIS.restarting = true;

  setTimeout(() => {
    JARVIS.restarting = false;

    if (
      !JARVIS.listening ||
      JARVIS.sleeping ||
      JARVIS.emergency ||
      JARVIS.speaking ||
      JARVIS.busy ||
      JARVIS.micRunning
    ) return;

    try {
      JARVIS.recognition.start();
    } catch (_) {}
  }, 900);
}

/* ---------- SPEECH ENGINE ---------- */

function cancelSpeech() {
  if (synth) synth.cancel();
  JARVIS.speaking = false;
}

function speakText(text, options = {}) {
  if (!synth || !text) return;

  if (JARVIS.emergency && !options.force) return;
  if (JARVIS.sleeping && !options.force) return;

  cancelSpeech();
  pauseMicrophone();

  const language = options.language ||
    detectLanguage(text);

  const voice = selectVoice(language);

  // Keep replies in small natural sentence groups
  const sentences = text
    .replace(/\s+/g, " ")
    .match(/[^.!?]+[.!?]*|[^.!?]+$/g) || [text];

  const cleanSentences = sentences
    .map(s => s.trim())
    .filter(Boolean);

  let index = 0;

  function speakNext() {
    if (index >= cleanSentences.length) {
      JARVIS.speaking = false;
      status(JARVIS.sleeping ? "Sleeping" : "Ready");
      resumeMicrophone();
      return;
    }

    if (JARVIS.emergency) {
      JARVIS.speaking = false;
      return;
    }

    const sentence = cleanSentences[index++];

    const utterance =
      new SpeechSynthesisUtterance(sentence);

    if (voice) {
      utterance.voice = voice;
    }

    utterance.lang = voice?.lang || language;

    // Natural conversational starting values
    const speed = Number($("voiceSpeed")?.value || 0.95);

    utterance.rate = Math.min(1.15, Math.max(0.75, speed));
    utterance.pitch = 1.0;
    utterance.volume = 1;

    utterance.onstart = () => {
      JARVIS.speaking = true;
      status("JARVIS speaking...");
    };

    utterance.onend = () => {
      if (JARVIS.emergency) return;

      // Short pause between sentences
      setTimeout(speakNext, 250);
    };

    utterance.onerror = () => {
      JARVIS.speaking = false;
      status("Voice playback issue");
      resumeMicrophone();
    };

    synth.speak(utterance);
  }

  JARVIS.speaking = true;
  speakNext();
}

/* ---------- STOP COMMAND ---------- */

function stopJARVIS() {
  cancelSpeech();

  if (JARVIS.requestController) {
    JARVIS.requestController.abort();
    JARVIS.requestController = null;
  }

  JARVIS.busy = false;

  status("JARVIS stopped");
  resumeMicrophone();
}

/* ---------- SLEEP MODE ---------- */

function goToSleep() {
  cancelSpeech();

  JARVIS.sleeping = true;

  status("Sleeping - say Wake up JARVIS");

  speakText("Going to sleep. Call me when you need me.", {
    force: true
  });
}

/* ---------- WAKE MODE ---------- */

function wakeJARVIS() {
  JARVIS.sleeping = false;
  JARVIS.emergency = false;

  status("JARVIS activated");

  speakText("I'm here. What can I do for you?", {
    force: true
  });
}

/* ---------- EMERGENCY STOP ---------- */

function emergencyStop() {
  JARVIS.emergency = true;
  JARVIS.sleeping = true;
  JARVIS.listening = false;

  cancelSpeech();

  if (JARVIS.requestController) {
    JARVIS.requestController.abort();
    JARVIS.requestController = null;
  }

  JARVIS.busy = false;

  if (JARVIS.recognition) {
    try {
      JARVIS.recognition.stop();
    } catch (_) {}
  }

  JARVIS.micRunning = false;

  status("Emergency stop activated");
}

/* ---------- VOICE COMMANDS ---------- */

function handleVoice(rawText) {
  const text = rawText.trim();
  const lower = text.toLowerCase();

  if (!text) return;

  if (/\bstop jarvis\b/i.test(text)) {
    stopJARVIS();
    return;
  }

  if (/\bgo to sleep\b/i.test(text)) {
    goToSleep();
    return;
  }

  if (/\bwake up jarvis\b/i.test(text)) {
    wakeJARVIS();
    return;
  }

  if (JARVIS.emergency || JARVIS.sleeping) {
    if (/\bhey jarvis\b/i.test(text)) {
      wakeJARVIS();
    }
    return;
  }

  const wakePattern = /\b(hey|hi|hello)\s+jarvis\b/i;

  if (wakePattern.test(text)) {
    const command = text
      .replace(wakePattern, "")
      .trim();

    if (command) {
      sendMessage(command);
    } else {
      speakText("Yes, I'm listening.");
    }
    return;
  }

  // Ignore accidental microphone echo while speaking
  if (JARVIS.speaking || JARVIS.busy) return;

  // Once hands-free mode is active, allow normal commands
  sendMessage(text);
}

/* ---------- START LISTENING ---------- */

function startListening() {
  if (!SpeechRecognition) {
    status("Use Chrome browser for voice recognition");
    return;
  }

  if (JARVIS.listening && !JARVIS.emergency) return;

  JARVIS.emergency = false;
  JARVIS.sleeping = false;
  JARVIS.listening = true;

  const recognition = new SpeechRecognition();

  recognition.lang = $("language")?.value || "en-IN";
  recognition.continuous = true;
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;

  recognition.onstart = () => {
    JARVIS.micRunning = true;
    status("Listening - say Hey JARVIS");
  };

  recognition.onresult = event => {
    const result =
      event.results[event.results.length - 1];

    if (result.isFinal && !JARVIS.speaking) {
      handleVoice(result[0].transcript);
    }
  };

  recognition.onerror = event => {
    if (event.error === "not-allowed") {
      JARVIS.listening = false;
      status("Microphone permission denied");
    } else if (event.error !== "no-speech") {
      status("Microphone: " + event.error);
    }
  };

  recognition.onend = () => {
    JARVIS.micRunning = false;

    if (JARVIS.listening && !JARVIS.emergency) {
      resumeMicrophone();
    }
  };

  JARVIS.recognition = recognition;

  try {
    recognition.start();
  } catch (_) {
    status("Microphone could not start");
  }
}

/* ---------- CONNECT CLOUDFLARE ---------- */

async function connectWorker() {
  const input = $("workerUrl");
  const url = input?.value.trim();

  if (!url || !url.startsWith("https://")) {
    status("Enter your HTTPS Worker URL");
    return;
  }

  JARVIS.workerURL = url.replace(/\/$/, "");

  localStorage.setItem(
    "jarvis_worker_url",
    JARVIS.workerURL
  );

  try {
    const response = await fetch(
      JARVIS.workerURL + "/api/health"
    );

    if (!response.ok) throw new Error();

    const data = await response.json();

    if (data.status !== "online") throw new Error();

    status("JARVIS AI connected");

    speakText("System connection established.");
  } catch (_) {
    status("Connection failed. Check Worker URL.");
  }
}

/* ---------- AI CHAT ---------- */

async function sendMessage(message) {
  if (!message || JARVIS.busy) return;

  if (!JARVIS.workerURL) {
    addMessage(
      "jarvis",
      "Please connect my Cloudflare Worker first."
    );
    return;
  }

  JARVIS.busy = true;

  addMessage("user", message);
  status("Thinking...");

  JARVIS.history.push({
    role: "user",
    content: message
  });

  JARVIS.requestController = new AbortController();

  try {
    const response = await fetch(
      JARVIS.workerURL + "/api/chat",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          messages: JARVIS.history.slice(-12),
          mode: $("mode")?.value || "friend"
        }),
        signal: JARVIS.requestController.signal
      }
    );

    if (!response.ok) {
      throw new Error("AI server returned " + response.status);
    }

    const data = await response.json();

    const reply =
      data.response ||
      data.reply ||
      "I couldn't generate a response.";

    JARVIS.history.push({
      role: "assistant",
      content: reply
    });

    addMessage("jarvis", reply);

    if ($("autoSpeak")?.checked !== false) {
      speakText(reply);
    } else {
      status("Ready");
      resumeMicrophone();
    }

  } catch (error) {
    if (error.name !== "AbortError") {
      addMessage(
        "jarvis",
        "I am having trouble connecting to my AI service. Please check the connection."
      );
      status("AI connection error");
    }
  } finally {
    JARVIS.busy = false;
    JARVIS.requestController = null;
  }
}

/* ---------- INTERFACE ---------- */

function initializeJARVIS() {
  if ($("workerUrl")) {
    $("workerUrl").value = JARVIS.workerURL;
  }

  $("connectBtn")?.addEventListener(
    "click",
    connectWorker
  );

  $("startListening")?.addEventListener(
    "click",
    startListening
  );

  $("stopJarvis")?.addEventListener(
    "click",
    stopJARVIS
  );

  $("sleepJarvis")?.addEventListener(
    "click",
    goToSleep
  );

  $("wakeJarvis")?.addEventListener(
    "click",
    wakeJARVIS
  );

  $("emergencyStop")?.addEventListener(
    "click",
    emergencyStop
  );

  $("sendBtn")?.addEventListener("click", () => {
    const input = $("userInput");
    const value = input?.value.trim();

    if (value) {
      sendMessage(value);
      input.value = "";
    }
  });

  $("userInput")?.addEventListener("keydown", event => {
    if (event.key === "Enter") {
      $("sendBtn")?.click();
    }
  });

  $("continuous")?.addEventListener("change", event => {
    if (event.target.checked) {
      startListening();
    } else {
      JARVIS.listening = false;
      pauseMicrophone();
      status("Continuous listening disabled");
    }
  });

  loadVoices();

  status("JARVIS-01 ready. Connect your AI.");
}

document.addEventListener(
  "DOMContentLoaded",
  initializeJARVIS
);
