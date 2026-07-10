import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Sidebar from "@/components/sidebar";
import ServiceWorkerRegister from "@/components/service-worker-register";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
});

export const metadata: Metadata = {
  title: "Silva & Yoga - Personal Finance Management System",
  description: "Ultimate Precision Financial Management System",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id" className="h-full scroll-smooth">
      <body className={`${inter.variable} font-sans min-h-screen bg-[#f7f9fb] text-[#191c1e] antialiased`}>
        <ServiceWorkerRegister />
        <div className="flex min-h-screen flex-col md:flex-row">
          <Sidebar />
          <main className="flex-1 md:pl-64 pt-16 md:pt-0">
            <div className="p-3 md:p-8 max-w-7xl mx-auto w-full">
              {children}
            </div>
          </main>
        </div>
      </body>
    </html>
  );
}
