// JARVIS front end: chat, voice input, wake phrase, spoken replies, error panel.
const $ = (id) => document.getElementById(id);
const el = {
  core: $("core"), label: $("stateLabel"), log: $("log"), input: $("input"), form: $("composer"),
  mic: $("micBtn"), status: $("status"), lang: $("lang"), personality: $("personality"),
  rate: $("rate"), speak: $("speak"), wake: $("wake"), voiceInfo: $("voiceInfo"),
  settings: $("settings"), settingsBtn: $("settingsBtn"), trouble: $("trouble"),
  troubleMsg: $("troubleMsg"), troubleFix: $("troubleFix"),
};
const history = []; // kept in memory for this tab only
const WAKE = ["hey jarvis", "hey jarvis,", "hai jarvis", "hey jarvis.", "ஹே ஜார்விஸ்", "ஹலோ ஜார்விஸ்"];
const FIXES = {
  RATE_LIMIT: "Wait a minute, then try again.",
  QUOTA: "Your Cloudflare AI usage limit was reached. Wait for it to reset or upgrade the plan.",
  AI_NOT_CONFIGURED: "Open wrangler.toml and make sure the [ai] section exists, then deploy again.",
  AI_UNAVAILABLE: "Try again in a moment. If it keeps failing, check the Cloudflare dashboard status.",
  EMPTY_REPLY: "Ask the question again with different wording.",
  BAD_REQUEST: "Reload the page and try again.",
  TIMEOUT: "The server took too long. Check your internet and try again.",
  NETWORK: "You appear to be offline or the server is unreachable. Check your internet. Local replies still work for basic commands.",
  MIC_DENIED: "Allow microphone access in your browser’s site settings, then press Mic again.",
  NO_SPEECH: "Speech recognition did not hear anything. Speak closer to the microphone and try again.",
  NO_SR: "This browser has no speech recognition. Use Chrome or Edge, or type your message.",
};

// ---------- UI helpers ----------
function setState(state, text) { el.core.dataset.state = state; el.label.textContent = text; }
function addMsg(role, text) {
  const d = document.createElement("div");
  d.className = "msg " + role;
  d.textContent = text; // textContent prevents HTML injection
  el.log.appendChild(d);
  el.log.scrollTop = el.log.scrollHeight;
}
function showError(code, message) {
  el.troubleMsg.textContent = message;
  el.troubleFix.textContent = "Fix: " + (FIXES[code] || "Try again.");
  el.trouble.hidden = false;
}
$("troubleClose").onclick = () => (el.trouble.hidden = true);
el.settingsBtn.onclick = () => {
  el.settings.hidden = !el.settings.hidden;
  el.settingsBtn.setAttribute("aria-expanded", String(!el.settings.hidden));
};
$("clearBtn").onclick = () => { history.length = 0; el.log.textContent = ""; setState("idle", "Conversation cleared"); };
$("stopBtn").onclick = () => stopSpeaking();

// ---------- Local commands (work offline) ----------
function localCommand(text) {
  const t = text.toLowerCase().trim();
  if (/^(what('s| is) the )?time\b|^time (enna|ennanu)/.test(t)) return "It is " + new Date().toLocaleTimeString() + ".";
  if (/\bdate\b|\btoday\b.*\bday\b/.test(t) && t.length < 40) return "Today is " + new Date().toLocaleDateString(undefined, { dateStyle: "full" }) + ".";
  if (/^(clear|reset) (chat|conversation)/.test(t)) { $("clearBtn").click(); return "Conversation cleared."; }
  if (/^(open|call|send|delete|message)\b/.test(t)) return "I can’t control apps, calls, messages or files from the browser version. That needs the Android app with your permission.";
  return null;
}

// ---------- Connection check ----------
async function checkConnection() {
  try {
    const r = await fetch("/api/health", { cache: "no-store" });
    const j = await r.json();
    el.status.dataset.ok = String(!!j.ok);
    el.status.textContent = j.ai ? "Online · Cloud AI ready" : "Online · AI not configured";
  } catch {
    el.status.dataset.ok = "false";
    el.status.textContent = "Offline · local commands only";
  }
}
window.addEventListener("online", checkConnection);
window.addEventListener("offline", checkConnection);

// ---------- Talking to the backend ----------
async function askServer(attempt = 1) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 20000);
  try {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: history, lang: el.lang.value, personality: el.personality.value }),
      signal: ctrl.signal,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const e = data.error || { code: "AI_UNAVAILABLE", message: "The server returned an error (" + res.status + ")." };
      if (res.status >= 500 && attempt < 2) return askServer(attempt + 1);
      throw e;
    }
    return data.reply;
  } catch (e) {
    if (e && e.code) throw e;
    if (e && e.name === "AbortError") throw { code: "TIMEOUT", message: "The request timed out." };
    if (attempt < 2) return askServer(attempt + 1);
    throw { code: "NETWORK", message: "Could not reach the server." };
  } finally { clearTimeout(timer); }
}

async function handleText(text) {
  text = text.trim();
  if (!text) return;
  stopSpeaking();
  addMsg("user", text);
  const local = localCommand(text);
  if (local) { addMsg("ai", local); say(local); return; }
  history.push({ role: "user", content: text });
  setState("thinking", "Thinking…");
  try {
    const reply = await askServer();
    history.push({ role: "assistant", content: reply });
    addMsg("ai", reply);
    say(reply);
  } catch (e) {
    history.pop();
    setState("idle", "Ready");
    addMsg("ai", e.message || "Something went wrong.");
    showError(e.code, e.message || "Something went wrong.");
  }
}
el.form.addEventListener("submit", (e) => { e.preventDefault(); const v = el.input.value; el.input.value = ""; handleText(v); });

// ---------- Speech output ----------
function pickVoice() {
  const voices = speechSynthesis.getVoices();
  const l = el.lang.value.toLowerCase();
  return voices.find((v) => v.lang.toLowerCase() === l) || voices.find((v) => v.lang.toLowerCase().startsWith(l.slice(0, 2))) || null;
}
function say(text) {
  if (!el.speak.checked || !("speechSynthesis" in window)) { setState("idle", "Ready"); resumeWake(); return; }
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  const v = pickVoice();
  if (v) u.voice = v;
  u.lang = el.lang.value;
  u.rate = parseFloat(el.rate.value);
  u.onstart = () => { pauseRecognition(); setState("speaking", "Speaking… tap Mic or Stop to interrupt"); };
  u.onend = u.onerror = () => { setState("idle", "Ready"); resumeWake(); };
  speechSynthesis.speak(u);
  if (!v) el.voiceInfo.textContent = "No voice installed for this language, so the default voice is used. Install a Tamil voice in your device settings.";
}
function stopSpeaking() { if ("speechSynthesis" in window) speechSynthesis.cancel(); }
if ("speechSynthesis" in window) speechSynthesis.onvoiceschanged = () => { el.voiceInfo.textContent = pickVoice() ? "" : "No voice found for this language yet."; };

// ---------- Speech input ----------
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
let rec = null, mode = "off", awaitingCommand = false, paused = false;

function startRecognition(newMode) {
  if (!SR) { showError("NO_SR", "Speech recognition is not supported in this browser."); return false; }
  stopRecognition();
  mode = newMode; // "command" (one phrase) or "wake" (continuous)
  rec = new SR();
  rec.lang = el.lang.value;
  rec.continuous = mode === "wake";
  rec.interimResults = false;
  rec.onresult = (ev) => {
    const text = ev.results[ev.results.length - 1][0].transcript.trim();
    if (mode === "command") { el.mic.setAttribute("aria-pressed", "false"); mode = "off"; handleText(text); return; }
    const low = text.toLowerCase();
    if (awaitingCommand) { awaitingCommand = false; handleText(text); return; }
    const hit = WAKE.find((w) => low.includes(w));
    if (!hit) return; // ignore everything without the wake phrase, nothing is sent anywhere
    const rest = text.slice(low.indexOf(hit) + hit.length).replace(/^[\s,.:!]+/, "");
    if (rest) handleText(rest); else { awaitingCommand = true; setState("listening", "Listening… say your command"); }
  };
  rec.onerror = (ev) => {
    if (ev.error === "not-allowed" || ev.error === "service-not-allowed") { disableListening(); showError("MIC_DENIED", "Microphone permission was denied."); }
    else if (ev.error === "no-speech" && mode === "command") { disableListening(); showError("NO_SPEECH", "No speech was detected."); }
  };
  rec.onend = () => {
    if (mode === "wake" && el.wake.checked && !paused) { try { rec.start(); } catch {} }
    else if (mode === "command") { el.mic.setAttribute("aria-pressed", "false"); if (el.core.dataset.state === "listening") setState("idle", "Ready"); }
  };
  try { rec.start(); } catch { return false; }
  setState("listening", mode === "wake" ? "Listening for “Hey JARVIS”" : "Listening…");
  return true;
}
function stopRecognition() { if (rec) { rec.onend = null; try { rec.stop(); } catch {} rec = null; } }
function pauseRecognition() { paused = true; stopRecognition(); }
function resumeWake() { paused = false; if (el.wake.checked && mode === "wake") startRecognition("wake"); }
function disableListening() { stopRecognition(); mode = "off"; el.wake.checked = false; el.mic.setAttribute("aria-pressed", "false"); setState("idle", "Ready"); }

el.mic.onclick = () => {
  stopSpeaking();
  if (el.mic.getAttribute("aria-pressed") === "true") { disableListening(); return; }
  el.wake.checked = false;
  if (startRecognition("command")) el.mic.setAttribute("aria-pressed", "true");
};
el.wake.onchange = () => {
  if (el.wake.checked) { if (!startRecognition("wake")) el.wake.checked = false; else el.mic.setAttribute("aria-pressed", "true"); }
  else disableListening();
};
el.lang.onchange = () => { if (mode === "wake") startRecognition("wake"); };

// ---------- Start ----------
addMsg("ai", "Hello! Naan JARVIS. Sollunga, how can I help?");
checkConnection();
