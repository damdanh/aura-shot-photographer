import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({
  subsets: ["vietnamese"],
  weight: ["300", "400", "500", "600", "700", "800"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Aura Shot - Không gian nhiếp ảnh chuyên nghiệp",
  description: "Trang đặt lịch, lưu trữ ảnh và mua bán dịch vụ nhiếp ảnh chuyên nghiệp Aura Shot",
  icons: {
    icon: "/auth/logo.jpg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi" className={`${jakarta.className} h-full antialiased`}>
      <head>
        <link rel="icon" href="/auth/logo.jpg" />
        <link rel="shortcut icon" href="/auth/logo.jpg" />
      </head>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}

