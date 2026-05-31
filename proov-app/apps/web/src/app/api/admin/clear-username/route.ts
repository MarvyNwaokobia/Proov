import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export async function POST(req: NextRequest) {
  const { username } = await req.json();
  if (!username) return NextResponse.json({ error: 'username required' }, { status: 400 });

  const clean = username.toLowerCase().replace(/^@/, '');
  const db = createClient(supabaseUrl, supabaseKey);

  const { data: existing, error: findError } = await db
    .from('profiles')
    .select('address, username')
    .eq('username', clean)
    .maybeSingle();

  if (findError) return NextResponse.json({ error: findError.message }, { status: 500 });
  if (!existing) return NextResponse.json({ error: `Username "${clean}" not found` }, { status: 404 });

  const { error } = await db
    .from('profiles')
    .update({ username: null })
    .eq('username', clean);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true, freed: clean, fromAddress: existing.address });
}
