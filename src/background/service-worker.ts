import { generateMatchKeys, generateSelectors } from "../lib/llmClient";
import { getStoredSettings, getUiPreferences, validateRunnableSettings } from "../lib/storage";
import type { ExtractionResult, HtmlBlock, PageContext, ProgressMessage, SelectorExecutionResult } from "../types";

interface StartExtractionMessage {
  type: "START_EXTRACTION";
  extractionRequest: string;
  targetTabId?: number;
}

interface OpenWorkspaceMessage {
  type: "OPEN_WORKSPACE";
}

function runtimeSendMessage(message: unknown): Promise<void> {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(message, () => resolve());
  });
}

function broadcast(level: ProgressMessage["level"], step: string, message: string): void {
  void runtimeSendMessage({ type: "PRICE_CLAW_PROGRESS", level, step, message });
}

function queryActiveTab(): Promise<chrome.tabs.Tab> {
  return new Promise((resolve, reject) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const error = chrome.runtime.lastError;
      if (error?.message) {
        reject(new Error(error.message));
        return;
      }
      const tab = tabs[0];
      if (!tab?.id || tab.windowId === undefined) {
        reject(new Error("No active tab is available."));
        return;
      }
      resolve(tab);
    });
  });
}

function getTab(tabId: number): Promise<chrome.tabs.Tab> {
  return new Promise((resolve, reject) => {
    chrome.tabs.get(tabId, (tab) => {
      const error = chrome.runtime.lastError;
      if (error?.message) {
        reject(new Error(error.message));
        return;
      }
      resolve(tab);
    });
  });
}

function createWorkspaceWindow(url: string, width: number, height: number): Promise<void> {
  return new Promise((resolve, reject) => {
    chrome.windows.create({ url, type: "popup", width, height, focused: true }, () => {
      const error = chrome.runtime.lastError;
      if (error?.message) {
        reject(new Error(error.message));
        return;
      }
      resolve();
    });
  });
}

async function openWorkspace(): Promise<void> {
  const tab = await queryActiveTab();
  assertSupportedTab(tab);
  const preferences = await getUiPreferences();
  const url = chrome.runtime.getURL(`popup.html?surface=window&targetTabId=${tab.id}`);
  await createWorkspaceWindow(url, preferences.windowWidth, preferences.windowHeight);
}

function injectContentScript(tabId: number): Promise<void> {
  return new Promise((resolve, reject) => {
    chrome.scripting.executeScript({ target: { tabId }, files: ["assets/content-script.js"] }, () => {
      const error = chrome.runtime.lastError;
      if (error?.message && !error.message.includes("Cannot access")) {
        reject(new Error(error.message));
        return;
      }
      if (error?.message) {
        reject(new Error(error.message));
        return;
      }
      resolve();
    });
  });
}

function tabMessage<T>(tabId: number, message: unknown): Promise<T> {
  return new Promise((resolve, reject) => {
    chrome.tabs.sendMessage(tabId, message, (response) => {
      const error = chrome.runtime.lastError;
      if (error?.message) {
        reject(new Error(error.message));
        return;
      }
      const payload = response as { ok?: boolean; data?: T; error?: string } | undefined;
      if (!payload?.ok) {
        reject(new Error(payload?.error || "Content script returned an empty response"));
        return;
      }
      resolve(payload.data as T);
    });
  });
}

function assertSupportedTab(tab: chrome.tabs.Tab): void {
  const url = tab.url || "";
  if (!/^https?:\/\//i.test(url)) {
    throw new Error("Price Claw can only extract from http or https pages.");
  }
}

async function runExtraction(message: StartExtractionMessage): Promise<ExtractionResult> {
  const extractionRequest = message.extractionRequest?.trim() || "Extract product names and prices";
  const tab = message.targetTabId ? await getTab(message.targetTabId) : await queryActiveTab();
  assertSupportedTab(tab);
  const tabId = tab.id as number;

  broadcast("info", "settings", "Loading local LLM settings");
  const settings = await getStoredSettings();
  validateRunnableSettings(settings);

  broadcast("info", "capture", "Injecting page collector");
  await injectContentScript(tabId);

  broadcast("info", "capture", "Reading visible page text from document.body.innerText");
  const pageContext = await tabMessage<PageContext>(tabId, { type: "CAPTURE_PAGE_CONTEXT" });

  broadcast("info", "match_keys", "Generating string matching keys from page text");
  const matchKeys = await generateMatchKeys(settings, extractionRequest, pageContext.text);

  broadcast("info", "html_blocks", "Locating matching DOM blocks");
  const htmlBlocks = await tabMessage<HtmlBlock[]>(tabId, { type: "LOCATE_HTML_BLOCKS", matchKeys });
  if (htmlBlocks.length === 0) {
    throw new Error("No related HTML blocks were found for the generated match keys.");
  }

  broadcast("info", "selectors", "Generating CSS selectors from matched HTML blocks");
  const selectorConfig = await generateSelectors(settings, extractionRequest, htmlBlocks);

  broadcast("info", "extract", "Executing CSS selectors on the current page");
  const execution = await tabMessage<SelectorExecutionResult>(tabId, {
    type: "EXECUTE_SELECTORS",
    selectorConfig
  });

  broadcast("success", "complete", `Extracted ${execution.items_count} item(s)`);
  return {
    url: pageContext.url,
    title: pageContext.title,
    extractedAt: new Date().toISOString(),
    extractionRequest,
    matchKeys,
    selectorConfig,
    items: execution.items,
    diagnostics: {
      htmlBlocks: htmlBlocks.length,
      warnings: execution.warnings
    }
  };
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!message || typeof message !== "object") {
    return false;
  }

  const task =
    message.type === "START_EXTRACTION"
      ? runExtraction(message as StartExtractionMessage).then((result) => ({ ok: true, data: result }))
      : message.type === "OPEN_WORKSPACE"
        ? openWorkspace().then(() => ({ ok: true }))
        : null;

  if (!task) {
    return false;
  }

  task
    .then(sendResponse)
    .catch((error) => {
      const messageText = error instanceof Error ? error.message : String(error);
      if (message.type === "START_EXTRACTION") {
        broadcast("error", "failed", messageText);
      }
      sendResponse({ ok: false, error: messageText });
    });

  return true;
});
