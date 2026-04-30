export type ResponseFormat = "markdown" | "json";
export type PrivacyMode = "summary" | "structured" | "raw";

export interface WhoopTokenSet {
  access_token: string;
  refresh_token?: string;
  expires_at?: number;
  token_type?: string;
  scope?: string;
}

export interface WhoopConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scopes: string[];
  tokenPath: string;
  privacyMode: PrivacyMode;
  cacheEnabled: boolean;
  cachePath: string;
}

export interface WhoopCollection<T = unknown> {
  records?: T[];
  next_token?: string;
  nextToken?: string;
}

export interface ToolResponse<T> extends Record<string, unknown> {
  content: Array<{ type: "text"; text: string }>;
  structuredContent?: T;
  isError?: boolean;
}
