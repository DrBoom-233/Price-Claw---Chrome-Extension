export type LlmProvider = "openai" | "openai_compatible" | "gemini" | "claude" | "deepseek";

export interface RuntimeSettings {
  provider: LlmProvider;
  apiKey: string;
  model: string;
  baseUrl: string;
}

export interface RuntimeSettingsView extends Omit<RuntimeSettings, "apiKey"> {
  apiKeyConfigured: boolean;
}

export interface UiPreferences {
  scale: number;
  windowWidth: number;
  windowHeight: number;
}

export interface PageContext {
  url: string;
  title: string;
  text: string;
}

export interface MatchKey {
  order?: string;
  item?: string;
  price?: string;
  key?: string;
}

export interface HtmlBlock {
  id: string;
  domPath: string;
  text: string;
  html: string;
}

export interface SelectorField {
  name: string;
  selector: string;
}

export interface SelectorConfig {
  website_type?: string;
  description?: string;
  container_selector: string;
  expected_fields: SelectorField[];
}

export interface SelectorExecutionResult {
  items: Record<string, string>[];
  items_count: number;
  warnings: string[];
}

export interface ExtractionResult {
  url: string;
  title: string;
  extractedAt: string;
  extractionRequest: string;
  matchKeys: MatchKey[];
  selectorConfig: SelectorConfig;
  items: Record<string, string>[];
  diagnostics: {
    htmlBlocks: number;
    warnings: string[];
  };
}

export interface ProgressMessage {
  type: "PRICE_CLAW_PROGRESS";
  level: "info" | "success" | "warning" | "error";
  step: string;
  message: string;
}
