import { NextRequest, NextResponse } from 'next/server';
import { createWalletClient, createPublicClient, http, parseEther, formatEther, isAddress } from 'viem';
import { celo } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import { createClient } from '@supabase/supabase-js';
import { getTankThresholds } from '@/lib/fuel';

const DRIP = parseEther('0.2');
const WELCOME_DRIP = parseEther('0.2');

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
    const { address, walletType } = await req.json();

    if (!address || !isAddress(address)) {
      return NextResponse.json({ error: 'Invalid address' }, { status: 400 });
    }

    const pk = process.env.FAUCET_PRIVATE_KEY as `0x${string}` | undefined;
    if (!pk) {
      return NextResponse.json({ error: 'Faucet not configured' }, { status: 503 });
    }

    const rpc = process.env.NEXT_PUBLIC_CELO_RPC_URL || 'https://forno.celo.org';
    const publicClient = createPublicClient({ chain: celo, transport: http(rpc) });
    const addrLower = address.toLowerCase();
    const isExternal = walletType === 'injected';

    // Gate 1: tank must be critical
    const [rawBalance, gasPriceWei] = await Promise.all([
      publicClient.getBalance({ address }),
      publicClient.getGasPrice(),
    ]);
    const balance = parseFloat(formatEther(rawBalance));
    const { critical } = getTankThresholds(gasPriceWei);
    if (balance >= critical) {
      return NextResponse.json({ ok: true, skipped: 'sufficient' });
    }

    const supabase = getSupabase();

    // ── External wallets: one-time welcome drip only ──
    if (isExternal) {
      if (supabase) {
        const { data } = await supabase
          .from('profiles')
          .select('welcome_drip_sent')
          .eq('address', addrLower)
          .maybeSingle();

        if ((data as any)?.welcome_drip_sent === true) {
          return NextResponse.json({ ok: true, skipped: 'welcome_drip_used' });
        }
      }

      const account = privateKeyToAccount(pk);
      const wallet = createWalletClient({ account, chain: celo, transport: http(rpc) });
      const hash = await wallet.sendTransaction({ to: address, value: WELCOME_DRIP });

      if (supabase) {
        await supabase
          .from('profiles')
          .upsert(
            { address: addrLower, welcome_drip_sent: true },
            { onConflict: 'address' }
          );
      }

      return NextResponse.json({ ok: true, hash, welcomeDrip: true });
    }

    // ── Platform wallets (web3auth): daily claims ──
    if (supabase) {
      const { data } = await supabase
        .from('profiles')
        .select('last_fuel_claim')
        .eq('address', addrLower)
        .maybeSingle();

      if ((data as any)?.last_fuel_claim === todayUtc()) {
        return NextResponse.json({ ok: true, skipped: 'daily_limit' });
      }
    }

    const account = privateKeyToAccount(pk);
    const wallet = createWalletClient({ account, chain: celo, transport: http(rpc) });
    const hash = await wallet.sendTransaction({ to: address, value: DRIP });

    if (supabase) {
      await supabase
        .from('profiles')
        .upsert(
          { address: addrLower, last_fuel_claim: todayUtc() },
          { onConflict: 'address' }
        );
    }

    return NextResponse.json({ ok: true, hash });
  } catch (err: any) {
    console.error('[faucet]', err?.message);
    return NextResponse.json({ error: err?.message || 'Faucet error' }, { status: 500 });
  }
}
