import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const MONTHLY_LIMIT = 20;

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

async function getUsage(address: string): Promise<{ used: number; resetDate: string | null }> {
  const supabase = getSupabase();
  if (!supabase) return { used: 0, resetDate: null };
  const { data } = await supabase
    .from('profiles')
    .select('ai_verifications_used_this_month, ai_verifications_reset_date')
    .eq('address', address.toLowerCase())
    .maybeSingle();
  return {
    used: (data as any)?.ai_verifications_used_this_month || 0,
    resetDate: (data as any)?.ai_verifications_reset_date || null,
  };
}

async function incrementUsage(address: string): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) return;
  const addr = address.toLowerCase();
  const today = new Date().toISOString().split('T')[0];
  const { data: existing } = await supabase
    .from('profiles')
    .select('ai_verifications_used_this_month')
    .eq('address', addr)
    .maybeSingle();
  const currentCount = (existing as any)?.ai_verifications_used_this_month || 0;
  await supabase.from('profiles').upsert(
    {
      address: addr,
      ai_verifications_used_this_month: currentCount + 1,
      ai_verifications_reset_date: today,
    },
    { onConflict: 'address' }
  );
}

async function recordProof(
  habitId: string,
  userAddress: string,
  proofType: string,
  verdict: string,
  reasoning: string
): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) return;
  await supabase.from('habit_proofs').insert({
    habit_id: habitId,
    user_address: userAddress.toLowerCase(),
    proof_type: proofType,
    verdict,
    reasoning,
  });
}

export async function POST(req: NextRequest) {
  try {
    const { habitId, habitName, proofType, proofContent, userAddress } = await req.json();

    if (!habitId || !habitName || !proofType || !proofContent || !userAddress) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const addr = userAddress.toLowerCase();

    // Check usage and maybe reset monthly counter
    const { used, resetDate } = await getUsage(addr);
    if (resetDate) {
      const reset = new Date(resetDate);
      const daysSinceReset = (Date.now() - reset.getTime()) / (1000 * 60 * 60 * 24);
      if (daysSinceReset > 30) {
        // Reset counter
        const supabase = getSupabase();
        await supabase?.from('profiles').upsert(
          { address: addr, ai_verifications_used_this_month: 0, ai_verifications_reset_date: new Date().toISOString().split('T')[0] },
          { onConflict: 'address' }
        );
      } else if (used >= MONTHLY_LIMIT) {
        return NextResponse.json({ error: 'Monthly limit reached', limitReached: true }, { status: 403 });
      }
    } else if (used >= MONTHLY_LIMIT) {
      return NextResponse.json({ error: 'Monthly limit reached', limitReached: true }, { status: 403 });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'Verification service unavailable' }, { status: 500 });
    }

    // Build Anthropic message content
    let userContent: any[];
    if (proofType === 'photo') {
      // proofContent is base64 data URL — strip prefix
      const base64Data = proofContent.replace(/^data:image\/[a-z]+;base64,/, '');
      const mediaType = proofContent.match(/^data:(image\/[a-z]+);base64,/)?.[1] || 'image/jpeg';
      userContent = [
        {
          type: 'image',
          source: { type: 'base64', media_type: mediaType, data: base64Data },
        },
        {
          type: 'text',
          text: `The user claims to have completed their habit: "${habitName}". Does this photo provide reasonable evidence they completed it? Respond ONLY with valid JSON: {"verdict":"approved","reasoning":"..."} or {"verdict":"rejected","reasoning":"..."}`,
        },
      ];
    } else {
      userContent = [
        {
          type: 'text',
          text: `The user claims to have completed their habit: "${habitName}". Their written proof: "${proofContent}". Does this text provide reasonable evidence they completed it? Respond ONLY with valid JSON: {"verdict":"approved","reasoning":"..."} or {"verdict":"rejected","reasoning":"..."}`,
        },
      ];
    }

    const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 200,
        system: 'You are a habit verification assistant for Proov, a habit tracking app. Your job is to evaluate whether submitted proof (photo or text) reasonably demonstrates that a user completed their stated habit. Be encouraging but honest. Always respond with valid JSON only.',
        messages: [{ role: 'user', content: userContent }],
      }),
    });

    if (!anthropicRes.ok) {
      const errText = await anthropicRes.text().catch(() => '');
      console.error('Anthropic API error:', anthropicRes.status, errText);
      return NextResponse.json({ error: 'Verification service error' }, { status: 500 });
    }

    const anthropicData = await anthropicRes.json();
    const rawText = anthropicData?.content?.[0]?.text || '';

    let verdict: string;
    let reasoning: string;
    try {
      const parsed = JSON.parse(rawText.match(/\{[\s\S]*\}/)?.[0] || rawText);
      verdict = parsed.verdict === 'approved' ? 'approved' : 'rejected';
      reasoning = parsed.reasoning || '';
    } catch {
      return NextResponse.json({ error: 'Could not parse verification response' }, { status: 500 });
    }

    // Only increment usage on approved
    if (verdict === 'approved') {
      await incrementUsage(addr);
    }

    // Always record the proof attempt
    await recordProof(habitId, addr, proofType, verdict, reasoning).catch(() => {});

    return NextResponse.json({ verdict, reasoning, remaining: MONTHLY_LIMIT - used - (verdict === 'approved' ? 1 : 0) });
  } catch (err) {
    console.error('verify-habit route error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
