import { createGroq } from '@ai-sdk/groq';
import { config } from '@/lib/config';

let _model: ReturnType<ReturnType<typeof createGroq>> | null = null;

function resolveGroqModelName(): string {
  const configuredModel = config.aiModel.trim();
  if (configuredModel.startsWith('groq/')) {
    return configuredModel.slice('groq/'.length);
  }

  const envGroqModel = process.env.GROQ_MODEL?.trim();
  if (envGroqModel) {
    return envGroqModel;
  }

  // If AI_MODEL is provided without provider prefix, treat it as a Groq model id.
  if (configuredModel.length > 0) {
    return configuredModel;
  }

  return 'llama-3.3-70b-versatile';
}

export function getModel() {
  if (!_model) {
    const groq = createGroq({
      apiKey: process.env.GROQ_API_KEY,
    });
    _model = groq(resolveGroqModelName());
  }
  return _model;
}

// Lazy proxy — model only initializes on first use, not at import time
export const model = new Proxy({} as ReturnType<typeof getModel>, {
  get(_target, prop, receiver) {
    return Reflect.get(getModel(), prop, receiver);
  },
});
