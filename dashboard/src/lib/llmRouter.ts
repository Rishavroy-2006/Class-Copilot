import Groq from 'groq-sdk';
import { GoogleGenAI } from '@google/genai';
import fs from 'fs';
import path from 'path';

function getEnv(key: string) {
  if (process.env[key]) return process.env[key];
  try {
    const envPath = path.resolve(process.cwd(), '../.env');
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, 'utf-8');
      const match = content.match(new RegExp(`^${key}=(.*)$`, 'm'));
      if (match) return match[1].trim();
    }
  } catch (e) {}
  return undefined;
}

const groqApiKey = getEnv('GROQ_API_KEY');
const geminiApiKey = getEnv('GEMINI_API_KEY');

const groq = groqApiKey ? new Groq({ apiKey: groqApiKey }) : null;
const ai = geminiApiKey ? new GoogleGenAI({ apiKey: geminiApiKey }) : null;

async function callGemini(contents: string, config: any = {}) {
  if (!ai) throw new Error('Gemini API key not configured');
  const models = [
    'gemini-3.5-flash',
    'gemini-3.5-flash-lite',
  ];

  let lastError;
  for (const model of models) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents,
        config
      });
      return response.text;
    } catch (err: any) {
      console.warn(`[local-llmRouter] Gemini model ${model} failed: ${err.message}`);
      lastError = err;
    }
  }
  throw new Error(`All Gemini models failed. Last error: ${lastError?.message}`);
}

async function callGroq(prompt: string, expectJson: boolean = false) {
  if (!groq) throw new Error('Groq API key not configured');
  const completion = await groq.chat.completions.create({
    model: 'openai/gpt-oss-120b',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.1,
    max_tokens: 1000,
    ...(expectJson ? { response_format: { type: "json_object" } } : {})
  });
  return completion.choices[0]?.message?.content;
}

export async function generateAnswer(prompt: string, expectJson: boolean = false) {
  if (groq) {
    try {
      console.log(`[local-llmRouter] Routing to Groq`);
      return await callGroq(prompt, expectJson);
    } catch (err: any) {
      console.warn('[local-llmRouter] Groq failed/rate-limited, attempting failover to Gemini...', err.message);
      if (ai) {
        return await callGemini(prompt, expectJson ? { responseMimeType: 'application/json' } : {});
      }
      throw err;
    }
  } else if (ai) {
    console.log(`[local-llmRouter] Routing to Gemini`);
    return await callGemini(prompt, expectJson ? { responseMimeType: 'application/json' } : {});
  }

  throw new Error('No LLM provider available.');
}
