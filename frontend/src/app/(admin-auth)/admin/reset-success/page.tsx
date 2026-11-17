import Link from "next/link";
import AdminAuthShell from "@/components/admin-auth/AdminAuthShell";

export default function AdminResetSuccessPage() {
  return (
    <AdminAuthShell>
      <div className="rounded-md border border-[#55675E] bg-[#41564B]/95 p-8 text-center shadow-[0_18px_60px_rgba(0,0,0,0.45)]">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-xl border border-[#728478] text-3xl text-brand-gold">
          ✓
        </div>
        <h1 className="text-5xl font-serif text-brand-gold">Cập nhật thành công!</h1>
        <p className="mx-auto mt-4 max-w-sm text-lg leading-relaxed text-[#D8D2C6]">
          Mật khẩu quản trị đã được thay đổi. Hệ thống sẽ tự động chuyển về trang đăng nhập.
        </p>

        <div className="mx-auto mt-8 h-px w-full max-w-[260px] bg-[#C5A059]/60" />

        <Link
          href="/admin/login"
          className="mt-8 inline-flex h-12 w-full max-w-[320px] items-center justify-center rounded-sm bg-brand-gold text-sm font-semibold uppercase tracking-[0.16em] text-[#2D261A] transition hover:bg-[#E5C684]"
        >
          Đăng nhập ngay →
        </Link>
      </div>
    </AdminAuthShell>
  );
}
