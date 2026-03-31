import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  // ── Parse body ────────────────────────────────────────────────────────────
  const body = await req.json().catch(() => null);
  if (!body?.sow_text?.trim()) {
    return NextResponse.json({ error: "sow_text is required" }, { status: 400 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error("[sow-breakdown] ANTHROPIC_API_KEY is not set in environment");
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY is not configured on the server." },
      { status: 500 }
    );
  }

  const { sow_text, month } = body as { sow_text: string; month: string };

  // ── Prompt ────────────────────────────────────────────────────────────────
  const systemPrompt =
    "You are an agency project manager. Read the following scope of work and break it into individual tasks. " +
    "For each task return: title, role (choose from: Strategist, Graphic Designer, Senior Graphic Designer, " +
    "Video Editor, Junior Video Editor, Copywriter, Social Media Manager, SEO Specialist, Performance Marketer, " +
    "Operations Manager, Digital Marketer), priority (Urgent, High, Medium, or Low), " +
    "due_date (as a date within the selected month in YYYY-MM-DD format, earlier for urgent tasks), " +
    "points (Urgent=20, High=15, Medium=10, Low=5), " +
    "mandate_type (choose the closest from: Social Media Marketing, Performance Marketing, SEO, " +
    "Content Marketing, Website Development, Branding, Email Marketing, WhatsApp Marketing, " +
    "Influencer Marketing, PR Management). " +
    "Return ONLY a valid JSON array with no extra text, no markdown, no code fences.";

  const userMessage = `The selected month is: ${month}\n\nScope of Work:\n${sow_text}`;

  // ── Call Anthropic API ────────────────────────────────────────────────────
  const requestBody = {
    model: "claude-haiku-4-5-20251001",
    max_tokens: 4000,
    system: systemPrompt,
    messages: [
      {
        role: "user",
        content: userMessage,
      },
    ],
  };

  console.log("[sow-breakdown] Calling Anthropic API with model:", requestBody.model);

  let response: Response;
  try {
    response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(requestBody),
    });
  } catch (fetchErr) {
    console.error("[sow-breakdown] Network error reaching Anthropic:", fetchErr);
    return NextResponse.json(
      { error: "Network error reaching Anthropic API." },
      { status: 502 }
    );
  }

  // ── Handle non-OK response ────────────────────────────────────────────────
  if (!response.ok) {
    const errBody = await response.text();
    console.error(
      `[sow-breakdown] Anthropic returned HTTP ${response.status}:\n${errBody}`
    );
    return NextResponse.json(
      {
        error: `Claude API error: ${response.status}`,
        detail: errBody,
      },
      { status: 502 }
    );
  }

  // ── Parse AI response ─────────────────────────────────────────────────────
  const aiData = await response.json();
  const rawText: string = aiData.content?.[0]?.text ?? "";

  console.log("[sow-breakdown] Claude raw response length:", rawText.length);

  // Strip possible markdown code fences, then extract JSON array
  const stripped = rawText
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/, "")
    .trim();

  const jsonMatch = stripped.match(/\[[\s\S]*\]/);
  if (!jsonMatch) {
    console.error("[sow-breakdown] No JSON array found in Claude response:\n", rawText);
    return NextResponse.json(
      { error: "Claude did not return a valid JSON array.", raw: rawText },
      { status: 500 }
    );
  }

  let tasks: unknown[];
  try {
    tasks = JSON.parse(jsonMatch[0]);
  } catch (parseErr) {
    console.error("[sow-breakdown] JSON parse failed:", parseErr, "\nRaw:", rawText);
    return NextResponse.json(
      { error: "Failed to parse Claude response as JSON.", raw: rawText },
      { status: 500 }
    );
  }

  console.log(`[sow-breakdown] Successfully parsed ${tasks.length} tasks`);
  return NextResponse.json({ tasks });
}
