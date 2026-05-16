// Vercel cron: "0 8 * * 0" (Sunday 8AM UTC)
import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextRequest, NextResponse } from "next/server";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

interface MemberData {
  address: string;
  streak: number;
  weeklyCompletions: number;
  totalHabits: number;
}

export async function POST(req: NextRequest) {
  try {
    const { members }: { members: MemberData[] } = await req.json();

    if (!members || members.length === 0) {
      return NextResponse.json({ report: "" });
    }

    const summary = members
      .map(
        (m) =>
          `${m.address.slice(0, 6)}...: streak ${m.streak} days, ${m.weeklyCompletions} completions this week, ${m.totalHabits} active habits`
      )
      .join("\n");

    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-lite" });

    const prompt = `You are the Proov accountability agent writing a weekly Sunday circle report.

Circle stats this week:
${summary}

Write a short, honest, encouraging report (max 120 words):
- Mention who showed up most consistently (highest streak)
- Mention who might need encouragement (lowest completions)
- Give one practical tip for next week
- End with a short motivating line

Rules:
- Tone: supportive friend, not corporate
- Plain text only — no markdown, no bullet points, no headers
- Max 120 words
- Be direct and warm`;

    const result = await model.generateContent(prompt);
    const report = result.response.text().trim();

    return NextResponse.json({ report });
  } catch (error) {
    console.error("Report route error:", error);
    return NextResponse.json({ report: "" });
  }
}

// Vercel cron entry point (GET)
export async function GET() {
  return NextResponse.json({ ok: true, message: "Sunday report cron is live" });
}
