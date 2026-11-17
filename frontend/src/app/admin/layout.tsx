import type { Metadata } from "next";
import type { ReactNode } from "react";
import AdminLayoutShell from "@/components/admin/AdminLayout";

export const metadata: Metadata = {
  title: "Aura Shot Super Admin",
  description: "Bảng điều khiển super admin cho Aura Shot.",
};

export default function AdminLayout({ children }: { children: ReactNode }) {
  return <AdminLayoutShell>{children}</AdminLayoutShell>;
}
