const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
// OpenRouter always requires a "model" field — there's no account-level
// default. Pinned to a plain free instruct model rather than the
// openrouter/free auto-router, which can land on a reasoning model that
// leaks its chain-of-thought into message.content instead of a clean answer.
const DEFAULT_MODEL = process.env.OPENROUTER_MODEL || "meta-llama/llama-3.3-70b-instruct:free";

// Thin fetch wrapper around OpenRouter's OpenAI-compatible chat completions
// endpoint. Deliberately dependency-free (built-in fetch) so this isolated
// ai/ folder never touches the rest of the app's package.json.
export async function chatComplete(
  messages,
  { model = DEFAULT_MODEL, maxTokens = 400 } = {}
) {
  if (!process.env.OPENROUTER_API_KEY) {
    throw new Error("OPENROUTER_API_KEY is not set");
  }

  const res = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ model, messages, max_tokens: maxTokens }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`OpenRouter error ${res.status}: ${body}`);
  }

  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("OpenRouter response had no message content");
  }
  return content;
}
