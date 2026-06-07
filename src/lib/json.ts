export function stripJsonFences(value: string): string {
  const trimmed = value.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return (fenced ? fenced[1] : trimmed).trim();
}

export function extractJsonText(value: string): string {
  const stripped = stripJsonFences(value);
  if (stripped.startsWith("{") || stripped.startsWith("[")) {
    return stripped;
  }

  const firstArray = stripped.indexOf("[");
  const firstObject = stripped.indexOf("{");
  const start =
    firstArray === -1
      ? firstObject
      : firstObject === -1
        ? firstArray
        : Math.min(firstArray, firstObject);

  if (start === -1) {
    throw new Error("LLM response did not contain JSON");
  }

  const open = stripped[start];
  const close = open === "[" ? "]" : "}";
  const end = stripped.lastIndexOf(close);
  if (end < start) {
    throw new Error("LLM response contained incomplete JSON");
  }

  return stripped.slice(start, end + 1).trim();
}

export function parseJsonResponse<T>(value: string): T {
  return JSON.parse(extractJsonText(value)) as T;
}

export function expectArray(value: unknown, label: string): unknown[] {
  if (!Array.isArray(value)) {
    throw new Error(`${label} must be a JSON array`);
  }
  return value;
}

export function expectObject(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be a JSON object`);
  }
  return value as Record<string, unknown>;
}

