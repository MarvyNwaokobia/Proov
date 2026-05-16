import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req: Request) {
  const { habitName, goalType, userDescription } = await req.json();

  if (!userDescription || userDescription.trim().length < 10) {
    return Response.json({
      verified: false,
      reason: "Description too short. Tell us what you actually did.",
    });
  }

  const message = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 150,
    messages: [
      {
        role: "user",
        content: `You are an accountability judge for Proov, a habit tracking app.

Habit: "${habitName}" (type: ${goalType})
User's completion description: "${userDescription}"

Reply ONLY with this exact JSON format — no markdown, no extra text:
{"verified": true, "reason": "one sentence why"}
or
{"verified": false, "reason": "one sentence why not"}

Rules:
- Accept genuine, specific effort descriptions
- Reject vague claims ("did it", "completed", "yes")
- Reject descriptions that don't match the goal type
- Be encouraging but honest`,
      },
    ],
  });

  try {
    const text = message.content[0].type === "text" ? message.content[0].text : "{}";
    const result = JSON.parse(text.trim());
    return Response.json(result);
  } catch {
    return Response.json({
      verified: false,
      reason: "Could not process verification. Please try again.",
    });
  }
}
