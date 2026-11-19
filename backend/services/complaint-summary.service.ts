import crypto from "crypto";

/**
 * Chief-complaint summariser.
 *
 * Takes a raw doctor↔patient conversation transcript (Hindi, Hinglish or English),
 * translates it to English and returns a concise clinical chief-complaint summary
 * that can be dropped straight into the prescription form.
 *
 * Provider order matches the rest of the app: Gemini first (when a key exists),
 * OpenRouter as the fallback.
 */

const getGeminiKey = () => process.env.GEMINI_API_KEY || "";
const getOpenRouterKey = () => process.env.OPENROUTER_API_KEY || "";
const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

const GEMINI_MODELS = ["gemini-3.8-flash", "gemini-2.5-flash", "gemini-2.0-flash"];

const OPENROUTER_MODELS = [
  "nvidia/nemotron-3-super-120b-a12b:free",
  "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free",
  "minimax/minimax-m3.1-flash:free",
  "nvidia/nemotron-3-ultra-550b-a55b:free",
  "google/gemma-4-26b-a4b-it:free",
  "nvidia/nemotron-3.5-lightning:free",
];

export interface ComplaintSummaryResult {
  /** Clinical chief-complaint summary in English — goes into the form field. */
  chiefComplaint: string;
  /** Full English translation of the conversation (for reference / review). */
  translation: string;
  /** Language detected in the source transcript, e.g. "Hindi", "Hinglish", "English". */
  detectedLanguage: string;
  metadata: { provider: string; model: string; processingTime: number };
}

export class ComplaintSummaryError extends Error {
  constructor(message: string, public status: number = 500) {
    super(message);
    this.name = "ComplaintSummaryError";
  }
}

const SYSTEM_PROMPT = `You are a medical scribe for a hospital doctor. You listen to a consultation in Hindi, Hinglish or English and write it up in English medical language for the doctor's prescription form.`;

const USER_PROMPT = (transcript: string, languageHint?: string) => `Below is a doctor-patient consultation transcript captured by speech recognition. It may contain Hindi/Hinglish words, and speech-recognition errors.

TRANSCRIPT:
"""
${transcript}
"""

${languageHint ? `The doctor indicated the spoken language is: ${languageHint}.` : "Detect the language yourself."}

TASK:
1. Detect the language of the transcript.
2. Translate the whole conversation into clean English (keep it faithful, doctor and patient turns separated).
3. Write a CLINICAL CHIEF COMPLAINT summary in English from the patient's side of the conversation.

RULES FOR THE CHIEF COMPLAINT:
- 1-3 short sentences, maximum ~45 words. No bullet points, no headings.
- Only what the patient actually reported. Never invent symptoms.
- Use standard medical terminology, but keep it readable by a doctor.
- Include: main complaint, duration, severity/character, associated symptoms, and any explicitly stated relevant negatives.
- Do NOT include a diagnosis, no treatment plan, no advice, no doctor's questions as complaints.
- Write plain English. No markdown, no quotes around the whole summary.

Return ONLY valid JSON:
{
  "detectedLanguage": "Hindi | Hinglish | English | Other (language name)",
  "translation": "full English translation of the conversation",
  "chiefComplaint": "the concise English clinical chief complaint"
}`;

/* ── provider plumbing ─────────────────────────────────────────────── */

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function extractJson(text: string): any {
  let t = (text || "").replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
  const start = t.indexOf("{");
  const end = t.lastIndexOf("}");
  if (start !== -1 && end !== -1 && end > start) t = t.slice(start, end + 1);
  try {
    return JSON.parse(t);
  } catch {
    // tolerate trailing commas / unescaped newlines inside strings
    const cleaned = t
      .replace(/,\s*([}\]])/g, "$1")
      .replace(/(["'])\s*\n\s*\1/g, " ")
      .replace(/[\r\n]+\s*/g, " ");
    return JSON.parse(cleaned);
  }
}

async function callGemini(prompt: string, apiKey: string): Promise<string | null> {
  for (const model of GEMINI_MODELS) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.2, maxOutputTokens: 2048, responseMimeType: "application/json" },
        }),
        signal: AbortSignal.timeout(45_000),
      });
      if (!res.ok) {
        console.error(`[Complaint AI] Gemini ${model} HTTP ${res.status}`);
        continue;
      }
      const data = await res.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
      if (text) return text;
    } catch (err: any) {
      console.error(`[Complaint AI] Gemini ${model} failed:`, err.message);
    }
  }
  return null;
}

async function callOpenRouter(prompt: string, apiKey: string): Promise<string | null> {
  for (const model of OPENROUTER_MODELS) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const res = await fetch(OPENROUTER_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
            "HTTP-Referer": "https://hospital-management-system.com",
            "X-Title": "Hospital Management System",
          },
          body: JSON.stringify({
            model,
            messages: [
              { role: "system", content: SYSTEM_PROMPT },
              { role: "user", content: prompt },
            ],
            temperature: 0.2,
            max_tokens: 2048,
          }),
          signal: AbortSignal.timeout(60_000),
        });

        if (res.status === 429 && attempt === 0) {
          console.log(`[Complaint AI] ${model} rate-limited, retrying in 3s...`);
          await sleep(3000);
          continue;
        }
        if (!res.ok) {
          const errText = await res.text();
          console.error(`[Complaint AI] OpenRouter ${model} HTTP ${res.status}:`, errText.slice(0, 160));
          break;
        }

        const data = await res.json();
        const text = data?.choices?.[0]?.message?.content || "";
        if (!text) {
          console.error(`[Complaint AI] OpenRouter ${model} returned empty content`);
          break;
        }
        return text;
      } catch (err: any) {
        console.error(`[Complaint AI] OpenRouter ${model} threw:`, err.message);
        break;
      }
    }
  }
  return null;
}

/* ── public API ────────────────────────────────────────────────────── */

/**
 * Translate + summarise a consultation transcript into an English chief complaint.
 */
export async function summarizeChiefComplaint(
  transcript: string,
  opts?: { language?: string; patientName?: string; doctorName?: string }
): Promise<ComplaintSummaryResult> {
  const start = Date.now();
  const text = (transcript || "").trim();

  if (!text) {
    throw new ComplaintSummaryError("Transcript is empty — record the conversation first.", 400);
  }
  if (text.length < 10) {
    throw new ComplaintSummaryError("Transcript is too short to summarise.", 400);
  }

  const geminiKey = getGeminiKey();
  const openRouterKey = getOpenRouterKey();
  if (!geminiKey && !openRouterKey) {
    throw new ComplaintSummaryError(
      "AI provider API key is missing. Set OPENROUTER_API_KEY or GEMINI_API_KEY in .env.",
      503
    );
  }

  const header = [
    opts?.patientName ? `PATIENT: ${opts.patientName}` : "",
    opts?.doctorName ? `DOCTOR: ${opts.doctorName}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const prompt = `${header ? `${header}\n\n` : ""}${USER_PROMPT(text, opts?.language)}`;

  let raw: string | null = null;
  let provider = "";
  let model = "";

  if (geminiKey) {
    raw = await callGemini(prompt, geminiKey);
    if (raw) {
      provider = "Gemini";
      model = GEMINI_MODELS[0];
    }
  }

  if (!raw && openRouterKey) {
    raw = await callOpenRouter(prompt, openRouterKey);
    if (raw) {
      provider = "OpenRouter";
      model = OPENROUTER_MODELS[0];
    }
  }

  if (!raw) {
    throw new ComplaintSummaryError(
      "AI providers failed to summarise the conversation. Please try again.",
      502
    );
  }

  let parsed: any;
  try {
    parsed = extractJson(raw);
  } catch {
    console.error("[Complaint AI] Could not parse provider response:", raw.slice(0, 300));
    throw new ComplaintSummaryError("AI returned an unreadable response. Please try again.", 502);
  }

  const chiefComplaint = String(parsed.chiefComplaint || "").trim();
  if (!chiefComplaint) {
    throw new ComplaintSummaryError("AI could not derive a chief complaint from the conversation.", 502);
  }

  console.log(
    `[Complaint AI] ${provider} summary in ${Date.now() - start}ms — ${chiefComplaint.slice(0, 90)}`
  );

  return {
    chiefComplaint,
    translation: String(parsed.translation || "").trim(),
    detectedLanguage: String(parsed.detectedLanguage || "Unknown").trim(),
    metadata: { provider, model, processingTime: Date.now() - start },
  };
}

/** Stable id for a summary session — kept for client-side de-duplication. */
export function complaintSummaryId(seed: string): string {
  return crypto.createHash("sha1").update(seed).digest("hex").slice(0, 12);
}
