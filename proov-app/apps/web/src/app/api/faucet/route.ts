import { NextRequest, NextResponse } from 'next/server';
import { createWalletClient, createPublicClient, http, parseEther, isAddress } from 'viem';
import { celo } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';

// Each Celo L2 tx costs ~0.005–0.009 CELO. 0.2 CELO ≈ 20 transactions.
// Only drip if user genuinely can't afford a transaction (< 0.02 CELO = ~2 txs left).
const DRIP = parseEther('0.2');
const MIN_BALANCE = parseEther('0.02');
const COOLDOWN_MS = 24 * 60 * 60 * 1000;

// Module-level rate limit — persists across requests in same function instance
const lastClaim = new Map<string, number>();

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

    const addr = address.toLowerCase();
    const last = lastClaim.get(addr) ?? 0;
    if (Date.now() - last < COOLDOWN_MS) {
      return NextResponse.json({ ok: true, skipped: 'cooldown' });
    }

    const rpc = process.env.NEXT_PUBLIC_CELO_RPC_URL || 'https://forno.celo.org';
    const publicClient = createPublicClient({ chain: celo, transport: http(rpc) });

    const balance = await publicClient.getBalance({ address });
    if (balance >= MIN_BALANCE) {
      return NextResponse.json({ ok: true, skipped: 'sufficient' });
    }

    const account = privateKeyToAccount(pk);
    const wallet = createWalletClient({ account, chain: celo, transport: http(rpc) });

    const hash = await wallet.sendTransaction({ to: address, value: DRIP });
    lastClaim.set(addr, Date.now());

    return NextResponse.json({ ok: true, hash });
  } catch (err: any) {
    console.error('[faucet]', err?.message);
    return NextResponse.json({ error: err?.message || 'Faucet error' }, { status: 500 });
  }
}
