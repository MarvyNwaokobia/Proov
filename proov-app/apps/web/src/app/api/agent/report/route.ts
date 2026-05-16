// Vercel cron: "0 8 * * 0" (Sunday 8AM UTC)
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

interface MemberData {
  address: string;
  streak: number;
  weeklyCompletions: number;
  totalHabits: number;
}

export async function POST(req: Request) {
  const { members }: { members: MemberData[] } = await req.json();

  if (!members || members.length === 0) {
    return Response.json({ report: "" });
  }

  const summary = members
    .map(
      (m) =>
        `Address ${m.address.slice(0, 6)}...: streak ${m.streak} days, ` +
        `${m.weeklyCompletions} completions this week, ${m.totalHabits} active habits`
    )
    .join("\n");

  const message = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 300,
    messages: [
      {
        role: "user",
        content: `You are the Proov accountability agent writing a weekly Sunday circle report.

Circle stats this week:
${summary}

Write a short, honest, encouraging report (max 120 words):
- Name who showed up most consistently (by streak)
- Name who might need encouragement (lowest completions)
- One practical tip for next week
- End with a motivating one-liner

Tone: supportive friend, not corporate. Direct, warm, brief.
Do not use markdown. Plain text only.`,
      },
    ],
  });

  const report =
    message.content[0].type === "text" ? message.content[0].text : "";
  return Response.json({ report });
}

// Vercel cron entry point (GET)
export async function GET() {
  return Response.json({ ok: true, message: "Sunday report cron is live" });
}
