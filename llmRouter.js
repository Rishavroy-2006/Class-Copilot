require('dotenv').config({ quiet: true });
const Groq = require('groq-sdk');
const { GoogleGenAI } = require('@google/genai');

const groqApiKey = process.env.GROQ_API_KEY;
const geminiApiKey = process.env.GEMINI_API_KEY;

const groq = groqApiKey ? new Groq({ apiKey: groqApiKey }) : null;
const ai = geminiApiKey ? new GoogleGenAI({ apiKey: geminiApiKey }) : null;

/**
 * Check text using Prompt Guard (Groq) or return safe default
 */
async function checkPromptGuard(text) {
  if (!groq) return { isTroll: false, score: 0 };

  try {
    const shieldCheck = await groq.chat.completions.create({
      model: 'meta-llama/llama-prompt-guard-2-86m',
      messages: [{ role: 'user', content: text }],
      temperature: 0,
      max_tokens: 10
    });

    const scoreText = shieldCheck.choices[0]?.message?.content;
    const probability = parseFloat(scoreText);
    const isTroll = !isNaN(probability) && probability > 0.9;
    return { isTroll, score: probability || 0 };
  } catch (err) {
    console.error('[llmRouter] Prompt Guard check failed:', err.message);
    return { isTroll: false, score: 0 };
  }
}

async function callGemini(contents, config = {}) {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3.5-flash-lite',
      contents,
      config
    });
    return response;
  } catch (err) {
    console.warn(`[llmRouter] Gemini 3.5 failed (${err.message}). Falling back to Gemini 3.1 Flash Lite...`);
    const fallbackResponse = await ai.models.generateContent({
      model: 'gemini-3.1-flash-lite',
      contents,
      config
    });
    return fallbackResponse;
  }
}

/**
 * Fast JSON extraction (subject, deadline dates)
 * Primary: Groq llama-3.1-8b-instant
 * Fallback: Gemini Flash Lite
 */
async function fastExtractJson(prompt) {
  if (groq) {
    try {
      const completion = await groq.chat.completions.create({
        model: 'llama-3.1-8b-instant',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0,
        response_format: { type: "json_object" }
      });
      return JSON.parse(completion.choices[0]?.message?.content);
    } catch (err) {
      console.warn('[llmRouter] Groq 8B JSON extraction failed, trying Gemini fallback...', err.message);
    }
  }

  if (ai) {
    try {
      const response = await callGemini(prompt + '\nReturn ONLY a valid JSON object.', { responseMimeType: 'application/json' });
      return JSON.parse(response.text);
    } catch (err) {
      console.error('[llmRouter] Gemini JSON extraction failed:', err.message);
    }
  }

  throw new Error('No available LLM provider succeeded for JSON extraction.');
}

/**
 * RAG Question Answering
 * Priority Logic:
 * - If contextLength > 4000 OR Groq unavailable -> Try Gemini Flash Lite first (huge context window)
 * - Otherwise -> Try Groq openai/gpt-oss-120b first
 * - Automatic Failover on error/rate limit
 */
async function generateAnswer(prompt, contextLength = 0) {
  const preferGemini = contextLength > 4000 || !groq;

  if (preferGemini && ai) {
    console.log(`[llmRouter] Routing to Gemini (Context Length: ${contextLength})`);
    try {
      const response = await callGemini(prompt);
      return response.text;
    } catch (err) {
      console.warn('[llmRouter] Gemini failed entirely, attempting failover to Groq 120B...', err.message);
      if (groq) return await callGroq120B(prompt);
      throw err;
    }
  }

  if (groq) {
    console.log(`[llmRouter] Routing to Groq 120B (Context Length: ${contextLength})`);
    try {
      return await callGroq120B(prompt);
    } catch (err) {
      console.warn('[llmRouter] Groq 120B failed/rate-limited, attempting failover to Gemini...', err.message);
      if (ai) {
        const response = await callGemini(prompt);
        return response.text;
      }
      throw err;
    }
  }

  throw new Error('No LLM provider available.');
}

/**
 * Text embedding for pgvector storage/search.
 * Uses Gemini's embedding model (free tier). Returns a 768-dim vector,
 * or null if no Gemini key is configured / the call fails — callers must
 * degrade gracefully (e.g. fall back to recency-based context).
 */
const EMBEDDING_MODEL = 'gemini-embedding-001';
const EMBEDDING_DIMS = 768;

async function embedText(text) {
  if (!ai) return null;

  try {
    const response = await ai.models.embedContent({
      model: EMBEDDING_MODEL,
      contents: text.substring(0, 8000), // stay well under the embedding token limit
      config: { outputDimensionality: EMBEDDING_DIMS },
    });
    return response.embeddings?.[0]?.values || null;
  } catch (err) {
    console.error('[llmRouter] Embedding failed:', err.message);
    return null;
  }
}

async function callGroq120B(prompt) {
  const completion = await groq.chat.completions.create({
    model: 'openai/gpt-oss-120b',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.1,
    max_tokens: 400
  });
  return completion.choices[0]?.message?.content;
}

async function callGroq120BJson(prompt) {
  const completion = await groq.chat.completions.create({
    model: 'openai/gpt-oss-120b',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.1,
    max_tokens: 1000,
    response_format: { type: "json_object" }
  });
  return completion.choices[0]?.message?.content;
}

/**
 * Predict PYQ Json
 * Mirrors the generateAnswer failover architecture for robust JSON extraction.
 */
async function generatePredictionJson(prompt, contextLength = 0) {
  const preferGemini = contextLength > 4000 || !groq;

  if (preferGemini && ai) {
    console.log(`[llmRouter] Routing PYQ Prediction to Gemini (Context Length: ${contextLength})`);
    try {
      const response = await callGemini(prompt, { responseMimeType: 'application/json' });
      return JSON.parse(response.text);
    } catch (err) {
      console.warn('[llmRouter] Gemini prediction failed entirely, attempting failover to Groq 120B...', err.message);
      if (groq) {
        const text = await callGroq120BJson(prompt);
        return JSON.parse(text);
      }
      throw err;
    }
  }

  if (groq) {
    console.log(`[llmRouter] Routing PYQ Prediction to Groq 120B (Context Length: ${contextLength})`);
    try {
      const text = await callGroq120BJson(prompt);
      return JSON.parse(text);
    } catch (err) {
      console.warn('[llmRouter] Groq 120B prediction failed/rate-limited, attempting failover to Gemini...', err.message);
      if (ai) {
        const response = await callGemini(prompt, { responseMimeType: 'application/json' });
        return JSON.parse(response.text);
      }
      throw err;
    }
  }

  throw new Error('No LLM provider available.');
}

/**
 * Summarize raw text into bullet points
 */
async function generateSummary(text) {
  const prompt = `You are a helpful academic assistant. Please summarize the following text into concise, well-structured bullet points. Extract only the most important information and key takeaways.
  
Text to summarize:
${text}

Reply ONLY with the bullet points.`;

  if (groq) {
    try {
      return await callGroq120B(prompt);
    } catch (err) {
      console.warn('[llmRouter] Groq summary failed, falling back to Gemini:', err.message);
    }
  }

  // Fallback to Gemini
  if (ai) {
    try {
      return await callGemini(prompt);
    } catch (err) {
      console.error('[llmRouter] Gemini summary failed:', err.message);
    }
  }

  return 'Sorry, I am currently unable to generate a summary due to an API error.';
}

module.exports = {
  checkPromptGuard,
  fastExtractJson,
  generateAnswer,
  embedText,
  generateSummary,
  generatePredictionJson
};
