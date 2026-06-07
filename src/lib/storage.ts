import type { RuntimeSettings, RuntimeSettingsView, UiPreferences } from "../types";

const SETTINGS_KEY = "priceClawSettings";
const UI_PREFERENCES_KEY = "priceClawUiPreferences";

const DEFAULT_SETTINGS: RuntimeSettings = {
  provider: "openai",
  apiKey: "",
  model: "gpt-4o-mini",
  baseUrl: ""
};

const DEFAULT_UI_PREFERENCES: UiPreferences = {
  scale: 1,
  windowWidth: 720,
  windowHeight: 760
};

function storageGet(keys: string[] | string | null): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get(keys, (items) => {
      const error = chrome.runtime.lastError;
      if (error?.message) {
        reject(new Error(error.message));
        return;
      }
      resolve(items);
    });
  });
}

function storageSet(items: Record<string, unknown>): Promise<void> {
  return new Promise((resolve, reject) => {
    chrome.storage.local.set(items, () => {
      const error = chrome.runtime.lastError;
      if (error?.message) {
        reject(new Error(error.message));
        return;
      }
      resolve();
    });
  });
}

export async function getStoredSettings(): Promise<RuntimeSettings> {
  const items = await storageGet(SETTINGS_KEY);
  const saved = items[SETTINGS_KEY] as Partial<RuntimeSettings> | undefined;
  return {
    ...DEFAULT_SETTINGS,
    ...(saved || {}),
    provider: saved?.provider || DEFAULT_SETTINGS.provider,
    apiKey: saved?.apiKey || "",
    model: saved?.model || DEFAULT_SETTINGS.model,
    baseUrl: saved?.baseUrl || ""
  };
}

export async function getSettingsView(): Promise<RuntimeSettingsView> {
  const settings = await getStoredSettings();
  return {
    provider: settings.provider,
    model: settings.model,
    baseUrl: settings.baseUrl,
    apiKeyConfigured: Boolean(settings.apiKey)
  };
}

export async function saveSettingsFromForm(next: Partial<RuntimeSettings>): Promise<RuntimeSettingsView> {
  const current = await getStoredSettings();
  const merged: RuntimeSettings = {
    ...current,
    ...next,
    apiKey: next.apiKey?.trim() || current.apiKey,
    model: next.model?.trim() || current.model,
    baseUrl: next.baseUrl?.trim() || ""
  };
  await storageSet({ [SETTINGS_KEY]: merged });
  return getSettingsView();
}

export async function getUiPreferences(): Promise<UiPreferences> {
  const items = await storageGet(UI_PREFERENCES_KEY);
  const saved = items[UI_PREFERENCES_KEY] as Partial<UiPreferences> | undefined;
  return {
    scale: saved?.scale || DEFAULT_UI_PREFERENCES.scale,
    windowWidth: saved?.windowWidth || DEFAULT_UI_PREFERENCES.windowWidth,
    windowHeight: saved?.windowHeight || DEFAULT_UI_PREFERENCES.windowHeight
  };
}

export async function saveUiPreferences(next: Partial<UiPreferences>): Promise<UiPreferences> {
  const current = await getUiPreferences();
  const merged: UiPreferences = {
    ...current,
    ...next
  };
  await storageSet({ [UI_PREFERENCES_KEY]: merged });
  return merged;
}

export function validateRunnableSettings(settings: RuntimeSettings): void {
  if (!settings.apiKey.trim()) {
    throw new Error("LLM API key is not configured. Open Settings and save your own key first.");
  }
  if (!settings.model.trim()) {
    throw new Error("LLM model is required.");
  }
}
