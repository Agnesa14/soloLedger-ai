import OpenAI from "openai";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const client = new OpenAI({
  apiKey: process.env.OPENROUTER_API_KEY,
  baseURL: "https://openrouter.ai/api/v1",
  defaultHeaders: {
    "HTTP-Referer": process.env.OPENROUTER_SITE_URL ?? "http://localhost:3000",
    "X-Title": process.env.OPENROUTER_APP_NAME ?? "SoloLedger-AI",
  },
});

type ApiErrorCode =
  | "EMPTY_MESSAGE"
  | "TOO_LONG"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "RATE_LIMIT"
  | "PROVIDER_ERROR"
  | "SERVER_ERROR";

function mapStatusToCode(status: number): ApiErrorCode {
  if (status === 401) return "UNAUTHORIZED";
  if (status === 402 || status === 403) return "FORBIDDEN";
  if (status === 404) return "NOT_FOUND";
  if (status === 429) return "RATE_LIMIT";
  if (status >= 500) return "PROVIDER_ERROR";
  return "SERVER_ERROR";
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { message?: string };
  const message = String(body?.message ?? "").trim();

  // Edge case: empty input
  if (!message) {
    return Response.json({ code: "EMPTY_MESSAGE", error: "Message is empty." }, { status: 400 });
  }

  // Edge case: input too long (server-side hardening)
  const MAX_CHARS = 800;
  if (message.length > MAX_CHARS) {
    return Response.json(
      { code: "TOO_LONG", error: `Message is too long (max ${MAX_CHARS} characters).` },
      { status: 400 }
    );
  }

  if (!process.env.OPENROUTER_API_KEY) {
    // Still allow demo mode
    return Response.json({
      reply:
        "Mock AI (no OpenRouter API key configured yet).\n\n" +
        "Budget for €1200/month:\n" +
        "1. Housing: 40%\n" +
        "2. Food: 20%\n" +
        "3. Entertainment: 15%\n" +
        "4. Savings: 20%\n" +
        "5. Miscellaneous: 5%\n",
    });
  }

  try {
    const completion = await client.chat.completions.create({
      model: "meta-llama/llama-3.1-8b-instruct",
      temperature: 0.3,
      max_tokens: 500,
      messages: [
        {
          role: "system",
          content:
            "You are a helpful assistant. Reply clearly and briefly. If the user asks for a budget, return 5 categories with percentages that add up to 100%.",
        },
        { role: "user", content: message },
      ],
    });

    return Response.json({ reply: completion.choices[0]?.message?.content ?? "" });
  } catch (err: any) {
    const status = err?.status ?? err?.response?.status ?? 500;
    const code = mapStatusToCode(status);

    console.error("OpenRouter error (server-side):", {
      status,
      code,
      message: err?.message,
      data: err?.response?.data,
    });

    return Response.json(
      { code, error: "We couldn't reach the AI provider. Please try again." },
      { status }
    );
  }
}