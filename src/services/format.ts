import type { ResponseFormat, ToolResponse } from "../types.js";

export function makeResponse<T>(data: T, format: ResponseFormat, markdown: string): ToolResponse<T> {
  return {
    content: [{ type: "text", text: format === "json" ? JSON.stringify(data, null, 2) : markdown }],
    structuredContent: data
  };
}

export function makeError(message: string): ToolResponse<{ error: string }> {
  return {
    isError: true,
    content: [{ type: "text", text: `Error: ${message}` }],
    structuredContent: { error: message }
  };
}

export function bulletList(title: string, fields: Record<string, unknown>): string {
  const lines = [`# ${title}`, ""];
  for (const [key, value] of Object.entries(fields)) {
    if (value === undefined || value === null) continue;
    lines.push(`- **${key}**: ${String(value)}`);
  }
  return lines.join("\n");
}

export function formatCollection(title: string, records: unknown[], meta: Record<string, unknown>): string {
  const lines = [`# ${title}`, "", ...Object.entries(meta).map(([k, v]) => `- **${k}**: ${String(v)}`), ""];
  const preview = records.slice(0, 8);
  for (const [index, record] of preview.entries()) {
    if (record && typeof record === "object") {
      const object = record as Record<string, unknown>;
      const id = object.id ?? object.sleep_id ?? object.cycle_id ?? `item-${index + 1}`;
      const start = object.start ?? object.created_at ?? object.updated_at ?? "n/a";
      const state = object.score_state ?? "n/a";
      lines.push(`## ${String(id)}`);
      lines.push(`- **start/created**: ${String(start)}`);
      lines.push(`- **score_state**: ${String(state)}`);
      if (object.score && typeof object.score === "object") {
        lines.push(`- **score**: ${JSON.stringify(object.score)}`);
      }
      lines.push("");
    } else {
      lines.push(`- ${JSON.stringify(record)}`);
    }
  }
  if (records.length > preview.length) lines.push(`... ${records.length - preview.length} more records omitted from markdown preview.`);
  return lines.join("\n");
}
