const $ = (id) => document.getElementById(id);

const state = {
  listening: false,
  sleeping: false,
  speaking: false,
  busy: false,
  emergency: false,
  history: [],
  recognition: null,
  requestController: null
};

const synth = window.speechSynthesis;
const SpeechRecognition =
  window.SpeechRecognition || window.webkitSpeechRecognition;

let workerURL = localStorage.getItem("jarvis_worker_url") || "";

function addMessage(role, message) {
  const area = $("messages");
  if (!area) return;

  const div = document.createElement("div");
  div.className = `message ${role}`;
  div.textContent = message;
  area.appendChild(div);
  area.scrollTop = area.scrollHeight;
}

function setStatus(message) {
  const el = $("status");
  if (el) el.textContent = message;
}

function stopSpeech() {
  synth.cancel();
  state.speaking = false;
}

function speak(message) {
  if (!message || state.emergency || state.sleeping) return;

  stopSpeech();

  const utterance = new SpeechSynthesisUtterance(message);
  const voices = synth.getVoices();

  const preferred =
    voices.find(v => /en-IN/i.test(v.lang)) ||
    voices.find(v => /en-US/i.test(v.lang)) ||
    voices.find(v => /en-GB/i.test(v.lang));

  if (preferred) utterance.voice = preferred;

  utterance.rate = Number($("voiceSpeed")?.value || 0.95);
  utterance.pitch = 1;
  utterance.volume = 1;

  utterance.onstart = () => {
    state.speaking = true;
    setStatus("JARVIS speaking...");
  };

  utterance.onend = () => {
    state.speaking = false;
    setStatus(state.sleeping ? "Sleeping" : "Ready");
  };

  utterance.onerror = () => {
    state.speaking = false;
    setStatus("Voice unavailable");
  };

  synth.speak(utterance);
}

function stopJARVIS() {
  stopSpeech();

  if (state.requestController) {
    state.requestController.abort();
    state.requestController = null;
  }

  state.busy = false;
  setStatus("Response stopped");
}

function goToSleep() {
  stopJARVIS();
  state.sleeping = true;
  setStatus("Sleeping — say Wake up JARVIS");
  speak("Going to sleep.");
}

function wakeJARVIS() {
  state.sleeping = false;
  state.emergency = false;
  setStatus("JARVIS activated");
  speak("I am online. How can I help you?");
}

function emergencyStop() {
  state.emergency = true;
  state.sleeping = true;
  stopJARVIS();

  if (state.recognition) {
    state.recognition.stop();
  }

  state.listening = false;
  setStatus("Emergency stop activated");
}

function normalize(text) {
  return text.toLowerCase().trim().replace(/[.,!?]/g, "");
}

function handleVoice(text) {
  const command = normalize(text);

  if (command.includes("stop jarvis")) {
    stopJARVIS();
    return;
  }

  if (command.includes("go to sleep")) {
    goToSleep();
    return;
  }

  if (command.includes("wake up jarvis")) {
    wakeJARVIS();
    return;
  }

  if (state.sleeping || state.emergency) {
    if (command.includes("hey jarvis")) {
      wakeJARVIS();
    }
    return;
  }

  if (!state.listening) return;

  if (command.includes("hey jarvis")) {
    const request = command.replace("hey jarvis", "").trim();

    if (request) {
      sendMessage(request);
    } else {
      speak("Yes. I am listening.");
    }

    return;
  }

  if (state.busy || state.speaking) return;

  sendMessage(text);
}

function startListening() {
  if (!SpeechRecognition) {
    setStatus("Speech recognition not supported. Try Chrome.");
    return;
  }

  if (state.listening) return;

  state.emergency = false;

  const recognition = new SpeechRecognition();
  recognition.lang = $("language")?.value || "en-IN";
  recognition.continuous = true;
  recognition.interimResults = false;

  recognition.onstart = () => {
    state.listening = true;
    setStatus("Listening — say Hey JARVIS");
  };

  recognition.onresult = (event) => {
    const result = event.results[event.results.length - 1];
    if (result.isFinal) handleVoice(result[0].transcript);
  };

  recognition.onerror = (event) => {
    setStatus("Microphone: " + event.error);
  };

  recognition.onend = () => {
    state.listening = false;

    if (!state.emergency) {
      setTimeout(() => {
        if (!state.emergency) startListening();
      }, 700);
    }
  };

  state.recognition = recognition;

  try {
    recognition.start();
  } catch (error) {
    setStatus("Could not start microphone");
  }
}

async function sendMessage(message) {
  if (!message || state.busy) return;

  if (!workerURL) {
    addMessage("jarvis", "Please connect your Cloudflare Worker first.");
    return;
  }

  state.busy = true;
  addMessage("user", message);
  setStatus("Thinking...");

  state.history.push({
    role: "user",
    content: message
  });

  state.requestController = new AbortController();

  try {
    const response = await fetch(
      workerURL.replace(/\/$/, "") + "/api/chat",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: state.history.slice(-12),
          mode: $("mode")?.value || "friend"
        }),
        signal: state.requestController.signal
      }
    );

    if (!response.ok) {
      throw new Error("Server error: " + response.status);
    }

    const data = await response.json();

    const reply =
      data.response ||
      data.reply ||
      data.result ||
      "I could not generate a response.";

    state.history.push({
      role: "assistant",
      content: reply
    });

    addMessage("jarvis", reply);

    if ($("autoSpeak")?.checked !== false) {
      speak(reply);
    } else {
      setStatus("Ready");
    }

  } catch (error) {
    if (error.name !== "AbortError") {
      addMessage("jarvis", "Connection issue. Please check your Worker URL.");
      setStatus("Connection error");
    }
  } finally {
    state.busy = false;
    state.requestController = null;
  }
}

async function connectWorker() {
  const input = $("workerUrl");
  const url = input?.value.trim();

  if (!url || !url.startsWith("https://")) {
    setStatus("Enter a valid HTTPS Worker URL");
    return;
  }

  workerURL = url.replace(/\/$/, "");
  localStorage.setItem("jarvis_worker_url", workerURL);

  try {
    const response = await fetch(workerURL + "/api/health");
    if (!response.ok) throw new Error();

    setStatus("JARVIS connected successfully");
    speak("System connection established.");
  } catch {
    setStatus("Could not connect. Check Worker URL.");
  }
}

function initialize() {
  if ($("workerUrl")) $("workerUrl").value = workerURL;

  $("connectBtn")?.addEventListener("click", connectWorker);
  $("startListening")?.addEventListener("click", startListening);
  $("stopJarvis")?.addEventListener("click", stopJARVIS);
  $("sleepJarvis")?.addEventListener("click", goToSleep);
  $("wakeJarvis")?.addEventListener("click", wakeJARVIS);
  $("emergencyStop")?.addEventListener("click", emergencyStop);

  $("sendBtn")?.addEventListener("click", () => {
    const input = $("userInput");
    if (input?.value.trim()) {
      sendMessage(input.value.trim());
      input.value = "";
    }
  });

  $("userInput")?.addEventListener("keydown", event => {
    if (event.key === "Enter") $("sendBtn")?.click();
  });

  if (synth) synth.getVoices();

  setStatus("JARVIS ready. Connect your Worker.");
}

document.addEventListener("DOMContentLoaded", initialize);
