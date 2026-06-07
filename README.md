# Price Claw Chrome Extension MVP

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
cd extension
npm install
npm run typecheck
npm test
npm run build
```

Load `extension/dist` as an unpacked extension in Chrome.

## Chrome Web Store Notes

The extension uses these permissions:

- `activeTab`: access the current tab only after user action.
- `scripting`: inject the packaged content script into the active tab.
- `storage`: store the user's LLM settings locally.
- `downloads`: export JSON result files.

The extension declares host permissions for supported LLM APIs. The user must provide their own API key. Page text and matched HTML snippets are sent directly to the selected LLM provider.
