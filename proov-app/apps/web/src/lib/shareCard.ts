// Dynamic import of html2canvas to avoid SSR issues
export const SHARE_MILESTONES = [7, 21, 30, 50, 75, 100];

export function isMilestone(streak: number): boolean {
  return SHARE_MILESTONES.includes(streak);
}

export async function generateStreakCard(params: {
  username: string;
  streak: number;
  categories: string[];
}): Promise<string> {
  const { default: html2canvas } = await import('html2canvas');

  const div = document.createElement('div');
  div.style.cssText = `
    position:fixed;left:-9999px;top:-9999px;
    width:400px;height:400px;
    background:linear-gradient(135deg,#09090f,#1a0635);
    border-radius:24px;display:flex;flex-direction:column;
    align-items:center;justify-content:center;
    font-family:'Inter',sans-serif;color:white;padding:2rem;
    text-align:center;
  `;
  const categoryEmojis = params.categories.slice(0, 4).join(' ');
  div.innerHTML = `
    <div style="font-size:64px;margin-bottom:16px">🔥</div>
    <div style="font-size:72px;font-weight:700;letter-spacing:-3px;margin-bottom:8px;
      background:linear-gradient(135deg,#f59e0b,#f97316);
      -webkit-background-clip:text;-webkit-text-fill-color:transparent;">
      ${params.streak}
    </div>
    <div style="font-size:18px;font-weight:600;margin-bottom:4px;opacity:.9">day streak</div>
    <div style="font-size:14px;opacity:.5;margin-bottom:24px">@${params.username}</div>
    <div style="font-size:28px;margin-bottom:24px">${categoryEmojis || '🔥'}</div>
    <div style="
      background:rgba(99,102,241,.2);border:1px solid rgba(99,102,241,.3);
      border-radius:20px;padding:8px 20px;
      font-size:13px;font-weight:600;color:#a5b4fc;letter-spacing:.3px;">
      proov.app
    </div>
  `;
  document.body.appendChild(div);
  try {
    const canvas = await html2canvas(div, { backgroundColor: null, scale: 2, useCORS: true });
    return canvas.toDataURL('image/png');
  } finally {
    document.body.removeChild(div);
  }
}

export function shareToTwitter(streak: number, username: string) {
  const text = encodeURIComponent(
    `🔥 ${streak} day streak on Proov\n\nDo the work. Own the proof.\n\nproov.app`
  );
  window.open(`https://twitter.com/intent/tweet?text=${text}`, '_blank');
}

export function downloadCard(dataUrl: string, filename: string) {
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = filename;
  a.click();
}
