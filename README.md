# Price Claw Chrome Extension

## Temporary Installation Guide

Price Claw is currently waiting for Google Chrome Web Store developer account approval. Until the store listing is available, install it as an unpacked Chrome extension.

### 1. Download The Extension

1. Click `Code` on the GitHub repository page.
2. Click `Download ZIP`.
3. Unzip the downloaded file.

The repository already includes the built `dist/` folder. Regular users do
not need Node.js or npm.

### 2. Load It In Chrome

1. Open Chrome.
2. Go to `chrome://extensions`.
3. Turn on `Developer mode` in the top-right corner.
4. Click `Load unpacked`.
5. Select the `dist/` folder inside the unzipped repository.
6. Pin `Price Claw` from the Chrome extensions menu if you want quick access.

When a new version is released, download and unzip the repository again, then
load the new `dist/` folder or click the reload button on the Price Claw card.

### 3. Configure Your LLM API Key

1. Click the Price Claw extension icon.
2. Click `Settings`.
3. Choose your LLM provider.
4. Enter your own API key and model.
5. Save the settings.

The API key is stored locally in Chrome extension storage. It is not stored on a Price Claw server.

### 4. Extract Price Data

1. Open a product or shopping page.
2. Click the Price Claw extension icon.
3. Click `Extract Current Page`.
4. Review the generated JSON.
5. Click `Export JSON` to save the result locally.

If the popup feels too small, click `Resize Window` to open a resizable workspace window. You can also change the UI scale from 80% to 150%.

This is the local-only, BYOK Chrome extension version of Price Claw. It does not use the existing Electron, FastAPI, Playwright, Tesseract, MongoDB, or Mongo Inspector runtime.

## What It Does

- Runs as a Manifest V3 Chrome extension.
- Processes only the current active tab after the user clicks `Extract Current Page`.
- Reads `document.body.innerText` from the current page.
- Sends page text to generate string matching keys, then sends only matched HTML snippets to generate CSS selectors.
- Generates string matching keys, locates related DOM blocks, asks the LLM for CSS selectors, executes those selectors locally, and exports JSON.
- Opens a resizable workspace window from the toolbar popup and remembers its last size.
- Scales the full interface from 80% to 150%, with the selected scale stored locally.

## What It Does Not Do

- It does not provide a Price Claw cloud backend.
- It does not store price data on any Price Claw service.
- It does not run Playwright in the extension.
- It does not perform OCR with Tesseract.
- It does not preserve extraction history by default.

## Development

```powershell
npm install
npm run typecheck
npm test
npm run build
```

Commit the regenerated `dist/` folder whenever source changes are released so
the GitHub ZIP remains ready to load in Chrome.

## Chrome Web Store Notes

The extension uses these permissions:

- `activeTab`: access the current tab only after user action.
- `scripting`: inject the packaged content script into the active tab.
- `storage`: store the user's LLM settings locally.
- `downloads`: export JSON result files.

The extension declares host permissions for supported LLM APIs. The user must provide their own API key. Page text and matched HTML snippets are sent directly to the selected LLM provider.
