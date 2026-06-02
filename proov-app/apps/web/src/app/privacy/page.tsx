import Link from 'next/link';

export const metadata = {
  title: 'Privacy Policy — Proov',
};

export default function PrivacyPage() {
  return (
    <div style={{ maxWidth: 680, margin: '0 auto', padding: '2rem 1.25rem 4rem', color: 'var(--text)', fontFamily: 'inherit' }}>
      <Link href="/settings" style={{ fontSize: 13, color: 'var(--accent-text)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4, marginBottom: '1.5rem' }}>
        ← Back
      </Link>

      <h1 style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-.5px', marginBottom: 6 }}>Privacy Policy</h1>
      <p style={{ fontSize: 12, color: 'var(--text3)', marginBottom: '2rem' }}>Effective: 1 June 2026</p>

      <section style={{ marginBottom: '1.75rem' }}>
        <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>1. Data We Collect</h2>
        <p style={{ fontSize: 14, lineHeight: 1.7, color: 'var(--text2)' }}>
          <strong style={{ color: 'var(--text)' }}>Wallet address.</strong> Your Celo wallet address is used as your account identifier. It is stored in our database and written to the blockchain.
        </p>
        <p style={{ fontSize: 14, lineHeight: 1.7, color: 'var(--text2)', marginTop: 8 }}>
          <strong style={{ color: 'var(--text)' }}>Username.</strong> An optional display name you choose. Stored in our database and onchain.
        </p>
        <p style={{ fontSize: 14, lineHeight: 1.7, color: 'var(--text2)', marginTop: 8 }}>
          <strong style={{ color: 'var(--text)' }}>Email address.</strong> Collected only if you sign in via Google or email magic link. Used for authentication and optional notifications. Never sold or shared with third parties.
        </p>
        <p style={{ fontSize: 14, lineHeight: 1.7, color: 'var(--text2)', marginTop: 8 }}>
          <strong style={{ color: 'var(--text)' }}>Habit and activity data.</strong> Habit names, completion records, streak counts, and focus session logs. Stored in our database and/or on the Celo blockchain (public).
        </p>
        <p style={{ fontSize: 14, lineHeight: 1.7, color: 'var(--text2)', marginTop: 8 }}>
          <strong style={{ color: 'var(--text)' }}>Proof media.</strong> Photos or text submitted as habit verification. Stored securely in our database; only shared with circle members you have connected with.
        </p>
        <p style={{ fontSize: 14, lineHeight: 1.7, color: 'var(--text2)', marginTop: 8 }}>
          <strong style={{ color: 'var(--text)' }}>Usage data.</strong> Aggregate analytics (page views, feature usage) to improve the App. No personally identifiable data is included in analytics.
        </p>
      </section>

      <section style={{ marginBottom: '1.75rem' }}>
        <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>2. How We Use Your Data</h2>
        <p style={{ fontSize: 14, lineHeight: 1.7, color: 'var(--text2)' }}>
          We use your data to: provide and improve the App; send optional notifications (if enabled); display your progress and leaderboard rank; and detect abuse or fraud.
        </p>
      </section>

      <section style={{ marginBottom: '1.75rem' }}>
        <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>3. Blockchain Data</h2>
        <p style={{ fontSize: 14, lineHeight: 1.7, color: 'var(--text2)' }}>
          Data written to the Celo blockchain (habit IDs, completion events, circle interactions) is permanently public and cannot be deleted. This is an inherent property of blockchain technology.
        </p>
      </section>

      <section style={{ marginBottom: '1.75rem' }}>
        <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>4. Third-Party Services</h2>
        <p style={{ fontSize: 14, lineHeight: 1.7, color: 'var(--text2)' }}>
          We use Supabase for database storage, Web3Auth for social login (optional), and Celo blockchain infrastructure. Each service has its own privacy policy. We do not sell your data to any third party.
        </p>
      </section>

      <section style={{ marginBottom: '1.75rem' }}>
        <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>5. Data Retention</h2>
        <p style={{ fontSize: 14, lineHeight: 1.7, color: 'var(--text2)' }}>
          Off-chain data (email, username, avatar) can be deleted on request. Onchain data cannot be deleted. To request deletion of off-chain data, contact us via Telegram.
        </p>
      </section>

      <section style={{ marginBottom: '1.75rem' }}>
        <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>6. Your Rights</h2>
        <p style={{ fontSize: 14, lineHeight: 1.7, color: 'var(--text2)' }}>
          Depending on your jurisdiction, you may have rights to access, correct, or delete your personal data. Contact us to exercise these rights.
        </p>
      </section>

      <section style={{ marginBottom: '1.75rem' }}>
        <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>7. Children</h2>
        <p style={{ fontSize: 14, lineHeight: 1.7, color: 'var(--text2)' }}>
          The App is not directed at children under 13. We do not knowingly collect data from children under 13.
        </p>
      </section>

      <section>
        <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>8. Contact</h2>
        <p style={{ fontSize: 14, lineHeight: 1.7, color: 'var(--text2)' }}>
          Privacy questions? Reach us on <a href="https://t.me/ProovApp" style={{ color: 'var(--accent-text)' }}>Telegram @ProovApp</a>.
        </p>
      </section>
    </div>
  );
}
