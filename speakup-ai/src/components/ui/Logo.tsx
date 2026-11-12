import Link from "next/link";

export function LogoMark({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden>
      <defs>
        <linearGradient id="lg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#3b63f6" />
          <stop offset="1" stopColor="#1f338f" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="16" fill="url(#lg)" />
      <path d="M18 22a8 8 0 0 1 8-8h14a8 8 0 0 1 8 8v12a8 8 0 0 1-8 8h-9l-8 7v-7.4A8 8 0 0 1 18 34z" fill="#fff" />
      <rect x="27" y="20" width="4" height="16" rx="2" fill="#2747e0" />
      <rect x="33" y="24" width="4" height="8" rx="2" fill="#ff9a1f" />
      <rect x="21" y="25" width="4" height="6" rx="2" fill="#2747e0" />
      <rect x="39" y="26" width="4" height="4" rx="2" fill="#2747e0" />
    </svg>
  );
}

export function Logo({ href = "/" }: { href?: string }) {
  return (
    <Link href={href} className="flex items-center gap-2 font-extrabold tracking-tight">
      <LogoMark />
      <span className="whitespace-nowrap text-lg">SpeakUp <span className="text-brand-500">AI</span></span>
    </Link>
  );
}
