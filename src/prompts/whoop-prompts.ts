import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

const TimezoneArg = z.string().default("UTC").describe("IANA timezone for interpreting daily/weekly summaries.");

function userPrompt(text: string) {
  return {
    messages: [{
      role: "user" as const,
      content: { type: "text" as const, text }
    }]
  };
}

export function registerWhoopPrompts(server: McpServer): void {
  server.registerPrompt(
    "whoop_daily_performance_coach",
    {
      title: "WHOOP Daily Performance Coach",
      description: "Use WHOOP data to produce a practical, non-medical daily plan for training, recovery and focus.",
      argsSchema: { timezone: TimezoneArg }
    },
    ({ timezone }) => userPrompt(`Call whoop_daily_summary with timezone=${timezone || "UTC"} and response_format=json. Use the result to produce a concise daily operating brief.

Requirements:
- Do not provide medical diagnosis or treatment advice.
- Lead with the main readiness signal.
- Explain recovery, sleep and load using only returned metrics.
- Give 3-5 concrete actions for training, recovery, sleep and cognitive focus today.
- If data_quality.confidence is low, say what is missing and avoid strong claims.`)
  );

  server.registerPrompt(
    "whoop_weekly_training_review",
    {
      title: "WHOOP Weekly Training Review",
      description: "Use WHOOP weekly summary data to create a practical next-week training, sleep and focus plan.",
      argsSchema: { timezone: TimezoneArg }
    },
    ({ timezone }) => userPrompt(`Call whoop_weekly_summary with timezone=${timezone || "UTC"}, days=7, compare_days=7 and response_format=json. Use the result to produce a weekly performance review.

Requirements:
- Do not provide medical diagnosis or treatment advice.
- Compare current vs prior window only where data exists.
- Identify the top 1-3 bottlenecks.
- Create a next-week plan with training rules for green/yellow/red readiness, sleep protocol, recovery protocol and deep-work placement.
- Include 3-5 measurable success metrics for next week.`)
  );

  server.registerPrompt(
    "whoop_sleep_recovery_investigator",
    {
      title: "WHOOP Sleep Recovery Investigator",
      description: "Investigate sleep consistency, sleep debt and recovery signals from WHOOP summaries.",
      argsSchema: { timezone: TimezoneArg }
    },
    ({ timezone }) => userPrompt(`Call whoop_weekly_summary with timezone=${timezone || "UTC"} and response_format=json. Focus only on sleep/recovery relationships.

Return:
- main sleep bottleneck
- recovery signals affected by sleep
- 7-day sleep experiment
- what metrics to check next week

Use cautious hypothesis language. Do not provide medical advice.`)
  );
}
