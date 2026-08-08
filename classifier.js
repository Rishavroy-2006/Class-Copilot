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

// Only created if a key is present — lets the rule-based layer work standalone
const groq = process.env.GROQ_API_KEY
  ? new Groq({ apiKey: process.env.GROQ_API_KEY })
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

const NOTE_PATTERN = /\b(notes?|pdf|ppt|pptx|document|docx|brochure|notice|circular|schedule|routine|timetable|guideline|manual|syllabus|material|resource|question\s*paper|attachment|attached|media|image|flyer|list|updated\s*list|please\s*find|uploaded|\.pdf|\.pptx?|\.docx?)\b/i;
const NOTE_URL_PATTERN = /(drive\.google|docs\.google|forms\.gle|docs\.google\.com\/forms|nit\.ac\.in|devfolio|github|skillindiadigital|sbh\.rcciit|instagram\.com|facebook\.com|1drv\.ms|onedrive\.live\.com|mega\.nz)/i;

const QUESTION_PATTERN = /(\?(\s*@\d+)*$|^(what|why|who|where|when|how|can|could|will|would|does|do|is|are|whose)\b|^any(one|body)\b|^any(one|body)\s+ha(s|ve)\b|^has\s+anyone\b|^can\s+(someone|anyone)\b|^pls\b|^please\b.*\b(send|share|give)\b|\b(need|send|share|provide)\s+(notes|pdf|link|material|assignment|syllabus)\b|where\s+can\s+i|roll\s+no)/i;

const ANNOUNCEMENT_PATTERN = /(dear\s+(students|all)|please\s+note|kindly|attention|this\s+is\s+for\s+your\s+information|you\s+are\s+requested|you\s+are\s+advised|gentle\s+reminder)/i;
const IMPORTANT_ANNOUNCEMENT_PATTERN = /\b(urgent|important|attention|notice|action\s+required)\b/i;
const IMPORTANT_LIST = /\b(contact|collect|meet|today|tomorrow|urgent|report|come)\b/i;

function hasMediaAttachment(msg) {
  const m = msg.message || {};
  return Boolean(
    m.documentMessage ||
    m.documentWithCaptionMessage ||
    m.imageMessage
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

  const isDeadline = DEADLINE_KEYWORDS.test(trimmed);
  const hasDateOrTime = DATE_PATTERN.test(trimmed) || TIME_PATTERN.test(trimmed);
  const isImportant = IMPORTANT_ANNOUNCEMENT_PATTERN.test(trimmed);

  // 1. System/greetings/emojis → NOISE
  if (NOISE_PATTERN.test(trimmed) || EMOJI_ONLY_PATTERN.test(trimmed) || SYSTEM_PATTERN.test(trimmed)) {
    return 'NOISE';
  }

  // 2. Attendance excuses → NOISE
  if (ABSENCE_PATTERN.test(trimmed)) {
    return 'NOISE';
  }

  // 3. Roll call lists (lots of all-caps names) → NOISE unless they have deadline words or are important
  const lines = trimmed.split('\n');
  if (lines.length >= 4 && lines.filter(l => /^[A-Z .]+$/.test(l.trim())).length >= 3) {
    if (!isDeadline && !IMPORTANT_LIST.test(trimmed)) {
      return 'NOISE';
    }
  }

  // 4. Study links (e.g. Google Forms) → check surrounding text for deadline context first
  if (NOTE_URL_PATTERN.test(trimmed)) {
    if (isDeadline && hasDateOrTime) {
      return 'DEADLINE';
    }
    return 'NOTE';
  }

  // 5. Deadline keywords + date/time → DEADLINE
  if (isDeadline && hasDateOrTime) {
    return 'DEADLINE';
  }

  // 6. Official announcements → DEADLINE or NOTE
  if (ANNOUNCEMENT_PATTERN.test(trimmed) || isImportant) {
    return isDeadline || isImportant ? 'DEADLINE' : 'NOTE';
  }

  // 7. Questions/requests → QUESTION
  if (QUESTION_PATTERN.test(trimmed)) {
    return 'QUESTION';
  }

  // 8. Study material, documents, links → NOTE
  if (hasMediaAttachment(msg) || NOTE_PATTERN.test(trimmed)) {
    return 'NOTE';
  }

  return null; // couldn't confidently decide — hand off to the LLM
}

// ---------------------------------------------------------------------------
// STEP 2: LLM fallback (only called for genuinely ambiguous messages)
// ---------------------------------------------------------------------------

async function llmClassify(text) {
  if (!groq) {
    console.warn('[classifier] No GROQ_API_KEY set — defaulting ambiguous message to NOISE');
    return 'NOISE';
  }

  const prompt = `Classify this class group chat message into exactly one word: NOTE, DEADLINE, QUESTION, or NOISE.

- NOTE: shares study material, notes, or resources
- DEADLINE: mentions an assignment, exam, or submission with a time reference
- QUESTION: is genuinely asking something that needs an answer
- NOISE: casual chat, jokes, greetings, anything not academically useful

Message: "${text}"

Reply with only the single category word, nothing else.`;

  try {
    const completion = await groq.chat.completions.create({
      model: 'llama-3.1-8b-instant', // fast + free-tier friendly on Groq
      messages: [{ role: 'user', content: prompt }],
      temperature: 0,
      max_tokens: 5,
    });

    const raw = completion.choices[0]?.message?.content?.trim().toUpperCase();
    const match = CATEGORIES.find((c) => raw?.includes(c));
    return match || 'NOISE';
  } catch (err) {
    console.error('[classifier] LLM call failed, defaulting to NOISE:', err.message);
    return 'NOISE';
  }
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
