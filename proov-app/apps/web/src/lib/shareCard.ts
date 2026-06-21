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

  const accent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#6366f1';
  const accentBg = getComputedStyle(document.documentElement).getPropertyValue('--accent-bg').trim() || 'rgba(99,102,241,0.1)';

  const div = document.createElement('div');
  div.style.cssText = `
    position:fixed;left:-9999px;top:-9999px;
    width:400px;height:440px;
    background:linear-gradient(145deg,#0a0a12,#111128);
    border-radius:28px;display:flex;flex-direction:column;
    align-items:center;justify-content:center;
    font-family:'Inter',system-ui,sans-serif;color:white;padding:2.5rem 2rem;
    text-align:center;overflow:hidden;position:relative;
  `;
  const categoryEmojis = [...new Set(params.categories)].slice(0, 5).join('  ');
  const isMajor = params.streak >= 30;
  div.innerHTML = `
    <div style="position:absolute;inset:0;background:radial-gradient(circle at 30% 20%,${accent}22,transparent 50%),radial-gradient(circle at 70% 80%,${accent}15,transparent 50%);pointer-events:none;"></div>
    <div style="position:relative;z-index:1;display:flex;flex-direction:column;align-items:center;">
      <div style="font-size:${isMajor ? 80 : 68}px;font-weight:900;letter-spacing:-4px;margin-bottom:4px;
        background:linear-gradient(135deg,${accent},#f59e0b);
        -webkit-background-clip:text;-webkit-text-fill-color:transparent;line-height:1;">
        ${params.streak}
      </div>
      <div style="font-size:16px;font-weight:700;margin-bottom:6px;opacity:.85;letter-spacing:1px;text-transform:uppercase;">day streak 🔥</div>
      <div style="font-size:14px;opacity:.45;margin-bottom:20px;font-weight:500;">@${params.username}</div>
      ${categoryEmojis ? `<div style="font-size:24px;margin-bottom:20px;letter-spacing:4px;">${categoryEmojis}</div>` : ''}
      <div style="display:flex;gap:16px;margin-bottom:24px;">
        <div style="background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);border-radius:12px;padding:10px 16px;text-align:center;">
          <div style="font-size:20px;font-weight:800;line-height:1;">${params.streak}</div>
          <div style="font-size:9px;opacity:.4;margin-top:3px;text-transform:uppercase;letter-spacing:1px;">days</div>
        </div>
        <div style="background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);border-radius:12px;padding:10px 16px;text-align:center;">
          <div style="font-size:20px;font-weight:800;line-height:1;">${params.categories.length}</div>
          <div style="font-size:9px;opacity:.4;margin-top:3px;text-transform:uppercase;letter-spacing:1px;">habits</div>
        </div>
      </div>
      <div style="
        background:${accent}20;border:1px solid ${accent}40;
        border-radius:24px;padding:8px 22px;
        font-size:12px;font-weight:700;color:${accent};letter-spacing:.5px;">
        proov.app
      </div>
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
