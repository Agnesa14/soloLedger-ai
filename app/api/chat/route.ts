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

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { message?: string };
  const message = String(body?.message ?? "").trim();

  if (!message) {
    return Response.json({ error: "Message is required." }, { status: 400 });
  }

  // Fallback (so UI works even if key is missing)
  if (!process.env.OPENROUTER_API_KEY) {
    return Response.json({
      reply:
        "Mock AI (no OpenRouter API key configured yet).\n\n" +
        "Budget for €1200/month:\n" +
        "- Needs: 50%\n" +
        "- Food: 15%\n" +
        "- Transport: 10%\n" +
        "- Savings: 15%\n" +
        "- Fun/Misc: 10%\n",
    });
  }

  try {
    const completion = await client.chat.completions.create({
      // If this model errors, we'll change it after we see the exact error.
      model: "qwen/qwen-2.5-7b-instruct",
      temperature: 0.3,
      max_tokens: 500,
      messages: [
  {
    role: "system",
    content:
      "You are SoloLedger AI. Answer directly. Keep it short and structured. When asked for a budget, return 5 categories with percentages that add up to 100%.",
  },
  { role: "user", content: message },
],
    });

    return Response.json({
      reply: completion.choices[0]?.message?.content ?? "",
    });
  } catch (err: any) {
    // Print full error in terminal
    console.error("OpenRouter error:", err);

    // Return the most informative message to the UI
    const msg =
      err?.response?.data?.error?.message ??
      err?.response?.data?.message ??
      err?.message ??
      "Server error.";

    const status = err?.status ?? err?.response?.status ?? 500;

    return Response.json({ error: msg }, { status });
  }
}