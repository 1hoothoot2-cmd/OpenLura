import Link from "next/link";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-[#050510] text-white">
      <div className="mx-auto flex min-h-screen w-full max-w-7xl items-center px-6 py-16 sm:px-8 lg:px-12">
        <div className="w-full">
          <div className="max-w-3xl">
            OpenLura
          </div>

          <h1 className="mt-6 max-w-4xl bg-gradient-to-r from-white via-white to-white/68 bg-clip-text text-4xl font-semibold tracking-tight text-transparent sm:text-5xl lg:text-6xl">
            AI that learns how you work.
          </h1>

          <p className="mt-5 max-w-2xl text-base leading-7 text-white/62 sm:text-lg">
            OpenLura is your adaptive AI workspace. It remembers useful context,
            improves through feedback, and helps you move faster with less noise.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
           <Link
  href="/chat"
  className="inline-flex h-12 items-center justify-center rounded-[18px] bg-gradient-to-r from-[#1d4ed8] to-[#3b82f6] px-6 text-sm font-medium text-white shadow-[0_12px_28px_rgba(59,130,246,0.24)] ol-interactive transition-[transform,filter,box-shadow] duration-200 hover:brightness-110 hover:shadow-[0_14px_32px_rgba(59,130,246,0.28)] active:scale-[0.99]"
>
  Start chat
</Link>

            <Link
              href="/home"
              className="inline-flex h-12 items-center justify-center rounded-[18px] border border-white/10 bg-white/[0.04] px-6 text-sm font-medium text-white/88 backdrop-blur-xl ol-interactive transition-[transform,background-color,border-color,color,box-shadow] duration-200 hover:border-white/14 hover:bg-white/[0.06] hover:text-white hover:shadow-[0_8px_18px_rgba(0,0,0,0.08)] active:scale-[0.99]"
            >
              See how it works
            </Link>
          </div>
        </div>
                    <div className="mt-10 grid w-full max-w-3xl gap-3 sm:grid-cols-3">
            <Link
              href="/chat"
              className="rounded-[20px] border border-white/10 bg-white/[0.03] px-4 py-4 text-left backdrop-blur-xl ol-interactive transition-[transform,background-color,border-color,box-shadow] duration-200 hover:-translate-y-[1px] hover:border-white/14 hover:bg-white/[0.05] hover:shadow-[0_10px_24px_rgba(0,0,0,0.12)]"
            >
              <div className="text-sm font-medium text-white">Start chat</div>
              <div className="mt-1 text-sm leading-6 text-white/46">
                Open the core assistant workspace.
              </div>
            </Link>

            <Link
              href="/home"
              className="rounded-[20px] border border-white/10 bg-white/[0.03] px-4 py-4 text-left backdrop-blur-xl ol-interactive transition-[transform,background-color,border-color,box-shadow] duration-200 hover:-translate-y-[1px] hover:border-white/14 hover:bg-white/[0.05] hover:shadow-[0_10px_24px_rgba(0,0,0,0.12)]"
            >
              <div className="text-sm font-medium text-white">How it works</div>
              <div className="mt-1 text-sm leading-6 text-white/46">
                Learn how OpenLura adapts, remembers, and improves.
              </div>
            </Link>

            <Link
              href="/home"
              className="rounded-[20px] border border-white/10 bg-white/[0.03] px-4 py-4 text-left backdrop-blur-xl ol-interactive transition-[transform,background-color,border-color,box-shadow] duration-200 hover:-translate-y-[1px] hover:border-white/14 hover:bg-white/[0.05] hover:shadow-[0_10px_24px_rgba(0,0,0,0.12)]"
            >
              <div className="text-sm font-medium text-white">Use cases</div>
              <div className="mt-1 text-sm leading-6 text-white/46">
                Explore what you can do with OpenLura.
              </div>
            </Link>
          </div>

          {/* PRODUCT OVERVIEW */}
          <div className="mt-16 w-full max-w-5xl">
            <div className="mb-6">
              <h2 className="text-xl font-semibold text-white/92">
                How OpenLura works
              </h2>
              <p className="mt-2 text-sm text-white/50">
                Built to adapt, remember, and improve over time.
              </p>
            </div>

            <div className="grid gap-5 md:grid-cols-3">
              <div className="min-w-0 rounded-[22px] border border-white/10 bg-white/[0.03] p-5 backdrop-blur-xl">
                <div className="text-sm font-medium text-white">
                  Learns from context
                </div>
                <p className="mt-2 text-sm leading-6 text-white/46 break-normal">
                  Understands your conversations and builds useful context over time.
                </p>
              </div>

              <div className="min-w-0 rounded-[22px] border border-white/10 bg-white/[0.03] p-5 backdrop-blur-xl">
                <div className="text-sm font-medium text-white">
                  Improves with feedback
                </div>
                <p className="mt-2 text-sm leading-6 text-white/46 break-normal">
                  Uses your feedback to continuously refine how it responds.
                </p>
              </div>

              <div className="min-w-0 rounded-[22px] border border-white/10 bg-white/[0.03] p-5 backdrop-blur-xl">
                <div className="text-sm font-medium text-white">
                  Personal by design
                </div>
                <p className="mt-2 text-sm leading-6 text-white/46 break-normal">
                  Adapts to your style, preferences, and workflows.
                </p>
              </div>
            </div>
          </div>
        </div>
    </main>
  );
}