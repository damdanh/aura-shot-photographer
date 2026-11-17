"use client";

import ThemeToggle from "@/components/shared/ThemeToggle";
import NotificationBell from "@/components/photographer/NotificationBell";

type HeaderProps = {
  title: string;
  description: string;
};

export default function Header({ title, description }: HeaderProps) {
  return (
    <div className="mb-6 space-y-4 sm:mb-8 sm:flex sm:items-start sm:justify-between sm:space-y-0">
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-violet-300/80">Trang quản trị</p>
        <h1 className="mt-1 text-2xl font-bold text-white sm:mt-2 sm:text-3xl md:text-4xl">{title}</h1>
        <p className="mt-1.5 max-w-2xl text-xs sm:text-sm leading-relaxed text-slate-400">{description}</p>
      </div>

      <div className="hidden sm:flex items-center gap-2 pt-1 shrink-0">
        <ThemeToggle />
        <NotificationBell />
      </div>
    </div>
  );
}

