
"use strict";

const $ = id => document.getElementById(id);

let mode = "friend";
let locked = false;
let recognition = null;
let voices = [];
let memory = {};

const SpeechRecognition =
  window.SpeechRecognition ||
  window.webkitSpeechRecognition;

const modeNames = {
  friend: "BEST FRIEND MODE",
  professional: "PROFESSIONAL MODE",
  funny: "FUNNY MODE",
  motivation: "MOTIVATION MODE"
};

function addMessage(text, type) {
  const element = document.createElement("div");
  element.className = "message " + type;
  element.textContent = text;
  $("chat").appendChild(element);
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

  select.replaceChildren(new Option("Automatic voice", ""));

  voices.forEach(voice => {
    const option = new Option(
      voice.name + " (" + voice.lang + ")",
      voice.name
    );
    select.add(option);
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

  const responses = {
    friend: "Friend mode activated. Seri, sollu! Enna matter?",
    professional: "Professional mode activated. How may I assist you?",
    funny: "Funny mode activated. Comedy department ready!",
    motivation: "Motivation mode activated. Let's work towards your goals."
  };

  respond(responses[mode]);
}

document.querySelectorAll(".mode").forEach(button => {
  button.addEventListener("click", () => {
    setMode(button.dataset.mode);
  });
});

function friendReply(text) {
  const lower = text.toLowerCase();

  if (/^(hi|hello|hey|hai)\b/.test(lower)) {
    return "Hey! Enna pannitu irukka? Innaiku enna plan?";
  }

  if (lower.includes("how are you")) {
    return "Naan super-ah ready! Nee epdi irukka?";
  }

  if (lower.includes("joke") || lower.includes("make me laugh")) {
    return "Computer-ku yen cold pudichuthu? Adhu Windows open panniruchu!";
  }

  if (lower.includes("sad") || lower.includes("upset")) {
    return "Enna aachu? Nee comfortable-ah irundha sollu. Namma calm-ah pesalam.";
  }

  if (lower.includes("happy")) {
    return "Semma! Indha happy mood continue aaganum. Enna special?";
  }

  if (lower.includes("thank")) {
    return "Anytime! Unakku useful-ah irukka help panradhu dhaan en goal.";
  }

  if (lower.includes("love you")) {
    return "That's kind of you! Naan AI companion-ah unakku helpful-ah iruppen.";
  }

  if (lower.includes("your name")) {
    return "My name is JARVIS. Your personal AI companion.";
  }

  return "Hmm, puriyudhu. Konjam detail-ah sollu. Namma idha serndhu figure out pannalam.";
}

function professionalReply(text) {
  const lower = text.toLowerCase();

  if (lower.includes("time")) {
    return "Current time: " + new Date().toLocaleTimeString();
  }

  if (lower.includes("date")) {
    return "Current date: " + new Date().toLocaleDateString();
  }

  if (lower.includes("status")) {
    return "JARVIS local interface is operational. Cloud AI and device integrations are pending.";
  }

  return "Command received. An AI backend connection is required to provide intelligent answers to general questions.";
}

function funnyReply() {
  const jokes = [
    "Naan AI. Aana enakku tea break kudukka yaarum illa!",
    "WiFi slow-ah irundha naanum silent mode poiduven!",
    "Enakku sleep thevai illa. Aana server-ku maintenance venum!",
    "Coding-la bug vandha adhu insect illa!"
  ];

  return jokes[Math.floor(Math.random() * jokes.length)];
}

function motivationReply() {
  const lines = [
    "Small steps daily. Consistency dhaan progress.",
    "Un goal perusa irukkalam. Aana start panna oru small step podhum.",
    "Mistakes are feedback. Learn, improve and continue.",
    "Innaiku un effort dhaan naalaikku un progress."
  ];

  return lines[Math.floor(Math.random() * lines.length)];
}

function answer(text) {
  if (mode === "friend") return friendReply(text);
  if (mode === "professional") return professionalReply(text);
  if (mode === "funny") return funnyReply();
  if (mode === "motivation") return motivationReply();

  return "Command received.";
}

function activateOmega() {
  if (locked) return;

  locked = true;

  if (recognition) recognition.stop();

  if ("speechSynthesis" in window) {
    speechSynthesis.cancel();
  }

  $("voiceStatus").textContent = "OMEGA ZERO LOCKDOWN";
  $("modeLabel").textContent = "SYSTEM LOCKED";

  document.body.classList.add("locked");

  document.querySelectorAll("button, input, select").forEach(el => {
    el.disabled = true;
  });

  addMessage(
    "OMEGA ZERO: Local assistant locked. Voice tasks stopped. No external device or file destruction performed.",
    "jarvis"
  );
}

function processCommand(raw) {
  const text = raw.trim();

  if (!text) return;

  const lower = text.toLowerCase();

  if (
    lower === "omega zero" ||
    lower === "omega zero lockdown"
  ) {
    addMessage("YOU: " + text, "user");
    activateOmega();
    return;
  }

  if (locked) return;

  addMessage("YOU: " + text, "user");

  if (lower.startsWith("remember that ")) {
    const preference = text.slice(14).trim();

    if (preference) {
      respond("I can save that preference using the memory settings.");
    } else {
      respond("Please tell me the preference you want to save.");
    }
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

  if (lower.includes("omega")) {
    respond("OMEGA ZERO is the emergency lockdown command.");
    return;
  }

  respond(answer(text));
}

function send() {
  if (locked) return;

  const text = $("command").value;
  $("command").value = "";
  processCommand(text);
}

$("send").addEventListener("click", send);

$("command").addEventListener("keydown", event => {
  if (event.key === "Enter") send();
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
    $("memoryFeedback").textContent = "Enter a preference first.";
    return;
  }

  memory.preference = value;
  $("memoryFeedback").textContent =
    "Preference saved for this session.";

  $("memoryInput").value = "";
});

// Voice recognition

if (SpeechRecognition) {
  recognition = new SpeechRecognition();
  recognition.continuous = false;
  recognition.interimResults = false;

  recognition.onstart = () => {
    $("reactor").classList.add("active");
    $("voiceStatus").textContent = "LISTENING...";
  };

  recognition.onresult = event => {
    const transcript =
      event.results[0][0].transcript;

    $("command").value = transcript;
    processCommand(transcript);
  };

  recognition.onerror = () => {
    $("voiceStatus").textContent =
      "VOICE ERROR - CHECK PERMISSION";
  };

  recognition.onend = () => {
    $("reactor").classList.remove("active");

    if (!locked) {
      $("voiceStatus").textContent =
        "AWAITING YOUR COMMAND";
    }
  };
}

$("listen").addEventListener("click", () => {
  if (locked) return;

  if (!recognition) {
    respond("Voice recognition is not supported. Please use text input.");
    return;
  }

  recognition.lang = $("language").value;

  try {
    recognition.start();
  } catch (error) {
    $("voiceStatus").textContent =
      "VOICE ENGINE BUSY - TRY AGAIN";
  }
});
