import { Suspense } from "react";
import ResetPasswordForm from "@/components/auth/ResetPasswordForm";

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={(
        <main className="grid min-h-dvh place-items-center bg-[#05070c] text-sm text-slate-400">
          Đang tải biểu mẫu...
        </main>
      )}
    >
      <ResetPasswordForm />
    </Suspense>
  );
}
