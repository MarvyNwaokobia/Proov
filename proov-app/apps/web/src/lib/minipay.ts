export function isMiniPay(): boolean {
  if (typeof window === 'undefined') return false;
  if (typeof navigator === 'undefined') return false;
  return (
    navigator.userAgent.toLowerCase().includes('minipay') ||
    !!(window as any).ethereum?.isMiniPay
  );
}

export async function connectMiniPay(): Promise<string | null> {
  if (!isMiniPay()) return null;
  const provider = (window as any).ethereum;
  if (!provider?.request) return null;
  try {
    const accounts: string[] = await provider.request({ method: 'eth_requestAccounts' });
    return accounts[0] || null;
  } catch (e) {
    console.error('MiniPay connect failed:', e);
    return null;
  }
}
