export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-[#050510] text-white px-6 py-14 sm:px-8">
      <div className="mx-auto max-w-2xl">
        <div className="flex items-center gap-3 mb-10">
          <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-[14px] border border-[#3b82f6]/18 bg-[radial-gradient(circle_at_30%_30%,rgba(96,165,250,0.16),rgba(29,78,216,0.06)_52%,transparent_78%)]">
            <img src="/openlura-logo.png" alt="OpenLura" className="h-full w-full object-contain" />
          </div>
          <div>
            <div className="text-sm font-semibold text-white/94">OpenLura</div>
            <div className="text-[10px] uppercase tracking-[0.18em] text-white/36">Privacy Policy</div>
          </div>
        </div>

        <h1 className="text-3xl font-semibold tracking-tight text-white/95 mb-2">Privacy Policy</h1>
        <p className="text-sm text-white/40 mb-10">Last updated: April 2026</p>

        <div className="space-y-8 text-sm leading-7 text-white/70">

          <section>
            <h2 className="text-base font-medium text-white/90 mb-3">1. What we collect</h2>
            <p>OpenLura collects the information you provide when creating an account, including your email address. We also store chat history, memory items, and preferences tied to your account to provide a personalized workspace experience.</p>
          </section>

          <section>
            <h2 className="text-base font-medium text-white/90 mb-3">2. How we use your data</h2>
            <p>Your data is used solely to provide and improve the OpenLura service. Chat history and memory are used to personalize your AI experience. We do not sell your data to third parties.</p>
          </section>

          <section>
            <h2 className="text-base font-medium text-white/90 mb-3">3. Data storage</h2>
            <p>Your data is stored securely using Supabase infrastructure. Account data and personal workspace content are tied to your account and separated from other users.</p>
          </section>

          <section>
            <h2 className="text-base font-medium text-white/90 mb-3">4. Third-party services</h2>
            <p>OpenLura uses Google OAuth for authentication. When you sign in with Google, Google may collect data in accordance with their own privacy policy. We only receive your email address and basic profile information from Google.</p>
          </section>

          <section>
            <h2 className="text-base font-medium text-white/90 mb-3">5. Your rights</h2>
            <p>You can request deletion of your account and associated data at any time by contacting us. You own your workspace content and can export it at any time using the export feature in the chat.</p>
          </section>

          <section>
            <h2 className="text-base font-medium text-white/90 mb-3">6. Contact</h2>
            <p>For privacy-related questions, contact us at: <a href="mailto:1hoothoot2@gmail.com" className="text-blue-400 hover:text-blue-300 transition-colors">1hoothoot2@gmail.com</a></p>
          </section>

        </div>

        <div className="mt-12 pt-8 border-t border-white/8">
          <a href="/" className="text-sm text-white/40 hover:text-white/70 transition-colors">← Terug naar home</a>
        </div>
      </div>
    </main>
  );
}