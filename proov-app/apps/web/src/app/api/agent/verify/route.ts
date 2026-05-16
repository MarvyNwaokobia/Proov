import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextRequest, NextResponse } from "next/server";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export async function POST(req: NextRequest) {
  try {
    const { habitName, goalType, userDescription } = await req.json();

    if (!userDescription || userDescription.trim().length < 10) {
      return NextResponse.json({
        verified: false,
        reason: "Description too short. Tell us what you actually did.",
      });
    }

    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-lite" });

    const prompt = `You are an accountability judge for Proov, a habit tracking app.

Habit: "${habitName}" (type: ${goalType})
User's completion description: "${userDescription}"

Reply ONLY with this exact JSON format — no markdown, no extra text, no code blocks:
{"verified": true, "reason": "one sentence why"}
or
{"verified": false, "reason": "one sentence why not"}

Rules:
- Accept genuine, specific effort descriptions
- Reject vague claims like "did it", "completed", "yes", "done"
- Reject descriptions that clearly don't match the goal type
- Be encouraging but honest
- One sentence max for reason`;

    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();

    // Strip markdown code blocks if Gemini wraps the response
    const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();

    const parsed = JSON.parse(cleaned);
    return NextResponse.json(parsed);
  } catch (error) {
    console.error("Verify route error:", error);
    return NextResponse.json({
      verified: false,
      reason: "Could not process verification. Please try again.",
    });
  }
}
