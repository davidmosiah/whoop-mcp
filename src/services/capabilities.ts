export function buildCapabilities() {
  return {
    project: "whoop-mcp-unofficial",
    mcp_name: "io.github.davidmosiah/whoop-mcp",
    creator: {
      name: "David Mosiah",
      github: "https://github.com/davidmosiah"
    },
    unofficial: true,
    api_boundary: {
      source: "Official WHOOP OAuth API",
      raw_definition: "Raw means the full JSON response returned by supported WHOOP API endpoints.",
      does_not_include: [
        "continuous heart-rate samples",
        "second-by-second sensor streams",
        "raw accelerometer or device telemetry",
        "Bluetooth collection"
      ]
    },
    auth_model: {
      type: "OAuth 2.0 authorization code",
      token_storage: "Local token file with user-only permissions",
      recommended_redirect_uri: "http://127.0.0.1:3000/callback",
      default_scopes: [
        "read:recovery",
        "read:cycles",
        "read:workout",
        "read:sleep",
        "read:profile",
        "read:body_measurement"
      ]
    },
    privacy_modes: [
      {
        mode: "summary",
        use_when: "The agent only needs minimal fields for interpretation."
      },
      {
        mode: "structured",
        use_when: "Default mode for normalized agent and analytics workflows."
      },
      {
        mode: "raw",
        use_when: "The user explicitly needs the upstream WHOOP API payload for debugging or deeper analysis."
      }
    ],
    supported_data: [
      {
        name: "Profile and body measurements",
        examples: ["email/name profile when authorized", "height", "weight", "max heart rate"],
        tools: ["whoop_get_profile", "whoop_get_body_measurements"]
      },
      {
        name: "Recovery",
        examples: ["recovery score", "HRV", "resting heart rate", "SpO2", "skin temperature"],
        tools: ["whoop_list_recoveries", "whoop_get_cycle_recovery", "whoop_daily_summary", "whoop_weekly_summary", "whoop_wellness_context"]
      },
      {
        name: "Cycles and strain",
        examples: ["physiological cycles", "day strain", "kilojoules", "average/max heart rate"],
        tools: ["whoop_list_cycles", "whoop_get_cycle"]
      },
      {
        name: "Sleep",
        examples: ["sleep sessions", "sleep-stage durations", "sleep performance", "consistency", "efficiency"],
        tools: ["whoop_list_sleeps", "whoop_get_sleep", "whoop_get_cycle_sleep"]
      },
      {
        name: "Workouts",
        examples: ["sport metadata", "workout strain", "heart-rate zones", "average/max heart rate"],
        tools: ["whoop_list_workouts", "whoop_get_workout"]
      }
    ],
    recommended_agent_flow: [
      "Call whoop_agent_manifest when installing or operating inside a server agent such as Hermes.",
      "Call whoop_connection_status before calling WHOOP data tools.",
      "If setup is incomplete, guide the user through setup, auth, and doctor.",
      "Use whoop_daily_summary or whoop_weekly_summary before lower-level collection tools.",
      "Use whoop_wellness_context when handing recovery/sleep/strain context to Exercise Catalog or Telegram workout flows.",
      "Use privacy_mode=raw only when the user explicitly asks for full upstream payloads.",
      "Avoid medical diagnosis; frame outputs as performance, recovery, sleep, and training context."
    ],
    client_aliases: {
      hermes: {
        tool_prefix: "mcp_whoop_",
        direct_tools: ["mcp_whoop_whoop_agent_manifest", "mcp_whoop_whoop_connection_status", "mcp_whoop_whoop_daily_summary", "mcp_whoop_whoop_weekly_summary"],
        reload_command: "/reload-mcp or hermes mcp test whoop",
        gateway_restart_required_for_data_access: false
      }
    },
    contribution_paths: [
      "Improve setup UX for less technical users.",
      "Add examples for more MCP clients.",
      "Improve summaries and evaluation fixtures.",
      "Expand API coverage when WHOOP exposes more official endpoints.",
      "Discuss BLE as a separate optional sidecar, not part of the OAuth API boundary."
    ],
    links: {
      github: "https://github.com/davidmosiah/whoop-mcp",
      docs: "https://davidmosiah.github.io/whoop-mcp/",
      npm: "https://www.npmjs.com/package/whoop-mcp-unofficial",
      whoop_api_docs: "https://developer.whoop.com/api/"
    }
  };
}
