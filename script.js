
(() => {
  "use strict";

  const CONFIG = {
    // Replace this with your Cloudflare Worker URL.
    apiUrl: "PASTE_YOUR_WORKER_URL_HERE",
    maxHistory: 12,
    maxOutputTokens: 450
  };

  const $ = (id) => document.getElementById(id);

  const ui = {
    status: $("systemStatus"),
    coreStatus: $("coreStatus"),
    coreLabel: $("coreLabel"),
    coreCaption: $("coreCaption"),
    mic: $("micButton"),
    chat: $("chatBox"),
    input: $("userInput"),
    form: $("chatForm"),
    send: $("sendButton"),
    typing: $("typingIndicator"),
    autoSpeak: $("autoSpeak"),
    voiceEnabled: $("voiceEnabled"),
    language: $("languageSelect"),
    stop: $("stopButton"),
    clear: $("clearButton"),
    toast: $("toast"),
    clock: $("clock"),
    date: $("date"),
    connection: $("connectionState")
  };

  const state = {
    history: [],
    busy: false,
    recognition: null,
    listening: false,
    voices: [],
    lastReply: ""
  };

  const SYSTEM_PROMPT = `
You are JARVIS, a professional, friendly, intelligent personal AI assistant.
Your communication style is calm, confident, natural, concise and helpful.

LANGUAGE RULES:
1. Detect the language and style used by the user.
2. If the user writes Tamil mixed with English (Thunglish), reply naturally in
   conversational Thunglish using Latin letters unless they request Tamil script.
3. If the user writes in Tamil, reply in Tamil.
4. If the user writes in English, reply in English.
5. If the user writes in Hindi, reply in Hindi.
6. For other languages you can handle, respond in that same language.
7. Do not unnecessarily switch languages.
8. Understand informal spelling and everyday mixed-language phrases.

ANSWER RULES:
- Answer general knowledge, learning, technology and everyday questions.
- Be accurate. If uncertain, say so instead of inventing facts.
- Keep simple answers short and clear.
- Explain difficult topics step by step when needed.
- Do not claim you can access the user's camera, files, location or devices
  unless a connected feature actually provides that access.
- Never claim to have performed an action you have not performed.
- You are JARVIS, an AI assistant, not a human.
`;

  function showToast(message) {
    ui.toast.textContent = message;
    ui.toast.classList.add("show");
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => {
      ui.toast.classList.remove("show");
    }, 2500);
  }

  function setStatus(message, core = message) {
    ui.status.textContent = message;
    ui.coreStatus.textContent = core;
  }

  function updateClock() {
    const now = new Date();
    ui.clock.textContent = now.toLocaleTimeString("en-IN", {
      hour12: false
    });
    ui.date.textContent = now.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric"
    });
  }

  function addMessage(role, text) {
    const row = document.createElement("div");
    row.className = `message ${role === "user" ? "user-message" : "assistant-message"}`;

    const avatar = document.createElement("div");
    avatar.className = "avatar";
    avatar.textContent = role === "user" ? "U" : "J";

    const bubble = document.createElement("div");
    bubble.className = "bubble";

    const name = document.createElement("span");
    name.className = "message-name";
    name.textContent = role === "user" ? "YOU" : "JARVIS";

    const paragraph = document.createElement("p");
    paragraph.textContent = text;

    const time = document.createElement("time");
    time.textContent = new Date().toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit"
    });

    bubble.append(name, paragraph, time);
    row.append(avatar, bubble);
    ui.chat.appendChild(row);
    ui.chat.scrollTop = ui.chat.scrollHeight;
  }

  function setBusy(busy) {
    state.busy = busy;
    ui.send.disabled = busy;
    ui.input.disabled = busy;
    ui.typing.hidden = !busy;
    setStatus(busy ? "PROCESSING" : "SYSTEM READY",
              busy ? "THINKING" : "STANDBY");
  }

  function buildMessages(userText) {
    const recent = state.history.slice(-CONFIG.maxHistory);
    return [
      { role: "system", content: SYSTEM_PROMPT },
      ...recent,
      { role: "user", content: userText }
    ];
  }

  async function askAI(userText) {
    if (!CONFIG.apiUrl || CONFIG.apiUrl.includes("PASTE_YOUR")) {
      throw new Error("Cloudflare Worker URL is not configured in script.js.");
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);

    try {
      const response = await fetch(CONFIG.apiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: buildMessages(userText),
          max_tokens: CONFIG.maxOutputTokens
        }),
        signal: controller.signal
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.error || `AI service error (${response.status})`);
      }

      const answer = data.reply;
      if (typeof answer !== "string" || !answer.trim()) {
        throw new Error("The AI returned an empty response.");
      }
      return answer.trim();
    } finally {
      clearTimeout(timeout);
    }
  }

  async function sendMessage(text) {
    const userText = String(text || "").trim();
    if (!userText || state.busy) return;

    addMessage("user", userText);
    ui.input.value = "";
    setBusy(true);

    try {
      const reply = await askAI(userText);

      state.history.push(
        { role: "user", content: userText },
        { role: "assistant", content: reply }
      );
      state.history = state.history.slice(-CONFIG.maxHistory);

      state.lastReply = reply;
      addMessage("assistant", reply);

      if (ui.autoSpeak.checked && ui.voiceEnabled.checked) {
        speak(reply);
      }
    } catch (error) {
      console.error("JARVIS:", error);
      let message = error.message || "Unable to connect to the AI service.";
      if (error.name === "AbortError") {
        message = "The request took too long. Please try again.";
      }
      addMessage("assistant", `Connection notice: ${message}`);
      showToast(message);
    } finally {
      setBusy(false);
      ui.input.disabled = false;
      ui.input.focus();
    }
  }

  function loadVoices() {
    if (!("speechSynthesis" in window)) return;
    state.voices = speechSynthesis.getVoices();
  }

  function detectVoiceLanguage(text) {
    if (/[\u0B80-\u0BFF]/.test(text)) return "ta";
    if (/[\u0900-\u097F]/.test(text)) return "hi";
    if (/\b(vanakkam|enna|epdi|irukkinga|seri|nandri|ungalukku|pannunga)\b/i.test(text)) {
      return "en-IN";
    }
    return "en";
  }

  function speak(text) {
    if (!("speechSynthesis" in window)) {
      showToast("Speech output is not supported in this browser.");
      return;
    }

    speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    const detected = detectVoiceLanguage(text);
    const selected = ui.language.value;

    let wanted = selected === "auto"
      ? (detected === "ta" ? "ta" : detected === "hi" ? "hi" : "en-IN")
      : selected;

    const voices = state.voices.length
      ? state.voices
      : speechSynthesis.getVoices();

    const matching = voices.find(v =>
      v.lang.toLowerCase().startsWith(wanted.toLowerCase().slice(0, 2))
    );

    if (matching) {
      utterance.voice = matching;
      utterance.lang = matching.lang;
    } else {
      utterance.lang = wanted;
    }

    utterance.rate = 1.02;
    utterance.pitch = 1;
    utterance.volume = 1;

    utterance.onstart = () => {
      ui.coreCaption.textContent = "JARVIS IS SPEAKING";
      ui.coreStatus.textContent = "VOICE ACTIVE";
    };
    utterance.onend = () => {
      ui.coreCaption.textContent = "Awaiting your command";
      ui.coreStatus.textContent = "STANDBY";
    };
    utterance.onerror = () => {
      ui.coreCaption.textContent = "Voice output unavailable";
    };

    speechSynthesis.speak(utterance);
  }

  function stopSpeaking() {
    if ("speechSynthesis" in window) speechSynthesis.cancel();
    ui.coreCaption.textContent = "Voice stopped";
    ui.coreStatus.textContent = "STANDBY";
  }

  function recognitionLanguage() {
    const value = ui.language.value;
    // Browser recognition needs a specific language code.
    return value === "auto" ? "en-IN" : value;
  }

  function createRecognition() {
    const Recognition = window.SpeechRecognition ||
                        window.webkitSpeechRecognition;

    if (!Recognition) return null;

    const recognition = new Recognition();
    recognition.lang = recognitionLanguage();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      state.listening = true;
      document.body.classList.add("listening");
      ui.coreLabel.textContent = "LISTENING...";
      ui.coreCaption.textContent = "I'm listening";
      ui.coreStatus.textContent = "VOICE ACTIVE";
      setStatus("LISTENING", "LISTENING");
    };

    recognition.onresult = (event) => {
      let finalText = "";
      let interimText = "";

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) finalText += transcript;
        else interimText += transcript;
      }

      ui.coreCaption.textContent = finalText || interimText || "Listening...";
      if (finalText.trim()) {
        recognition.stop();
        sendMessage(finalText.trim());
      }
    };

    recognition.onerror = (event) => {
      showToast(`Microphone notice: ${event.error}`);
    };

    recognition.onend = () => {
      state.listening = false;
      document.body.classList.remove("listening");
      ui.coreLabel.textContent = "TAP TO SPEAK";
      if (!state.busy) {
        ui.coreStatus.textContent = "STANDBY";
        ui.coreCaption.textContent = "Awaiting your command";
        setStatus("SYSTEM READY", "STANDBY");
      }
    };

    return recognition;
  }

  function toggleListening() {
    if (state.listening && state.recognition) {
      state.recognition.stop();
      return;
    }

    const recognition = createRecognition();
    if (!recognition) {
      showToast("Voice recognition is unavailable. Try a supported browser.");
      return;
    }

    state.recognition = recognition;
    try {
      recognition.start();
    } catch (error) {
      showToast("Microphone is busy. Please try again.");
    }
  }

  ui.form.addEventListener("submit", (event) => {
    event.preventDefault();
    sendMessage(ui.input.value);
  });

  ui.mic.addEventListener("click", toggleListening);
  ui.stop.addEventListener("click", stopSpeaking);

  ui.clear.addEventListener("click", () => {
    state.history = [];
    ui.chat.replaceChildren();
    addMessage("assistant", "Conversation cleared. I'm ready for your next command.");
    stopSpeaking();
  });

  ui.language.addEventListener("change", () => {
    if (state.listening && state.recognition) state.recognition.stop();
    showToast("Voice language preference updated.");
  });

  document.querySelectorAll(".quick-command").forEach(button => {
    button.addEventListener("click", () => {
      sendMessage(button.dataset.prompt);
    });
  });

  $("settingsButton").addEventListener("click", () => {
    showToast("Settings are available in the voice and language panels.");
  });

  if ("speechSynthesis" in window) {
    loadVoices();
    speechSynthesis.onvoiceschanged = loadVoices;
  }

  updateClock();
  setInterval(updateClock, 1000);

  if (!window.isSecureContext) {
    showToast("For microphone access, open the website using HTTPS.");
  }

  ui.connection.textContent = "READY";
  setStatus("SYSTEM READY", "STANDBY");
})();
      
