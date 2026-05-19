export function getPostLoginRoute(): string {
  if (typeof window === 'undefined') return '/dashboard';

  const username = localStorage.getItem('proov_username');
  const address = localStorage.getItem('proov_address') || '';

  const hasUsername = !!username || (() => {
    try {
      const raw = localStorage.getItem(`proov_username_${address.toLowerCase()}`);
      return !!(raw && JSON.parse(raw).username);
    } catch { return false; }
  })();

  if (!hasUsername) return '/username-setup';

  const tutorialDone = localStorage.getItem('proov_tutorial_done');
  if (!tutorialDone) return '/tutorial';

  return '/dashboard';
}
