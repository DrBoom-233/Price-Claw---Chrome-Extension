import type { SelectorConfig } from "../types";

export function normalizeSelectorConfig(value: unknown): SelectorConfig {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Selector response must be a JSON object");
  }
  const record = value as Record<string, unknown>;
  const container = String(record.container_selector || "").trim();
  const fields = Array.isArray(record.expected_fields) ? record.expected_fields : [];
  const expectedFields = fields
    .map((field) => {
      const item = field as Record<string, unknown>;
      return {
        name: String(item.name || "").trim(),
        selector: String(item.selector || "").trim()
      };
    })
    .filter((field) => field.name && field.selector);

  if (!container) {
    throw new Error("Selector response is missing container_selector");
  }
  if (expectedFields.length === 0) {
    throw new Error("Selector response is missing expected_fields");
  }

  return {
    website_type: typeof record.website_type === "string" ? record.website_type : undefined,
    description: typeof record.description === "string" ? record.description : undefined,
    container_selector: container,
    expected_fields: expectedFields
  };
}

export function pairFieldValues(fieldValues: Record<string, string[]>): Record<string, string>[] {
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

