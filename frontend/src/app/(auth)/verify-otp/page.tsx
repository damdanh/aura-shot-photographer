import { Suspense } from "react";
import VerifyOtpForm from "@/components/auth/VerifyOtpForm";

export default function VerifyOtpPage() {
  return (
    <Suspense fallback={<p className="text-slate-300">Đang tải...</p>}>
      <VerifyOtpForm />
    </Suspense>
  );
}