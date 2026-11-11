import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const isGroq = Boolean(process.env.GROQ_API_KEY);
const isGemini = Boolean(process.env.GEMINI_API_KEY) && !isGroq;

function resolveProvider() {
  if (isGroq) return 'groq';
  if (isGemini) return 'gemini';
  return process.env.LLM_PROVIDER || 'openai';
}

function resolveApiKey() {
  if (process.env.GROQ_API_KEY) return process.env.GROQ_API_KEY;
  if (process.env.GEMINI_API_KEY) return process.env.GEMINI_API_KEY;
  return process.env.OPENAI_API_KEY || '';
}

function resolveModel() {
  if (process.env.GROQ_API_KEY) return process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';
  if (process.env.GEMINI_API_KEY) return process.env.GEMINI_MODEL || 'gemini-1.5-flash-latest';
  return process.env.OPENAI_MODEL || 'gpt-4o-mini';
}

function resolveBaseUrl() {
  if (process.env.GROQ_API_KEY) return 'https://api.groq.com/openai/v1';
  if (process.env.GEMINI_API_KEY) return 'https://generativelanguage.googleapis.com/v1beta/openai/';
  return process.env.OPENAI_BASE_URL || undefined;
}

export const config = {
  port: parseInt(process.env.PORT || '5000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  databaseUrl: process.env.DATABASE_URL || '',
  clientOrigin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
  llm: {
    provider: resolveProvider(),
    apiKey: resolveApiKey(),
    model: resolveModel(),
    baseURL: resolveBaseUrl(),
    timeoutMs: parseInt(process.env.LLM_TIMEOUT_MS || process.env.OPENAI_TIMEOUT_MS || '30000', 10),
  },
  // Backward compatibility alias
  openai: {
    apiKey: resolveApiKey(),
    model: resolveModel(),
    timeoutMs: parseInt(process.env.OPENAI_TIMEOUT_MS || '30000', 10),
  },
  tavily: {
    apiKey: process.env.TAVILY_API_KEY || '',
    maxResults: parseInt(process.env.TAVILY_MAX_RESULTS || '5', 10),
    timeoutMs: parseInt(process.env.TAVILY_TIMEOUT_MS || '15000', 10),
  },
};
