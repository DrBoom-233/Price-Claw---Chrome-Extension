import { FormEvent, useEffect, useState } from "react";
import type { LlmProvider, RuntimeSettings, RuntimeSettingsView } from "../types";
import { getSettingsView, saveSettingsFromForm } from "../lib/storage";

const PROVIDERS: Array<{ value: LlmProvider; label: string; defaultModel: string; placeholder: string }> = [
  { value: "openai", label: "OpenAI", defaultModel: "gpt-4o-mini", placeholder: "https://api.openai.com/v1" },
  { value: "gemini", label: "Gemini", defaultModel: "gemini-1.5-flash", placeholder: "https://generativelanguage.googleapis.com/v1beta" },
  { value: "claude", label: "Claude", defaultModel: "claude-3-5-sonnet-latest", placeholder: "https://api.anthropic.com" },
  { value: "deepseek", label: "DeepSeek", defaultModel: "deepseek-chat", placeholder: "https://api.deepseek.com" },
  { value: "openai_compatible", label: "OpenAI-compatible", defaultModel: "gpt-4o-mini", placeholder: "https://api.example.com/v1" }
];

interface SettingsFormProps {
  compact?: boolean;
  onSaved?: (view: RuntimeSettingsView) => void;
}

export function SettingsForm({ compact = false, onSaved }: SettingsFormProps) {
  const [provider, setProvider] = useState<LlmProvider>("openai");
  const [model, setModel] = useState("gpt-4o-mini");
  const [baseUrl, setBaseUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [apiKeyConfigured, setApiKeyConfigured] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    getSettingsView()
      .then((settings) => {
        setProvider(settings.provider);
        setModel(settings.model);
        setBaseUrl(settings.baseUrl);
        setApiKeyConfigured(settings.apiKeyConfigured);
      })
      .catch((err) => setError(err instanceof Error ? err.message : String(err)));
  }, []);

  const selected = PROVIDERS.find((item) => item.value === provider) || PROVIDERS[0];

  function handleProviderChange(nextProvider: LlmProvider) {
    const next = PROVIDERS.find((item) => item.value === nextProvider) || PROVIDERS[0];
    setProvider(nextProvider);
    setModel(next.defaultModel);
    setBaseUrl("");
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setStatus("");
    setError("");
    try {
      const view = await saveSettingsFromForm({
        provider,
        model,
        baseUrl,
        apiKey
      } satisfies Partial<RuntimeSettings>);
      setApiKey("");
      setApiKeyConfigured(view.apiKeyConfigured);
      setStatus("Settings saved locally.");
      onSaved?.(view);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <form className="form-grid" onSubmit={handleSubmit}>
      <div className="field">
        <label htmlFor="provider">Provider</label>
        <select id="provider" value={provider} onChange={(event) => handleProviderChange(event.target.value as LlmProvider)}>
          {PROVIDERS.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </select>
      </div>
      <div className="field">
        <label htmlFor="model">Model</label>
        <input id="model" value={model} onChange={(event) => setModel(event.target.value)} />
      </div>
      <div className="field">
        <label htmlFor="baseUrl">Base URL</label>
        <input
          id="baseUrl"
          value={baseUrl}
          placeholder={selected.placeholder}
          onChange={(event) => setBaseUrl(event.target.value)}
        />
      </div>
      <div className="field">
        <label htmlFor="apiKey">API Key</label>
        <input
          id="apiKey"
          type="password"
          value={apiKey}
          placeholder={apiKeyConfigured ? "Saved locally; leave blank to keep" : "Paste your API key"}
          onChange={(event) => setApiKey(event.target.value)}
        />
      </div>
      <div className="button-row">
        <button type="submit">Save Settings</button>
        {apiKeyConfigured ? <span className="status success">API key configured</span> : <span className="status">No key saved</span>}
      </div>
      {status ? <div className="status success">{status}</div> : null}
      {error ? <div className="status error">{error}</div> : null}
      {!compact ? (
        <p className="privacy-note">
          Settings stay in Chrome local extension storage. During extraction, page text and matched HTML snippets are sent directly to the LLM provider you configure.
        </p>
      ) : null}
    </form>
  );
}
