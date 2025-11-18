import Link from "next/link";

export default function HomePage() {
  return (
    <div className="flex flex-col gap-12 md:gap-16">
      {/* Hero Section */}
      <section className="flex flex-col items-center justify-center gap-6 text-center">
        <h1 className="text-4xl font-bold md:text-5xl lg:text-6xl">
          Ledger Framework
        </h1>
        <p className="text-lg text-muted-foreground md:text-xl max-w-2xl">
          Standalone framework for building custom Onoal ledgers. Modular,
          extensible, and type-safe.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-4">
          <Link
            href="/docs"
            className="inline-flex items-center justify-center rounded-lg bg-primary px-6 py-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Get Started
          </Link>
          <Link
            href="/docs/introduction"
            className="inline-flex items-center justify-center rounded-lg border border-input bg-background px-6 py-3 text-sm font-medium transition-colors hover:bg-accent"
          >
            Documentation
          </Link>
        </div>
      </section>

      {/* Features Section */}
      <section className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <div className="flex flex-col gap-2 rounded-lg border p-6">
          <div className="text-2xl mb-2">🚀</div>
          <h3 className="text-lg font-semibold">Standalone Framework</h3>
          <p className="text-sm text-muted-foreground">
            Build custom ledgers without depending on the main Onoal
            ledger. Perfect for specialized use cases.
          </p>
        </div>

        <div className="flex flex-col gap-2 rounded-lg border p-6">
          <div className="text-2xl mb-2">🔌</div>
          <h3 className="text-lg font-semibold">Modular Architecture</h3>
          <p className="text-sm text-muted-foreground">
            Plug-and-play modules, adapters, and plugins. Mix and match what you
            need.
          </p>
        </div>

        <div className="flex flex-col gap-2 rounded-lg border p-6">
          <div className="text-2xl mb-2">💾</div>
          <h3 className="text-lg font-semibold">Database Agnostic</h3>
          <p className="text-sm text-muted-foreground">
            Use SQLite for development, PostgreSQL or D1 for production. Switch adapters
            without changing code.
          </p>
        </div>

        <div className="flex flex-col gap-2 rounded-lg border p-6">
          <div className="text-2xl mb-2">🔒</div>
          <h3 className="text-lg font-semibold">Type-Safe</h3>
          <p className="text-sm text-muted-foreground">
            Full TypeScript support with comprehensive type definitions and
            IntelliSense.
          </p>
        </div>

        <div className="flex flex-col gap-2 rounded-lg border p-6">
          <div className="text-2xl mb-2">🌐</div>
          <h3 className="text-lg font-semibold">Edge-Ready</h3>
          <p className="text-sm text-muted-foreground">
            Deploy to Cloudflare Workers, Node.js, or any edge runtime. Built
            for scale.
          </p>
        </div>

        <div className="flex flex-col gap-2 rounded-lg border p-6">
          <div className="text-2xl mb-2">🛠️</div>
          <h3 className="text-lg font-semibold">Developer Experience</h3>
          <p className="text-sm text-muted-foreground">
            CLI tool for scaffolding, comprehensive docs, and examples. Get
            started in minutes.
          </p>
        </div>
      </section>
    </div>
  );
}
