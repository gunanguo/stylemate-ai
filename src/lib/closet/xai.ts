type ChatMessage = {
  role: "system" | "user";
  content: string | Array<{ type: string; text?: string; image_url?: { url: string } }>;
};

export type XaiChatResult =
  | { ok: true; content: string }
  | { ok: false; reason: "no-key" | "http" | "empty" };

/** One chat completion against the same xAI endpoint clothing recognition uses. */
export async function xaiChat(input: {
  messages: ChatMessage[];
  maxTokens: number;
  temperature: number;
}): Promise<XaiChatResult> {
  const apiKey = process.env.XAI_API_KEY?.trim();
  if (!apiKey) return { ok: false, reason: "no-key" };
  try {
    const res = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "grok-4.5",
        temperature: input.temperature,
        max_tokens: input.maxTokens,
        messages: input.messages,
      }),
    });
    if (!res.ok) return { ok: false, reason: "http" };
    const body = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const content = body.choices?.[0]?.message?.content;
    if (typeof content !== "string" || !content.trim()) return { ok: false, reason: "empty" };
    return { ok: true, content };
  } catch {
    return { ok: false, reason: "http" };
  }
}

export function parseModelJson(raw: string): unknown {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end < start) return null;
  try {
    return JSON.parse(raw.slice(start, end + 1));
  } catch {
    return null;
  }
}
