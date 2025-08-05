import { GoogleGenAI } from "@google/genai";
import { logService } from "../logService";

const POLLING_INTERVAL_MS = 2000; // 2 seconds
const MAX_POLLING_DURATION_MS = 10 * 60 * 1000; // 10 minutes

export { POLLING_INTERVAL_MS, MAX_POLLING_DURATION_MS };

export const getClient = (apiKey: string): GoogleGenAI => {
  try {
      // Sanitize the API key to replace common non-ASCII characters that might
      // be introduced by copy-pasting from rich text editors. This prevents
      // "Failed to execute 'append' on 'Headers': Invalid character" errors.
      const sanitizedApiKey = apiKey
          .replace(/[\u2013\u2014]/g, '-') // en-dash, em-dash to hyphen
          .replace(/[\u2018\u2019]/g, "'") // smart single quotes to apostrophe
          .replace(/[\u201C\u201D]/g, '"') // smart double quotes to quote
          .replace(/[\u00A0]/g, ' '); // non-breaking space to regular space
          
      if (apiKey !== sanitizedApiKey) {
          logService.warn("API key was sanitized. Non-ASCII characters were replaced.");
      }
      return new GoogleGenAI({ apiKey: sanitizedApiKey });
  } catch (error) {
      logService.error("Failed to initialize GoogleGenAI client:", error);
      // Re-throw to be caught by the calling function
      throw error;
  }
};

export const getApiClient = (apiKey?: string | null): GoogleGenAI => {
    if (!apiKey) {
        const silentError = new Error("API key is not configured in settings or provided.");
        silentError.name = "SilentError";
        throw silentError;
    }
    return getClient(apiKey);
};

export const buildGenerationConfig = (
    modelId: string,
    systemInstruction: string,
    config: { temperature?: number; topP?: number },
    showThoughts: boolean,
    thinkingBudget: number,
    isGoogleSearchEnabled?: boolean,
    isCodeExecutionEnabled?: boolean,
    isUrlContextEnabled?: boolean,
): any => {
    const generationConfig: any = {
        ...config,
        systemInstruction: systemInstruction || undefined,
    };
    if (!generationConfig.systemInstruction) {
        delete generationConfig.systemInstruction;
    }

    const modelSupportsThinking = [
        'gemini-2.5-flash-lite',
        'gemini-2.5-pro',
        'gemini-2.5-flash'
    ].includes(modelId);

    if (modelSupportsThinking) {
        if (showThoughts) {
            generationConfig.thinkingConfig = {
                thinkingBudget: thinkingBudget,
                includeThoughts: true,
            };
        } else {
            generationConfig.thinkingConfig = { thinkingBudget: 0 };
        }
    }

    const tools = [];
    if (isGoogleSearchEnabled) {
        tools.push({ googleSearch: {} });
    }
    if (isCodeExecutionEnabled) {
        tools.push({ codeExecution: {} });
    }
    if (isUrlContextEnabled) {
        tools.push({ urlContext: {} });
    }

    if (tools.length > 0) {
        generationConfig.tools = tools;
        // When using tools, these should not be set
        delete generationConfig.responseMimeType;
        delete generationConfig.responseSchema;
    }
    
    return generationConfig;
};