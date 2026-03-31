import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body?.sow_text?.trim()) {
    return NextResponse.json({ error: "sow_text is required" }, { status: 400 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY is not set" }, { status: 500 });
  }

  const { sow_text, month } = body as { sow_text: string; month: string };

  const systemPrompt = `You are an agency project manager. Read the following scope of work and break it into individual tasks. For each task return: title, role (choose from: Strategist, Graphic Designer, Senior Graphic Designer, Video Editor, Junior Video Editor, Copywriter, Social Media Manager, SEO Specialist, Performance Marketer, Operations Manager, Digital Marketer), priority (Urgent, High, Medium, or Low), due_date (as a date within the selected month, earlier for urgent tasks), points (Urgent=20, High=15, Medium=10, Low=5), mandate_type (choose the closest from: Social Media Marketing, Performance Marketing, SEO, Content Marketing, Website Development, Branding, Email Marketing, WhatsApp Marketing, Influencer Marketing, PR Management). Return ONLY a JSON array with no extra text.`;

  const userMessage = `The selected month is: ${month}\n\nScope of Work:\n${sow_text}`;

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4096,
      system: systemPrompt,
      messages: [{ role: "user", content: userMessage }],
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    return NextResponse.json(
      { error: `Claude API error: ${response.status}`, detail: errText },
      { status: 502 }
    );
  }

  const aiData = await response.json();
  const rawText: string = aiData.content?.[0]?.text ?? "";

  // Extract JSON array — handle possible markdown code fences
  const jsonMatch = rawText.match(/\[[\s\S]*\]/);
  if (!jsonMatch) {
    return NextResponse.json(
      { error: "Claude did not return a valid JSON array.", raw: rawText },
      { status: 500 }
    );
  }

  let tasks: unknown[];
  try {
    tasks = JSON.parse(jsonMatch[0]);
  } catch {
    return NextResponse.json(
      { error: "Failed to parse Claude response as JSON.", raw: rawText },
      { status: 500 }
    );
  }

  return NextResponse.json({ tasks });
}
