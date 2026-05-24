import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(url, key);
}

interface MemberData {
  username: string;
  currentStreak: number;
  completedToday: boolean;
  totalCompletions: number;
  lastActive: string;
}

export async function POST(req: NextRequest) {
  try {
    const { userAddress, circleMembersData, forceRefresh } = await req.json() as {
      userAddress: string;
      circleMembersData: MemberData[];
      forceRefresh?: boolean;
    };

    if (!userAddress) return NextResponse.json({ insight: null });
    if (!circleMembersData || circleMembersData.length === 0) return NextResponse.json({ insight: null });

    const addr = userAddress.toLowerCase();
    const supabase = getSupabase();

    // Check cache unless forceRefresh
    if (!forceRefresh) {
      const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { data: cached } = await supabase
        .from('circle_insights')
        .select('insight_text, generated_at')
        .eq('user_address', addr)
        .gte('generated_at', cutoff)
        .order('generated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (cached) {
        return NextResponse.json({
          insight: (cached as any).insight_text,
          cached: true,
          generatedAt: (cached as any).generated_at,
        });
      }
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return NextResponse.json({ insight: null });

    const userMessage = `Here is the user's circle data for today: ${JSON.stringify(circleMembersData)}. Write a brief morning summary of what their people have been up to. Reference specific usernames and numbers.`;

    const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 150,
        system: "You are a motivational coach for Proov, a habit tracking app. You write short, warm, specific daily summaries about a user's accountability circle. Write like a friend giving a morning briefing — specific, encouraging, never generic. Maximum 2 sentences. Never use the word 'insights'. Never start with 'Your circle'.",
        messages: [{ role: 'user', content: userMessage }],
      }),
    });

    if (!anthropicRes.ok) return NextResponse.json({ insight: null });

    const anthropicData = await anthropicRes.json();
    const insightText = anthropicData?.content?.[0]?.text?.trim();

    if (!insightText) return NextResponse.json({ insight: null });

    // Save to cache
    try {
      await supabase.from('circle_insights').insert({
        user_address: addr,
        insight_text: insightText,
        circle_snapshot: JSON.stringify(circleMembersData),
      });
    } catch {}

    return NextResponse.json({ insight: insightText, cached: false, generatedAt: new Date().toISOString() });
  } catch {
    return NextResponse.json({ insight: null });
  }
}
