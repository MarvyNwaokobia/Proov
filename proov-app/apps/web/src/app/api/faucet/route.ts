import { NextRequest, NextResponse } from 'next/server';
import { createWalletClient, createPublicClient, http, parseEther, formatEther, isAddress } from 'viem';
import { celo } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import { createClient } from '@supabase/supabase-js';
import { getTankThresholds } from '@/lib/fuel';

// Each drip tops the tank back up to ~0.2 CELO.
const DRIP = parseEther('0.2');

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

function todayUtc(): string {
  return new Date().toISOString().split('T')[0];
}

export async function POST(req: NextRequest) {
  try {
    const { address } = await req.json();

    if (!address || !isAddress(address)) {
      return NextResponse.json({ error: 'Invalid address' }, { status: 400 });
    }

    const pk = process.env.FAUCET_PRIVATE_KEY as `0x${string}` | undefined;
    if (!pk) {
      return NextResponse.json({ error: 'Faucet not configured' }, { status: 503 });
    }

    const rpc = process.env.NEXT_PUBLIC_CELO_RPC_URL || 'https://forno.celo.org';
    const publicClient = createPublicClient({ chain: celo, transport: http(rpc) });

    // Gate 1: tank must not be 'healthy' — uses the same gas-price-aware
    // thresholds as the client, so both sides agree on what "low" means.
    const [rawBalance, gasPriceWei] = await Promise.all([
      publicClient.getBalance({ address }),
      publicClient.getGasPrice(),
    ]);
    const balance = parseFloat(formatEther(rawBalance));
    const { low } = getTankThresholds(gasPriceWei);
    if (balance > low) {
      return NextResponse.json({ ok: true, skipped: 'sufficient' });
    }

    // Gate 2: once per day (UTC)
    const supabase = getSupabase();
    if (supabase) {
      const { data } = await supabase
        .from('profiles')
        .select('last_fuel_claim')
        .eq('address', address.toLowerCase())
        .maybeSingle();

      if ((data as any)?.last_fuel_claim === todayUtc()) {
        return NextResponse.json({ ok: true, skipped: 'daily_limit' });
      }
    }

    // Send fuel
    const account = privateKeyToAccount(pk);
    const wallet = createWalletClient({ account, chain: celo, transport: http(rpc) });
    const hash = await wallet.sendTransaction({ to: address, value: DRIP });

    // Record the claim date so the daily gate works next time
    if (supabase) {
      await supabase
        .from('profiles')
        .upsert(
          { address: address.toLowerCase(), last_fuel_claim: todayUtc() },
          { onConflict: 'address' }
        );
    }

    return NextResponse.json({ ok: true, hash });
  } catch (err: any) {
    console.error('[faucet]', err?.message);
    return NextResponse.json({ error: err?.message || 'Faucet error' }, { status: 500 });
  }
}
