import type { HtmlBlock, MatchKey, RuntimeSettings, SelectorConfig } from "../types";
import { expectArray, parseJsonResponse } from "./json";
import { normalizeSelectorConfig } from "./selectorExecutor";

interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

function openAiBaseUrl(settings: RuntimeSettings): string {
  if (settings.provider === "deepseek") {
    return (settings.baseUrl || "https://api.deepseek.com").replace(/\/$/, "");
  }
  return (settings.baseUrl || "https://api.openai.com/v1").replace(/\/$/, "");
}

async function parseOpenAiResponse(response: Response): Promise<string> {
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.error?.message || `LLM request failed with ${response.status}`);
  }
  return String(data?.choices?.[0]?.message?.content || "").trim();
}

async function sendOpenAiCompatible(settings: RuntimeSettings, messages: ChatMessage[]): Promise<string> {
  const response = await fetch(`${openAiBaseUrl(settings)}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${settings.apiKey}`
    },
    body: JSON.stringify({
      model: settings.model,
      messages,
      temperature: 0.1
    })
  });
  return parseOpenAiResponse(response);
}

async function sendGemini(settings: RuntimeSettings, messages: ChatMessage[]): Promise<string> {
  const baseUrl = (settings.baseUrl || "https://generativelanguage.googleapis.com/v1beta").replace(/\/$/, "");
  const textParts = messages.map((message) => ({
    text: `${message.role.toUpperCase()}:\n${message.content}`
  }));

  const response = await fetch(`${baseUrl}/models/${encodeURIComponent(settings.model)}:generateContent?key=${encodeURIComponent(settings.apiKey)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: textParts }],
      generationConfig: { temperature: 0.1 }
    })
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.error?.message || `Gemini request failed with ${response.status}`);
  }
  return String(data?.candidates?.[0]?.content?.parts?.map((part: { text?: string }) => part.text || "").join("") || "").trim();
}

async function sendClaude(settings: RuntimeSettings, messages: ChatMessage[]): Promise<string> {
  const baseUrl = (settings.baseUrl || "https://api.anthropic.com").replace(/\/$/, "");
  const system = messages
    .filter((message) => message.role === "system")
    .map((message) => message.content)
    .filter(Boolean)
    .join("\n\n");

  const claudeMessages = messages
    .filter((message) => message.role !== "system")
    .map((message) => ({
      role: message.role,
      content: [{ type: "text", text: message.content }]
    }));

  const response = await fetch(`${baseUrl}/v1/messages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": settings.apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true"
    },
    body: JSON.stringify({
      model: settings.model,
      max_tokens: 2048,
      system: system || undefined,
      messages: claudeMessages
    })
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.error?.message || `Claude request failed with ${response.status}`);
  }
  return String(data?.content?.map((part: { text?: string }) => part.text || "").join("") || "").trim();
}

async function sendChat(settings: RuntimeSettings, messages: ChatMessage[]): Promise<string> {
  if (settings.provider === "gemini") {
    return sendGemini(settings, messages);
  }
  if (settings.provider === "claude") {
    return sendClaude(settings, messages);
  }
  return sendOpenAiCompatible(settings, messages);
}

function normalizeMatchKeys(value: unknown): MatchKey[] {
  return expectArray(value, "Match keys")
    .map((item, index) => {
      const record = item && typeof item === "object" ? (item as Record<string, unknown>) : {};
      return {
        order: String(record.order || index + 1),
        item: String(record.item || record.name || record.title || "").trim() || undefined,
        price: String(record.price || record.amount || record.cost || "").trim() || undefined,
        key: String(record.key || record.match_key || record.text || "").trim() || undefined
      };
    })
    .filter((item) => item.item || item.price || item.key);
}

export async function generateMatchKeys(
  settings: RuntimeSettings,
  extractionRequest: string,
  pageText: string
): Promise<MatchKey[]> {
  const prompt = [
    "Return string matching keys that occur exactly in the supplied document.body.innerText and can locate product names or prices in the DOM.",
    "Return only a JSON array. Each object must contain order and at least one of item, price, or key.",
    "Prefer exact product names and exact prices copied from the supplied text. Do not invent or normalize values.",
    `Extraction request: ${extractionRequest}`,
    `document.body.innerText:\n${pageText}`
  ].join("\n\n");

  const responseText = await sendChat(settings, [
    { role: "system", content: "Return strict JSON only. Do not include markdown." },
    { role: "user", content: prompt }
  ]);

  const parsed = parseJsonResponse<unknown>(responseText);
  const keys = normalizeMatchKeys(parsed);
  if (keys.length === 0) {
    throw new Error("LLM returned no usable string matching keys");
  }
  return keys;
}

export async function generateSelectors(
  settings: RuntimeSettings,
  extractionRequest: string,
  blocks: HtmlBlock[]
): Promise<SelectorConfig> {
  const blockText = blocks
    .slice(0, 8)
    .map((block, index) => `HTML block ${index + 1} (${block.domPath}):\n${block.html}`)
    .join("\n\n");

  const prompt = [
    "Analyze these related HTML blocks and generate CSS selectors for product price extraction.",
    "Return only a JSON object with container_selector and expected_fields.",
    "expected_fields must be an array of objects: {\"name\":\"item\",\"selector\":\"...\"}, {\"name\":\"price\",\"selector\":\"...\"}.",
    "Selectors will be executed inside the live current page by a Chrome extension.",
    "Prefer selectors that work within each product container and keep item-price pairing.",
    `Extraction request: ${extractionRequest}`,
    blockText
  ].join("\n\n");

  const responseText = await sendChat(settings, [
    { role: "system", content: "You are a DOM extraction expert. Return strict JSON only." },
    { role: "user", content: prompt }
  ]);

  return normalizeSelectorConfig(parseJsonResponse<unknown>(responseText));
}
