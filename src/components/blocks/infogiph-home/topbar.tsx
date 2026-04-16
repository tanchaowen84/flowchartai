import Link from 'next/link';

export function TopBar() {
  return (
    <header className="flex items-center justify-between px-6 py-3 h-[64px] shrink-0">
      <Link
        href="/"
        className="text-lg font-bold tracking-tight text-foreground hover:opacity-80 transition-opacity"
      >
        Infogiph
      </Link>

      <div className="flex items-center gap-5 text-sm">
        <Link
          href="/auth/login"
          aria-label="Account"
          className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-black text-sm font-medium text-white"
        >
          I
        </Link>
      </div>
    </header>
  );
}
