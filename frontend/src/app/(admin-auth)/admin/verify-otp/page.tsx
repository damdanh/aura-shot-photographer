"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import AdminAuthShell from "@/components/admin-auth/AdminAuthShell";

export default function AdminVerifyOtpPage() {
  const router = useRouter();
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const otpValue = useMemo(() => otp.join(""), [otp]);

  const handleChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    const next = [...otp];
    next[index] = value.slice(-1);
    setOtp(next);
    if (value && index < 5) inputRefs.current[index + 1]?.focus();
  };

  const handleKeyDown = (index: number, event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Backspace" && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (otpValue.length !== 6) return;
    router.push("/admin/reset-password");
  };

  return (
    <AdminAuthShell>
      <div className="rounded-md border border-[#50635B] bg-[#3A4D44]/95 p-8 shadow-[0_18px_60px_rgba(0,0,0,0.45)]">
        <div className="mb-7 text-center">
          <p className="text-2xl text-brand-gold">◈</p>
          <h1 className="mt-2 text-4xl font-serif text-brand-gold">Xác thực 2 lớp (2FA)</h1>
          <p className="mt-2 text-sm text-[#BEB9AD]">
            Mã xác minh 6 số đã được gửi vào hòm thư Admin của bạn.
          </p>
        </div>

        <form className="space-y-6" onSubmit={handleSubmit}>
          <div className="grid grid-cols-6 gap-2">
            {otp.map((digit, index) => (
              <input
                key={index}
                ref={(el) => {
                  inputRefs.current[index] = el;
                }}
                value={digit}
                maxLength={1}
                onChange={(event) => handleChange(index, event.target.value)}
                onKeyDown={(event) => handleKeyDown(index, event)}
                className="h-14 w-full border border-[#6B7D73] bg-[#07090D] text-center text-xl font-semibold text-[#EFE8DA] outline-none focus:border-brand-gold"
              />
            ))}
          </div>

          <button
            type="submit"
            className="h-12 w-full rounded-sm bg-brand-gold text-sm font-semibold uppercase tracking-[0.16em] text-[#2D261A] transition hover:bg-[#E5C684]"
          >
            Xác nhận mã
          </button>
        </form>

        <p className="mt-5 text-center text-sm text-[#BEB9AD]">⦿ Mã sẽ hết hạn sau 01:59</p>
        <div className="mt-6 border-t border-[#55635D] pt-6 text-center">
          <button type="button" className="text-sm text-brand-gold hover:text-[#E5C684]">
            Gửi lại mã xác nhận
          </button>
        </div>
      </div>
    </AdminAuthShell>
  );
}
