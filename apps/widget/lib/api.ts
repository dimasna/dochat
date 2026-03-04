const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

export const api = {
  validateOrg: async (orgId: string) => {
    const res = await fetch(`${API_BASE}/api/embed/validate-org?orgId=${orgId}`);
    return res.json() as Promise<{ valid: boolean; reason?: string }>;
  },

  validateSession: async (sessionId: string) => {
    const res = await fetch(`${API_BASE}/api/embed/validate-session?sessionId=${sessionId}`);
    return res.json() as Promise<{ valid: boolean; sessionToken?: string }>;
  },

  getConfig: async (orgId: string) => {
    const res = await fetch(`${API_BASE}/api/embed/config?orgId=${orgId}`);
    if (!res.ok) return null;
    return res.json();
  },

  createSession: async (data: {
    orgId: string;
    name: string;
    email: string;
    metadata: Record<string, unknown>;
  }) => {
    const res = await fetch(`${API_BASE}/api/embed/session`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    return res.json() as Promise<{ sessionId: string; sessionToken: string }>;
  },

  createConversation: async (sessionToken: string, orgId: string) => {
    const res = await fetch(`${API_BASE}/api/embed/conversations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionToken, orgId }),
    });
    return res.json() as Promise<{ conversationId: string }>;
  },

  getConversation: async (conversationId: string, sessionToken: string) => {
    const res = await fetch(
      `${API_BASE}/api/embed/conversations/${conversationId}?sessionToken=${sessionToken}`,
    );
    return res.json() as Promise<{ id: string; status: string; createdAt: string }>;
  },

  getConversations: async (sessionToken: string) => {
    const res = await fetch(
      `${API_BASE}/api/embed/conversations?sessionToken=${sessionToken}`,
    );
    return res.json() as Promise<
      Array<{
        id: string;
        status: string;
        createdAt: string;
        lastMessage: { text: string; role: string } | null;
      }>
    >;
  },

  getMessages: async (conversationId: string, sessionToken: string) => {
    const res = await fetch(
      `${API_BASE}/api/embed/conversations/${conversationId}/messages?sessionToken=${sessionToken}`,
    );
    return res.json() as Promise<
      Array<{ id: string; role: string; content: string; createdAt: string }>
    >;
  },

  sendMessage: async (data: {
    conversationId: string;
    sessionToken: string;
    content: string;
  }) => {
    const res = await fetch(`${API_BASE}/api/embed/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    return res.json();
  },
};
