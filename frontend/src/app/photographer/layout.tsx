import type { ReactNode } from "react";
import PhotographerLayout from "@/components/photographer/PhotographerLayout";

export default function Layout({ children }: { children: ReactNode }) {
  return <PhotographerLayout>{children}</PhotographerLayout>;
}
