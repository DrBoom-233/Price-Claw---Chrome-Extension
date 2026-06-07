import { useEffect, useMemo, useState } from "react";
import type { ExtractionResult, ProgressMessage, RuntimeSettingsView } from "../types";
import { getSettingsView, getUiPreferences, saveUiPreferences } from "../lib/storage";
import { SettingsForm } from "./SettingsForm";
import "./styles.css";

const DEFAULT_REQUEST = "Extract product names and prices from this page.";

interface AppProps {
  surface: "popup" | "sidepanel" | "options" | "window";
}

interface RuntimeResponse<T> {
  ok?: boolean;
  data?: T;
  error?: string;
}

interface LogLine {
  level: ProgressMessage["level"];
  text: string;
}

function sendRuntimeMessage<T>(message: unknown): Promise<T> {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(message, (response) => {
      const error = chrome.runtime.lastError;
      if (error?.message) {
        reject(new Error(error.message));
        return;
      }
      const payload = response as RuntimeResponse<T>;
      if (!payload?.ok) {
        reject(new Error(payload?.error || "No response from extension service worker"));
        return;
      }
      resolve(payload.data as T);
    });
  });
}

function downloadJson(result: ExtractionResult): Promise<void> {
  const blob = new Blob([JSON.stringify(result, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const host = (() => {
    try {
      return new URL(result.url).hostname.replace(/[^a-z0-9.-]/gi, "_");
    } catch {
      return "page";
    }
  })();
  const filename = `price-claw-${host}-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;

  return new Promise((resolve, reject) => {
    chrome.downloads.download({ url, filename, saveAs: true }, () => {
      const error = chrome.runtime.lastError;
      URL.revokeObjectURL(url);
      if (error?.message) {
        reject(new Error(error.message));
        return;
      }
      resolve();
    });
  });
}

export function App({ surface }: AppProps) {
  const [request, setRequest] = useState(DEFAULT_REQUEST);
  const [settingsView, setSettingsView] = useState<RuntimeSettingsView | null>(null);
  const [logs, setLogs] = useState<LogLine[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [result, setResult] = useState<ExtractionResult | null>(null);
  const [error, setError] = useState("");
  const [uiScale, setUiScale] = useState(1);
  const targetTabId = useMemo(() => {
    const value = Number(new URLSearchParams(window.location.search).get("targetTabId"));
    return Number.isInteger(value) && value > 0 ? value : undefined;
  }, []);

  useEffect(() => {
    getSettingsView().then(setSettingsView).catch((err) => setError(err instanceof Error ? err.message : String(err)));
    getUiPreferences()
      .then((preferences) => setUiScale(preferences.scale))
      .catch((err) => setError(err instanceof Error ? err.message : String(err)));
  }, []);

  useEffect(() => {
    document.documentElement.style.zoom = String(uiScale);
    return () => {
      document.documentElement.style.zoom = "";
    };
  }, [uiScale]);

  useEffect(() => {
    if (surface !== "window") {
      return;
    }
    let saveTimer: number | undefined;
    const saveWindowSize = () => {
      window.clearTimeout(saveTimer);
      saveTimer = window.setTimeout(() => {
        void saveUiPreferences({
          windowWidth: Math.max(520, window.outerWidth),
          windowHeight: Math.max(560, window.outerHeight)
        });
      }, 250);
    };
    window.addEventListener("resize", saveWindowSize);
    return () => {
      window.removeEventListener("resize", saveWindowSize);
      window.clearTimeout(saveTimer);
    };
  }, [surface]);

  useEffect(() => {
    const listener = (message: ProgressMessage) => {
      if (message?.type !== "PRICE_CLAW_PROGRESS") {
        return false;
      }
      setLogs((prev) => [...prev, { level: message.level, text: `${message.step}: ${message.message}` }].slice(-80));
      return false;
    };
    chrome.runtime.onMessage.addListener(listener);
    return () => {
      // The minimal local Chrome type only models addListener; Chrome removes this listener on view unload.
    };
  }, []);

  const resultPreview = useMemo(() => (result ? JSON.stringify(result, null, 2) : ""), [result]);
  const isOptions = surface === "options";

  async function handleExtract() {
    setIsRunning(true);
    setError("");
    setResult(null);
    setLogs([{ level: "info", text: "start: Starting current page extraction" }]);
    try {
      const extractionResult = await sendRuntimeMessage<ExtractionResult>({
        type: "START_EXTRACTION",
        extractionRequest: request,
        targetTabId
      });
      setResult(extractionResult);
      setLogs((prev) => [...prev, { level: "success", text: `done: ${extractionResult.items.length} item(s) ready` }]);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      setLogs((prev) => [...prev, { level: "error", text: `failed: ${message}` }]);
    } finally {
      setIsRunning(false);
    }
  }

  async function handleExport() {
    if (!result) {
      return;
    }
    setError("");
    try {
      await downloadJson(result);
      setLogs((prev) => [...prev, { level: "success", text: "export: JSON file download started" }]);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function handleScaleChange(nextScale: number) {
    setUiScale(nextScale);
    try {
      await saveUiPreferences({ scale: nextScale });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function handleOpenWorkspace() {
    setError("");
    try {
      await sendRuntimeMessage<void>({ type: "OPEN_WORKSPACE" });
      if (surface === "popup") {
        window.close();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <main className={`app-shell ${surface}`}>
      <header className="topbar">
        <div className="title-group">
          <h1>Price Claw</h1>
          <p>Current-page price extraction with your own LLM key.</p>
        </div>
        <div className="view-controls">
          <label className="scale-control">
            <span>UI</span>
            <select value={uiScale} onChange={(event) => void handleScaleChange(Number(event.target.value))}>
              <option value={0.8}>80%</option>
              <option value={0.9}>90%</option>
              <option value={1}>100%</option>
              <option value={1.1}>110%</option>
              <option value={1.25}>125%</option>
              <option value={1.5}>150%</option>
            </select>
          </label>
          {surface !== "window" && !isOptions ? (
            <button className="secondary" type="button" onClick={handleOpenWorkspace}>
              Resize Window
            </button>
          ) : null}
          {!isOptions ? (
            <button className="secondary" type="button" onClick={() => chrome.runtime.openOptionsPage()}>
              Settings
            </button>
          ) : null}
        </div>
      </header>

      {!isOptions ? (
        <section className="panel">
          <h2>Extraction</h2>
          <div className="form-grid">
            <div className="field">
              <label htmlFor="request">Extraction Request</label>
              <textarea id="request" value={request} onChange={(event) => setRequest(event.target.value)} disabled={isRunning} />
            </div>
            <div className="button-row">
              <button type="button" onClick={handleExtract} disabled={isRunning || !settingsView?.apiKeyConfigured}>
                {isRunning ? "Extracting..." : "Extract Current Page"}
              </button>
              <button className="secondary" type="button" onClick={handleExport} disabled={!result || isRunning}>
                Export JSON
              </button>
            </div>
            {!settingsView?.apiKeyConfigured ? <div className="status error">Save an API key before extracting.</div> : null}
            {error ? <div className="status error">{error}</div> : null}
          </div>
        </section>
      ) : null}

      <section className="panel">
        <h2>{isOptions ? "Settings" : "Local Settings"}</h2>
        <SettingsForm compact={!isOptions} onSaved={setSettingsView} />
      </section>

      {!isOptions ? (
        <>
          <section className="panel">
            <h2>Progress</h2>
            <div className="log-list">
              {logs.length === 0 ? <div className="status">No extraction has started.</div> : null}
              {logs.map((line, index) => (
                <div className={`log-line ${line.level}`} key={`${line.text}-${index}`}>
                  {line.text}
                </div>
              ))}
            </div>
          </section>

          <section className="panel">
            <h2>Result JSON</h2>
            {result ? <pre className="json-preview">{resultPreview}</pre> : <div className="status">No result yet.</div>}
          </section>
        </>
      ) : null}
    </main>
  );
}
