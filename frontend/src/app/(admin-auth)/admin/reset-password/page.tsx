"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import AdminAuthShell from "@/components/admin-auth/AdminAuthShell";

function Eye({ visible }: { visible: boolean }) {
  return <span className="text-[#999183]">{visible ? "🙈" : "👁️"}</span>;
}

export default function AdminResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!password || !confirm) return;
    if (password !== confirm) return;
    router.push("/admin/reset-success");
  };

  return (
    <AdminAuthShell>
      <div className="rounded-md border border-[#4D4130] bg-[#101116]/95 p-8 shadow-[0_18px_60px_rgba(0,0,0,0.45)]">
        <div className="mb-6">
          <h1 className="text-4xl font-serif text-[#E8DED3]">Thiết lập mật khẩu mới</h1>
          <p className="mt-2 text-sm text-[#A7A092]">
            Mật khẩu mới phải bao gồm ít nhất 8 ký tự, 1 chữ hoa và 1 số.
          </p>
        </div>

        <form className="space-y-6" onSubmit={handleSubmit}>
          <div>
            <label className="text-xs uppercase tracking-[0.16em] text-brand-gold">Mật khẩu mới</label>
            <div className="mt-2 flex items-center border-0 border-b border-[#564E41]">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="••••••••"
                className="h-11 flex-1 bg-transparent text-sm text-[#EFE8DA] outline-none placeholder:text-[#8D8A80]"
              />
              <button type="button" onClick={() => setShowPassword((prev) => !prev)}>
                <Eye visible={showPassword} />
              </button>
            </div>
          </div>

          <div>
            <label className="text-xs uppercase tracking-[0.16em] text-brand-gold">
              Xác nhận mật khẩu
            </label>
            <div className="mt-2 flex items-center border-0 border-b border-[#564E41]">
              <input
                type={showConfirm ? "text" : "password"}
                value={confirm}
                onChange={(event) => setConfirm(event.target.value)}
                placeholder="••••••••"
                className="h-11 flex-1 bg-transparent text-sm text-[#EFE8DA] outline-none placeholder:text-[#8D8A80]"
              />
              <button type="button" onClick={() => setShowConfirm((prev) => !prev)}>
                <Eye visible={showConfirm} />
              </button>
            </div>
          </div>

          <button
            type="submit"
            className="h-12 w-full rounded-sm bg-brand-gold text-sm font-semibold uppercase tracking-[0.16em] text-[#2D261A] transition hover:bg-[#E5C684]"
          >
            Cập nhật tài khoản
          </button>
        </form>

        <div className="mt-6 text-center">
          <Link href="/admin/login" className="text-sm text-[#B6B1A4] hover:text-brand-gold">
            Hủy & quay lại Đăng nhập
          </Link>
        </div>
      </div>
    </AdminAuthShell>
  );
}
