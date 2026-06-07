import type { HtmlBlock, MatchKey, PageContext, SelectorConfig, SelectorExecutionResult } from "../types";
import { dedupeBlocks, rankCandidates, trimHtml, trimText } from "../lib/domMatching";

const SCRIPT_FLAG = "__PRICE_CLAW_CONTENT_SCRIPT__";

declare global {
  interface Window {
    [SCRIPT_FLAG]?: boolean;
  }
}

function isVisible(element: Element): boolean {
  const rect = element.getBoundingClientRect();
  const style = window.getComputedStyle(element);
  return rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden";
}

function domPath(element: Element): string {
  const parts: string[] = [];
  let current: Element | null = element;
  while (current && current !== document.documentElement) {
    const tag = current.tagName.toLowerCase();
    const id = current.id ? `#${current.id}` : "";
    const className = Array.from(current.classList).slice(0, 2).map((name) => `.${CSS.escape(name)}`).join("");
    parts.unshift(`${tag}${id}${className}`);
    current = current.parentElement;
  }
  return `html > ${parts.join(" > ")}`;
}

function elementText(element: Element): string {
  return (element.textContent || "").replace(/\s+/g, " ").trim();
}

function serializeBlock(element: Element, id: string): HtmlBlock {
  return {
    id,
    domPath: domPath(element),
    text: trimText(elementText(element), 1200),
    html: trimHtml(element.outerHTML, 9000)
  };
}

function likelyContainer(element: Element): Element {
  const selectors = [
    "article",
    "li",
    "tr",
    "[class*='product' i]",
    "[class*='item' i]",
    "[class*='card' i]",
    "[data-testid*='product' i]",
    "[data-testid*='item' i]"
  ];
  let current: Element | null = element;
  while (current && current !== document.body) {
    if (selectors.some((selector) => current?.matches(selector))) {
      return current;
    }
    current = current.parentElement;
  }
  return element.parentElement && element.parentElement !== document.body ? element.parentElement : element;
}

function commonAncestor(elements: Element[]): Element | null {
  if (elements.length === 0) {
    return null;
  }
  const paths = elements.map((element) => {
    const path: Element[] = [];
    let current: Element | null = element;
    while (current) {
      path.unshift(current);
      current = current.parentElement;
    }
    return path;
  });
  let ancestor: Element | null = null;
  const maxLength = Math.min(...paths.map((path) => path.length));
  for (let index = 0; index < maxLength; index += 1) {
    const candidate = paths[0][index];
    if (paths.every((path) => path[index] === candidate)) {
      ancestor = candidate;
    } else {
      break;
    }
  }
  if (!ancestor || ancestor === document.documentElement || ancestor === document.body) {
    return null;
  }
  return ancestor;
}

function collectTextCandidates(): Array<{ id: string; text: string; element: Element }> {
  const elements = Array.from(document.body.querySelectorAll("body *"))
    .filter((element) => {
      if (!isVisible(element)) {
        return false;
      }
      const text = elementText(element);
      return text.length >= 2 && text.length <= 600;
    })
    .slice(0, 3000);

  return elements.map((element, index) => ({
    id: `candidate-${index}`,
    text: elementText(element),
    element
  }));
}

function collectCandidateBlocks(limit = 24): HtmlBlock[] {
  const selector = [
    "main article",
    "article",
    "li",
    "tr",
    "[class*='product' i]",
    "[class*='item' i]",
    "[class*='card' i]",
    "[data-testid*='product' i]",
    "[data-testid*='item' i]"
  ].join(",");

  const blocks = Array.from(document.body.querySelectorAll(selector))
    .filter((element) => {
      if (!isVisible(element)) {
        return false;
      }
      const text = elementText(element);
      return text.length >= 20 && text.length <= 2500;
    })
    .slice(0, 120)
    .map((element, index) => serializeBlock(element, `fallback-${index}`));

  return dedupeBlocks(blocks, limit);
}

function capturePageContext(): PageContext {
  const text = trimText(document.body.innerText || "", 30000);
  return {
    url: window.location.href,
    title: document.title,
    text
  };
}

function locateHtmlBlocks(matchKeys: MatchKey[]): HtmlBlock[] {
  const candidates = collectTextCandidates();
  const ranked = rankCandidates(
    candidates.map((candidate) => ({ id: candidate.id, text: candidate.text })),
    matchKeys,
    24
  );
  const matchedElements = ranked
    .map((rankedCandidate) => candidates.find((candidate) => candidate.id === rankedCandidate.id)?.element)
    .filter((element): element is Element => Boolean(element));

  const blocks: HtmlBlock[] = [];
  const ancestor = commonAncestor(matchedElements.slice(0, 6));
  if (ancestor) {
    const children = Array.from(ancestor.children).filter((child) => isVisible(child) && elementText(child).length >= 10);
    const source = children.length >= 2 ? children : [ancestor];
    source.slice(0, 12).forEach((element, index) => blocks.push(serializeBlock(element, `ancestor-${index}`)));
  }

  matchedElements
    .map((element) => likelyContainer(element))
    .forEach((element, index) => blocks.push(serializeBlock(element, `match-${index}`)));

  return dedupeBlocks(blocks.length > 0 ? blocks : collectCandidateBlocks(12), 12);
}

function readText(element: Element | null): string {
  if (!element) {
    return "";
  }
  const text = element.textContent?.replace(/\s+/g, " ").trim();
  if (text) {
    return text;
  }
  return (
    element.getAttribute("aria-label") ||
    element.getAttribute("title") ||
    element.getAttribute("alt") ||
    ""
  ).trim();
}

function pairFieldValues(fieldValues: Record<string, string[]>): Record<string, string>[] {
  const fieldNames = Object.keys(fieldValues);
  const maxLength = Math.max(0, ...fieldNames.map((name) => fieldValues[name]?.length || 0));
  const items: Record<string, string>[] = [];
  for (let index = 0; index < maxLength; index += 1) {
    const item: Record<string, string> = {};
    for (const fieldName of fieldNames) {
      item[fieldName] = fieldValues[fieldName]?.[index] || "";
    }
    if (Object.values(item).some((value) => value.trim())) {
      items.push(item);
    }
  }
  return items;
}

function executeSelectors(config: SelectorConfig): SelectorExecutionResult {
  const warnings: string[] = [];
  let containers: Element[] = [];
  try {
    containers = Array.from(document.querySelectorAll(config.container_selector)).filter(isVisible);
  } catch (error) {
    throw new Error(`Invalid container selector: ${String(error)}`);
  }

  if (containers.length > 0) {
    const items = containers
      .map((container) => {
        const item: Record<string, string> = {};
        for (const field of config.expected_fields) {
          try {
            const target = container.matches(field.selector) ? container : container.querySelector(field.selector);
            item[field.name] = readText(target);
          } catch (error) {
            warnings.push(`Invalid selector for ${field.name}: ${String(error)}`);
            item[field.name] = "";
          }
        }
        return item;
      })
      .filter((item) => Object.values(item).some((value) => value.trim()));

    return { items, items_count: items.length, warnings };
  }

  warnings.push("No containers matched; fields were extracted independently and paired by index.");
  const fieldValues: Record<string, string[]> = {};
  for (const field of config.expected_fields) {
    try {
      fieldValues[field.name] = Array.from(document.querySelectorAll(field.selector)).map(readText).filter(Boolean);
    } catch (error) {
      warnings.push(`Invalid selector for ${field.name}: ${String(error)}`);
      fieldValues[field.name] = [];
    }
  }
  const items = pairFieldValues(fieldValues);
  return { items, items_count: items.length, warnings };
}

if (!window[SCRIPT_FLAG]) {
  window[SCRIPT_FLAG] = true;
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (!message || typeof message !== "object") {
      return false;
    }

    try {
      if (message.type === "CAPTURE_PAGE_CONTEXT") {
        sendResponse({ ok: true, data: capturePageContext() });
        return true;
      }
      if (message.type === "LOCATE_HTML_BLOCKS") {
        sendResponse({ ok: true, data: locateHtmlBlocks(message.matchKeys || []) });
        return true;
      }
      if (message.type === "EXECUTE_SELECTORS") {
        sendResponse({ ok: true, data: executeSelectors(message.selectorConfig) });
        return true;
      }
    } catch (error) {
      sendResponse({ ok: false, error: error instanceof Error ? error.message : String(error) });
      return true;
    }

    return false;
  });
}
