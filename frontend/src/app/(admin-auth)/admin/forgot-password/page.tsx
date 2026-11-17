"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import AdminAuthShell from "@/components/admin-auth/AdminAuthShell";

export default function AdminForgotPasswordPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!email) return;
    router.push(`/admin/verify-otp?email=${encodeURIComponent(email)}`);
  };

  return (
    <AdminAuthShell>
      <div className="rounded-md border border-[#50635B] bg-[#3F5448]/95 p-8 shadow-[0_18px_60px_rgba(0,0,0,0.45)]">
        <div className="mb-7 text-center">
          <p className="text-2xl text-brand-gold">↺</p>
          <h1 className="mt-2 text-4xl font-serif text-brand-gold">Khôi phục tài khoản Admin</h1>
          <p className="mt-2 text-sm text-[#BEB9AD]">
            Nhập Email quản trị để nhận mã xác minh OTP bảo mật.
          </p>
        </div>

        <form className="space-y-6" onSubmit={handleSubmit}>
          <div>
            <label className="text-xs uppercase tracking-[0.16em] text-[#D5D0C3]">
              Email khôi phục
            </label>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="admin@aurashot.com"
              className="mt-2 h-11 w-full border border-[#A3A8A3]/80 bg-[#E5E5E5] px-3 text-sm text-[#3E3E3E] outline-none"
            />
          </div>

          <button
            type="submit"
            className="h-12 w-full border border-brand-gold text-sm font-semibold uppercase tracking-[0.16em] text-brand-gold transition hover:bg-brand-gold hover:text-[#2D261A]"
          >
            Gửi mã OTP
          </button>
        </form>

        <div className="mt-5 text-center">
          <Link href="/admin/login" className="text-sm text-brand-gold hover:text-[#E5C684]">
            ← Quay lại Đăng nhập
          </Link>
        </div>
      </div>
    </AdminAuthShell>
  );
}
