import * as pdfjsLib from "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.0.379/pdf.min.mjs";

pdfjsLib.GlobalWorkerOptions.workerSrc =
  "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.0.379/pdf.worker.min.mjs";

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------
let docChunks = [];        // array of {text, source}
let docName = "";
let hfToken = localStorage.getItem("docutalk_hf_token") || "";

// The classic HF Inference API allows anonymous requests, but it is CORS-blocked
// for browser callers. We route through public CORS proxies (tried in order) so
// the app stays keyless. A user-supplied HF token (optional) is forwarded when present.
const PROXIES = [
  (u) => "https://api.codetabs.com/v1/proxy/?quest=" + encodeURIComponent(u),
  (u) => "https://api.allorigins.win/raw?url=" + encodeURIComponent(u),
  (u) => "https://thingproxy.freeboard.io/fetch/" + u,
];

function parseHF(data) {
  if (data && data.conversation && Array.isArray(data.conversation.generated_responses)) {
    return data.conversation.generated_responses[data.conversation.generated_responses.length - 1];
  }
  if (Array.isArray(data)) return data[0].generated_text;
  if (data && typeof data.generated_text === "string") return data.generated_text;
  return JSON.stringify(data);
}

// ---------------------------------------------------------------------------
// DOM
// ---------------------------------------------------------------------------
const fileInput = document.getElementById("pdf");
const uploadStatus = document.getElementById("uploadStatus");
const modelInput = document.getElementById("model");
const tokenInput = document.getElementById("token");
const chat = document.getElementById("chat");
const questionInput = document.getElementById("question");
const sendBtn = document.getElementById("send");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function addMessage(role, text, source) {
  const wrap = document.createElement("div");
  wrap.className = "msg " + role;
  const body = document.createElement("div");
  body.className = "bubble";
  body.textContent = text;
  wrap.appendChild(body);
  if (source) {
    const s = document.createElement("div");
    s.className = "source";
    s.textContent = "Source: " + source;
    wrap.appendChild(s);
  }
  chat.appendChild(wrap);
  chat.scrollTop = chat.scrollHeight;
}

function setStatus(msg, isError) {
  uploadStatus.textContent = msg;
  uploadStatus.className = isError ? "status err" : "status";
}

function tokenize(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2);
}

// ---------------------------------------------------------------------------
// PDF -> text -> chunks
// ---------------------------------------------------------------------------
async function extractPdfText(file) {
  const buf = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
  let full = "";
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const content = await page.getTextContent();
    const strings = content.items.map((it) => it.str).join(" ");
    full += strings + "\n";
  }
  return full;
}

function chunkText(text, size = 1000, overlap = 100) {
  const chunks = [];
  let start = 0;
  while (start < text.length) {
    const piece = text.slice(start, start + size).trim();
    if (piece) chunks.push({ text: piece, source: `${docName}#${chunks.length + 1}` });
    start += size - overlap;
  }
  return chunks;
}

// ---------------------------------------------------------------------------
// Retrieval (lightweight keyword overlap scoring — no extra API calls)
// ---------------------------------------------------------------------------
function retrieve(query, k = 4) {
  const qTokens = tokenize(query);
  if (!qTokens.length) return [];
  const scores = docChunks.map((c) => {
    const counts = {};
    for (const t of tokenize(c.text)) counts[t] = (counts[t] || 0) + 1;
    let score = 0;
    for (const qt of qTokens) score += counts[qt] || 0;
    return score;
  });
  const idx = docChunks
    .map((_, i) => i)
    .sort((a, b) => scores[b] - scores[a])
    .slice(0, k)
    .filter((i) => scores[i] > 0);
  return idx.map((i) => docChunks[i]);
}

// ---------------------------------------------------------------------------
// HF serverless Inference API (classic endpoint, CORS-proxied, keyless).
// ---------------------------------------------------------------------------
tokenInput.value = hfToken;
tokenInput.addEventListener("change", () => {
  hfToken = tokenInput.value.trim();
  localStorage.setItem("docutalk_hf_token", hfToken);
});

async function queryHF(question, context, model) {
  const apiUrl = "https://api-inference.huggingface.co/models/" + model;
  const body = {
    inputs: {
      text: `Context:\n${context}\n\nQuestion: ${question}\n\nAnswer:`,
      past_user_inputs: [],
      generated_responses: [],
    },
    parameters: { max_new_tokens: 512, temperature: 0.2, repetition_penalty: 1.1, return_full_text: false },
  };
  const headers = { "Content-Type": "application/json" };
  if (hfToken) headers["Authorization"] = "Bearer " + hfToken;

  let lastErr;
  for (const mk of PROXIES) {
    try {
      const res = await fetch(mk(apiUrl), { method: "POST", headers, body: JSON.stringify(body) });
      if (!res.ok) {
        lastErr = new Error("HF " + res.status + ": " + (await res.text()).slice(0, 300));
        continue;
      }
      return parseHF(await res.json());
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr || new Error("All CORS proxies failed");
}

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------
fileInput.addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  setStatus("Extracting text from " + file.name + " …");
  try {
    const text = await extractPdfText(file);
    docName = file.name;
    docChunks = chunkText(text);
    setStatus(`Processed ${docChunks.length} chunks from ${file.name}. Ask away!`);
    addMessage("bot", `📄 Loaded "${file.name}" (${docChunks.length} chunks). Shoot me your questions!`);
  } catch (err) {
    console.error(err);
    setStatus("Failed to read PDF: " + err.message, true);
  }
});

tokenInput.value = hfToken;

sendBtn.addEventListener("click", ask);
questionInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); ask(); }
});

async function ask() {
  const q = questionInput.value.trim();
  if (!q) return;
  if (!docChunks.length) { setStatus("Please upload a PDF first.", true); return; }

  questionInput.value = "";
  addMessage("user", q);
  addMessage("bot", "Thinking…");
  const thinking = chat.lastElementChild.querySelector(".bubble");

  const model = modelInput.value.trim() || "HuggingFaceH4/zephyr-7b-beta";
  const top = retrieve(q, 4);
  const context = top.map((c) => c.text).join("\n\n---\n\n").slice(0, 3500);

  try {
    const answer = await queryHF(q, context, model);
    thinking.textContent = answer.trim();
    if (top.length) {
      const src = top.map((c) => c.source).join(", ");
      const s = document.createElement("div");
      s.className = "source";
      s.textContent = "Sources: " + src;
      chat.lastElementChild.appendChild(s);
    }
  } catch (err) {
    console.error(err);
    thinking.textContent = "Error: " + err.message;
    thinking.parentElement.className = "msg bot err";
  }
  chat.scrollTop = chat.scrollHeight;
}
