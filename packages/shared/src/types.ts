export interface ContactSessionMetadata {
  userAgent?: string;
  language?: string;
  languages?: string;
  platform?: string;
  vendor?: string;
  screenResolution?: string;
  viewportSize?: string;
  timezone?: string;
  timezoneOffset?: number;
  cookieEnabled?: boolean;
  referrer?: string;
  currentUrl?: string;
}

export interface WidgetConfig {
  greetMessage: string;
  suggestion1?: string | null;
  suggestion2?: string | null;
  suggestion3?: string | null;
  vapiAssistantId?: string | null;
  vapiPhoneNumber?: string | null;
}

export interface AgentToolCall {
  name: string;
  arguments: Record<string, unknown>;
  result?: string;
}
