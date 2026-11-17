import type { ReactNode } from "react";
import UserLoggedLayout from "@/components/user-logged/UserLoggedLayout";

export default function UserLayout({ children }: { children: ReactNode }) {
  return <UserLoggedLayout>{children}</UserLoggedLayout>;
}
