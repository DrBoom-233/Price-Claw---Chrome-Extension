# Price Claw Extension Privacy Notes

Price Claw Extension is a bring-your-own-key extraction tool. The extension does not operate a Price Claw backend and does not store extracted price data on a Price Claw server.

## Data Processed

When the user starts extraction, the extension may process:

- Current tab URL and title.
- Page text from `document.body.innerText`.
- Selected HTML snippets used to generate CSS selectors.
- Extracted product and price JSON.

## Data Sharing

The extension sends page text and selected HTML snippets directly to the LLM provider configured by the user, such as OpenAI, Gemini, Claude, DeepSeek, or an OpenAI-compatible API endpoint. It does not capture or send page screenshots. The user's provider receives that data according to the user's own account and provider terms.

## Local Storage

The user's provider, model, base URL, and API key are stored in Chrome local extension storage. Extracted price JSON is shown in the extension UI and exported only when the user clicks `Export JSON`.

## No Price Claw Storage Service

Price Claw Extension does not provide cloud storage for extracted prices, schemas, screenshots, or HTML content.
