import Link from 'next/link';

export const metadata = {
  title: 'Terms of Service — Proov',
};

export default function TermsPage() {
  return (
    <div style={{ maxWidth: 680, margin: '0 auto', padding: '2rem 1.25rem 4rem', color: 'var(--text)', fontFamily: 'inherit' }}>
      <Link href="/settings" style={{ fontSize: 13, color: 'var(--accent-text)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4, marginBottom: '1.5rem' }}>
        ← Back
      </Link>

      <h1 style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-.5px', marginBottom: 6 }}>Terms of Service</h1>
      <p style={{ fontSize: 12, color: 'var(--text3)', marginBottom: '2rem' }}>Effective: 1 June 2026</p>

      <section style={{ marginBottom: '1.75rem' }}>
        <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>1. Acceptance</h2>
        <p style={{ fontSize: 14, lineHeight: 1.7, color: 'var(--text2)' }}>
          By accessing or using Proov ("the App"), you agree to be bound by these Terms of Service. If you do not agree, do not use the App.
        </p>
      </section>

      <section style={{ marginBottom: '1.75rem' }}>
        <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>2. Description of Service</h2>
        <p style={{ fontSize: 14, lineHeight: 1.7, color: 'var(--text2)' }}>
          Proov is a habit-tracking and accountability application that records activity on the Celo blockchain. The App allows users to create habits, log completions, participate in accountability circles, and view onchain proof of their discipline.
        </p>
      </section>

      <section style={{ marginBottom: '1.75rem' }}>
        <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>3. Blockchain Transactions</h2>
        <p style={{ fontSize: 14, lineHeight: 1.7, color: 'var(--text2)' }}>
          Certain actions (e.g. creating habits, completing them) write data to the Celo blockchain. These transactions are irreversible. Network fees (paid in cUSD or CELO) apply and are your responsibility. Proov does not control the blockchain and is not liable for failed or reverted transactions.
        </p>
      </section>

      <section style={{ marginBottom: '1.75rem' }}>
        <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>4. User Accounts</h2>
        <p style={{ fontSize: 14, lineHeight: 1.7, color: 'var(--text2)' }}>
          You are responsible for maintaining control of your wallet or account credentials. Proov is not liable for losses resulting from unauthorised access. One wallet address corresponds to one Proov account.
        </p>
      </section>

      <section style={{ marginBottom: '1.75rem' }}>
        <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>5. Acceptable Use</h2>
        <p style={{ fontSize: 14, lineHeight: 1.7, color: 'var(--text2)' }}>
          You agree not to: (a) use the App for any unlawful purpose; (b) submit false habit completions or attempt to manipulate the verification system; (c) interfere with the App's infrastructure or other users' experience.
        </p>
      </section>

      <section style={{ marginBottom: '1.75rem' }}>
        <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>6. AI Features</h2>
        <p style={{ fontSize: 14, lineHeight: 1.7, color: 'var(--text2)' }}>
          The App uses AI to suggest habits and verify proof submissions. AI outputs are not guaranteed to be accurate. Decisions made by AI are advisory only; final determination is yours.
        </p>
      </section>

      <section style={{ marginBottom: '1.75rem' }}>
        <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>7. Disclaimers</h2>
        <p style={{ fontSize: 14, lineHeight: 1.7, color: 'var(--text2)' }}>
          The App is provided "as is" without warranties of any kind. We do not guarantee uptime, data persistence, or fitness for a particular purpose. Use the App at your own risk.
        </p>
      </section>

      <section style={{ marginBottom: '1.75rem' }}>
        <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>8. Limitation of Liability</h2>
        <p style={{ fontSize: 14, lineHeight: 1.7, color: 'var(--text2)' }}>
          To the maximum extent permitted by law, Proov and its contributors shall not be liable for indirect, incidental, or consequential damages arising from your use of the App.
        </p>
      </section>

      <section style={{ marginBottom: '1.75rem' }}>
        <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>9. Changes</h2>
        <p style={{ fontSize: 14, lineHeight: 1.7, color: 'var(--text2)' }}>
          We may update these Terms at any time. Continued use of the App after changes constitutes acceptance of the new Terms.
        </p>
      </section>

      <section>
        <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>10. Contact</h2>
        <p style={{ fontSize: 14, lineHeight: 1.7, color: 'var(--text2)' }}>
          Questions? Reach us on <a href="https://t.me/ProovApp" style={{ color: 'var(--accent-text)' }}>Telegram @ProovApp</a>.
        </p>
      </section>
    </div>
  );
}
