import OpenAI from "openai";
import { getErrorMessage, getErrorStatus } from "@/lib/errors";

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

const defaultModel = process.env.OPENROUTER_MODEL ?? "meta-llama/llama-3.1-8b-instruct";

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
  const body = (await req.json().catch(() => ({}))) as { message?: string; context?: string };
  const message = String(body?.message ?? "").trim();
  const context = String(body?.context ?? "").trim();

  if (!message) {
    return Response.json({ code: "EMPTY_MESSAGE", error: "Message is empty." }, { status: 400 });
  }

  const maxChars = 800;
  if (message.length > maxChars) {
    return Response.json(
      { code: "TOO_LONG", error: `Message is too long (max ${maxChars} characters).` },
      { status: 400 }
    );
  }

  const sanitizedContext = context.slice(0, 4_000);

  if (!process.env.OPENROUTER_API_KEY) {
    return Response.json({
      reply:
        "Mock SoloLedger AI (no OpenRouter API key configured yet).\n\n" +
        (sanitizedContext
          ? "I can already see your app is sending financial context, so once you add the API key the assistant will answer with real personalized coaching.\n\n"
          : "No financial context was attached yet, so this is still a generic reply.\n\n") +
        "Suggested structure for a healthy monthly plan:\n" +
        "1. Essentials: 50%\n" +
        "2. Lifestyle: 20%\n" +
        "3. Savings: 20%\n" +
        "4. Buffer: 10%\n\n" +
        "Ask the assistant things like: 'Where am I overspending?' or 'How do I save 150 EUR this month?'",
    });
  }

  try {
    const completion = await client.chat.completions.create({
      model: defaultModel,
      temperature: 0.3,
      max_tokens: 500,
      messages: [
        {
          role: "system",
          content:
            "You are SoloLedger AI, a pragmatic financial copilot for budgeting, spending control, savings habits, and fixed-cost planning. Reply clearly, professionally, and with concrete actions in EUR when useful. If financial context is provided, use it and cite the numbers you rely on. If budget limits, savings goals, recurring commitments, or weekly cash-flow signals are included, factor them into the advice and explain the tradeoff. If context is missing or incomplete, say that briefly instead of pretending. Prefer actionable advice over theory. If the user asks for a budget, return 5 categories with percentages that add up to 100%. End with one practical next step.",
        },
        ...(sanitizedContext
          ? [
              {
                role: "system" as const,
                content:
                  "User financial context from SoloLedger:\n" +
                  sanitizedContext +
                  "\nUse this context to personalize your response, but do not mention data that is not present here.",
              },
            ]
          : []),
        { role: "user", content: message },
      ],
    });

    return Response.json({ reply: completion.choices[0]?.message?.content ?? "" });
  } catch (error) {
    const status = getErrorStatus(error);
    const code = mapStatusToCode(status);

    console.error("OpenRouter error (server-side):", {
      status,
      code,
      message: getErrorMessage(error, "Unknown provider error"),
    });

    return Response.json(
      { code, error: "We couldn't reach the AI provider. Please try again." },
      { status }
    );
  }
}
