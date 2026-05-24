import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(url, key);
}

interface ExistingHabit {
  name: string;
  category: string;
  type: string;
  schedule: string;
}

export async function POST(req: NextRequest) {
  try {
    const { userAddress, existingHabits, forceRefresh } = await req.json() as {
      userAddress: string;
      existingHabits: ExistingHabit[];
      forceRefresh?: boolean;
    };

    if (!userAddress) return NextResponse.json({ suggestions: [] });

    const addr = userAddress.toLowerCase();
    const supabase = getSupabase();

    // Check cache (3 days) unless forceRefresh
    if (!forceRefresh) {
      const cutoff = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
      const { data: cached } = await supabase
        .from('habit_suggestions')
        .select('suggestions, generated_at')
        .eq('user_address', addr)
        .gte('generated_at', cutoff)
        .order('generated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (cached) {
        return NextResponse.json({
          suggestions: (cached as any).suggestions,
          cached: true,
          generatedAt: (cached as any).generated_at,
        });
      }
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return NextResponse.json({ suggestions: [] });

    const hasHabits = existingHabits && existingHabits.length > 0;
    const userMessage = hasHabits
      ? `Here are my current habits: ${JSON.stringify(existingHabits)}. Suggest 4 habits I should add to build a more balanced routine.`
      : `I'm new to habit tracking and have no habits yet. Suggest 4 starter habits to build a balanced routine.`;

    const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 400,
        system: `You are a habit coach for Proov, a habit tracking app. Based on the user's existing habits, suggest 4 new habits they don't already have. Be specific and practical. Consider balance — if they have focus habits, suggest recovery. If they have fitness, suggest nutrition or sleep. Never suggest something they already do. Respond ONLY with valid JSON, no other text:
{ "suggestions": [
  {
    "name": "habit name",
    "emoji": "single emoji",
    "category": "Focus | Fitness | Wellness | Learning | Nutrition | Creative",
    "type": "timed | checkbox",
    "duration_minutes": null,
    "reason": "one sentence why this complements their stack",
    "schedule": "Daily | Weekdays | Weekends"
  }
]}`,
        messages: [{ role: 'user', content: userMessage }],
      }),
    });

    if (!anthropicRes.ok) return NextResponse.json({ suggestions: [] });

    const anthropicData = await anthropicRes.json();
    const rawText = anthropicData?.content?.[0]?.text?.trim() || '';

    let suggestions: any[] = [];
    try {
      const match = rawText.match(/\{[\s\S]*\}/);
      const parsed = JSON.parse(match ? match[0] : rawText);
      suggestions = Array.isArray(parsed.suggestions) ? parsed.suggestions : [];
    } catch {
      return NextResponse.json({ suggestions: [] });
    }

    if (suggestions.length === 0) return NextResponse.json({ suggestions: [] });

    try {
      await supabase.from('habit_suggestions').insert({ user_address: addr, suggestions });
    } catch {}

    return NextResponse.json({ suggestions, cached: false, generatedAt: new Date().toISOString() });
  } catch {
    return NextResponse.json({ suggestions: [] });
  }
}
