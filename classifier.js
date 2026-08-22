/**
 * classifier.js
 * ----------------------------------------------------------------------------
 * Sorts every incoming message into one of: NOTE, DEADLINE, QUESTION, NOISE.
 *
 * Strategy: try cheap, instant, free rule-based checks first. Only fall back
 * to an LLM call for the genuinely ambiguous leftovers — keeps things fast,
 * free for ~80% of traffic, and demo-safe (works even if the API is slow/down).
 * ----------------------------------------------------------------------------
 */

require('dotenv').config({ quiet: true });
const Groq = require('groq-sdk');

const CATEGORIES = ['NOTE', 'DEADLINE', 'QUESTION', 'NOISE', 'PYQ'];

const { GoogleGenAI } = require('@google/genai');

// Only created if a key is present — lets the rule-based layer work standalone
const groq = process.env.GROQ_API_KEY
  ? new Groq({ apiKey: process.env.GROQ_API_KEY })
  : null;

const ai = process.env.GEMINI_API_KEY
  ? new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })
  : null;

// ---------------------------------------------------------------------------
// STEP 1: Rule-based pass (free, instant, no external calls)
// ---------------------------------------------------------------------------

const DEADLINE_KEYWORDS = /\b(deadline|last\s*date|due|submit|submission|register|registration|enroll(?:ment)?|form\s*fill|fill\s*(?:the\s*)?form|exam|attendance|mandatory|report|reach|assemble|complete|collect|payment|fee|admit\s*card|portal|consent|feedback|upload|verify|closed?|close|open|ends?|start|starts?|before|within|positively|asap|hurry|immediately|today|tomorrow)\b/i;
const DATE_PATTERN = /\b(\d{1,2}(st|nd|rd|th)?\s*(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*|\d{1,2}[/-]\d{1,2}([/-]\d{2,4})?|tomorrow|tmrw|today|tonight|monday|tuesday|wednesday|thursday|friday|saturday|sunday|(on|by)\s*\d{1,2}(st|nd|rd|th)?)\b/i;
const TIME_PATTERN = /\b\d{1,2}(:\d{2})?\s*(am|pm|a\.m\.|p\.m\.|noon)\b/i;

const NOISE_PATTERN = /^(lol+|lmao+|rofl+|ha+|ok+|okay+|k+|yes+|yeah+|yup+|no+|nope+|na+|n\/a+|cool+|nice+|great+|awesome+|done+|noted+|got it+|thanks+|thank you+|thx+|tq+|welcome+|haha+|hehe+|hi+|hello+|hey+|sup+|hola+|morning+|evening+|night+|good+|omg+|wtf+|damn+|acha+|thikache+|hm+|oh+|fuck+|ouh+|shit+|bye+|bro+|dude+|man+|sir+|maam+|ma'am+|amigo+|everyone+|all+|guys+|please+|pls+|sure+|test\s*\d*|\s+)+$/i;
const EMOJI_ONLY_PATTERN = /^[\p{Extended_Pictographic}\s]+$/u;
const ABSENCE_PATTERN = /\b(out\s+of\s+station|out\s+of\s+kolkata|can't\s+attend|cannot\s+attend|won't\s+attend|family\s+urgency|family\s+emergency|sorry\s+ma'?m|not\s+able\s+to\s+attend)\b/i;
const SYSTEM_PATTERN = /(message\s+was\s+deleted|media\s+omitted|pinned\s+a\s+message|added\s+the\s+group|removed\s+the\s+group|community\s+admin|changed\s+the\s+description)/i;

// Highly strict educational domains (YouTube is removed because it's too ambiguous)
const NOTE_URL_PATTERN = /https?:\/\/(www\.)?(drive\.google|docs\.google|forms\.gle|nit\.ac\.in|devfolio\.co|github\.com|skillindiadigital|1drv\.ms|onedrive\.live\.com|mega\.nz)/i;

const QUESTION_PATTERN = /(\?(\s*@\d+)*$|^(what|why|who|where|when|how|can|could|will|would|does|do|is|are|whose)\b|^any(one|body)\b|^any(one|body)\s+ha(s|ve)\b|^has\s+anyone\b|^can\s+(someone|anyone)\b|^pls\b|^please\b.*\b(send|share|give)\b|\b(need|send|share|provide)\s+(notes|pdf|link|material|assignment|syllabus)\b|where\s+can\s+i|roll\s+no)/i;

const ANNOUNCEMENT_PATTERN = /(dear\s+(students|all)|please\s+note|kindly|attention|this\s+is\s+for\s+your\s+information|you\s+are\s+requested|you\s+are\s+advised|gentle\s+reminder)/i;
const IMPORTANT_ANNOUNCEMENT_PATTERN = /\b(urgent|attention|notice|action\s+required|important\s+announcement|important\s+notice)\b/i;
const IMPORTANT_LIST = /\b(contact|collect|meet|today|tomorrow|urgent|report|come)\b/i;

function hasMediaAttachment(msg) {
  const m = msg.message || {};
  return Boolean(
    m.documentMessage ||
    m.documentWithCaptionMessage ||
    m.imageMessage ||
    m.videoMessage
  );
}

function ruleBasedClassify(text, msg) {
  const trimmed = (text || '').trim();

  // If there is no text, only classify as NOTE if it's a document/image. Otherwise (stickers, audio) it's NOISE.
  if (!trimmed) {
    if (hasMediaAttachment(msg)) return 'NOTE';
    return 'NOISE';
  }

  // 0. Explicit prediction commands and queries
  if (/^(\/predict|pyq)/i.test(trimmed) || /\b(predict|probable\s*questions|important\s*questions|guess\s*paper)\b/i.test(trimmed)) {
    return 'PYQ';
  }

  // 1. System/greetings/emojis/absences → NOISE
  if (NOISE_PATTERN.test(trimmed) || EMOJI_ONLY_PATTERN.test(trimmed) || SYSTEM_PATTERN.test(trimmed) || ABSENCE_PATTERN.test(trimmed)) {
    return 'NOISE';
  }

  // 1.5. Questions (strip mentions first to catch things like "@123 what is...")
  const cleanText = trimmed.replace(/@\d+\s*/g, '').trim();
  if (QUESTION_PATTERN.test(cleanText)) {
    return 'QUESTION';
  }

  // 2. Roll call / Name lists (lots of contiguous names) → NOISE
  const lines = trimmed.split('\n').filter(l => l.trim().length > 0);
  // Match lines that look like "1. John Doe" or just "John Doe" (mostly alphabetical, minimal punctuation)
  const nameLines = lines.filter(l => /^(?:\d+[\.\)]\s*)?[A-Za-z\s\.]{3,}$/.test(l.trim()));
  
  // Threshold increased to 8 to avoid falsely flagging a short list of study topics (e.g., a 5-item syllabus)
  if (lines.length >= 8 && nameLines.length >= 8) {
    if (!IMPORTANT_LIST.test(trimmed)) {
      return 'NOISE';
    }
  }

  // 3. Explicit Notes (Study links or Media)
  if (hasMediaAttachment(msg) || NOTE_URL_PATTERN.test(trimmed)) {
    // If the media has a significant caption, or if it's a YouTube link, 
    // pass it to the LLM. The AI will read the text and decide if it's a meme/joke or an actual note.
    if (trimmed.length > 20 || /youtube\.com|youtu\.be/i.test(trimmed)) {
      return null;
    }
    
    // If it contains deadline keywords, pass to LLM to decide between DEADLINE and NOTE
    if (DEADLINE_KEYWORDS.test(trimmed)) {
      return null;
    }
    return 'NOTE';
  }

  // 4. Everything else (Questions, Deadlines, conversational notes, ambiguous text) → Hand off to LLM
  return null;
}

// ---------------------------------------------------------------------------
// STEP 2: LLM fallback (only called for genuinely ambiguous messages)
// ---------------------------------------------------------------------------

async function llmClassify(text) {
  const prompt = `Classify this class group chat message into exactly one word: NOTE, DEADLINE, QUESTION, or NOISE.

- NOTE: shares study material, notes, or resources (MUST contain actual educational content, files, or links. Casual discussions are NOT notes).
- DEADLINE: mentions an assignment, exam, or submission with a time reference
- QUESTION: is genuinely asking something that needs an answer
- NOISE: casual chat, jokes, greetings, personal achievements, opinions, or anything not explicitly a NOTE, DEADLINE, or QUESTION

If in doubt between NOISE and NOTE for conversational text, ALWAYS choose NOISE.

Message: "${text}"

Reply with only the single category word, nothing else.`;

  if (groq) {
    try {
      const completion = await groq.chat.completions.create({
        model: 'openai/gpt-oss-120b', // fast + free-tier friendly on Groq
        messages: [{ role: 'user', content: prompt }],
        temperature: 0,
        max_tokens: 5,
      });

      const raw = completion.choices[0]?.message?.content?.trim().toUpperCase();
      const match = CATEGORIES.find((c) => raw?.includes(c));
      return match || 'NOISE';
    } catch (err) {
      console.warn('[classifier] Groq classification failed, trying Gemini fallback...', err.message);
    }
  }

  if (ai) {
    const models = [
      'gemini-3.5-flash-lite',
      'gemini-3.1-flash-lite'
    ];
    let lastErr;
    
    for (const model of models) {
      try {
        const response = await ai.models.generateContent({
          model,
          contents: prompt,
          config: {
            temperature: 0,
            maxOutputTokens: 5,
          }
        });
        const raw = response.text?.trim().toUpperCase();
        const match = CATEGORIES.find((c) => raw?.includes(c));
        return match || 'NOISE';
      } catch (err) {
        console.warn(`[classifier] Gemini ${model} failed: ${err.message}. Trying next...`);
        lastErr = err;
      }
    }
    console.error(`[classifier] All Gemini fallbacks failed. Last error: ${lastErr?.message}`);
  }

  console.warn('[classifier] All LLMs failed or not configured, defaulting to NOISE');
  return 'NOISE';
}

// ---------------------------------------------------------------------------
// Public function: classify a message, rule-based first, LLM as fallback
// ---------------------------------------------------------------------------

async function classifyMessage(text, msg) {
  const ruleResult = ruleBasedClassify(text, msg);
  if (ruleResult) {
    return { category: ruleResult, method: 'rule' };
  }

  const llmResult = await llmClassify(text);
  return { category: llmResult, method: 'llm' };
}

module.exports = { classifyMessage };
