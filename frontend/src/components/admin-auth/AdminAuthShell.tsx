import type { ReactNode } from "react";
import Link from "next/link";

type AdminAuthShellProps = {
  children: ReactNode;
};

export default function AdminAuthShell({ children }: AdminAuthShellProps) {
  return (
    <div className="min-h-screen w-full bg-[#06080D] text-[#E8DED3] flex flex-col">
      <header className="h-14 border-b border-[#1D2129] bg-gradient-to-r from-[#0E1118] via-[#12151D] to-[#0E1118]">
        <div className="mx-auto flex h-full w-full max-w-[1400px] items-center justify-between px-6">
          <p className="text-5xl leading-none text-brand-gold-dark font-serif">AURASHOT</p>
          <span className="text-brand-gold-dark text-lg">🔒</span>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-[460px]">{children}</div>
      </main>

      <footer className="border-t border-[#1D2129] bg-brand-bg">
        <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-3 px-6 py-5 text-xs text-[#8C877F] md:flex-row md:items-center md:justify-between">
          <p className="text-brand-gold-dark text-4xl leading-none font-serif">AURA SHOT</p>
          <p>© 2024 AURA SHOT ADMIN PORTAL. SECURED ACCESS ONLY.</p>
          <div className="flex items-center gap-6">
            <Link href="#" className="text-[#B3ACA1] hover:text-brand-gold">
              Security Policy
            </Link>
            <Link href="#" className="text-[#B3ACA1] hover:text-brand-gold">
              Support
            </Link>
            <Link href="#" className="text-[#B3ACA1] hover:text-brand-gold">
              Terms
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
