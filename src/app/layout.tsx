import type { Metadata } from "next";
import "./globals.css";
import { ToastProvider } from "@/components/ui/toast";
import { ClientLayoutWrapper } from "@/components/layout/client-layout";
export const metadata: Metadata = {
  title: "Cowbox - Self-Hosted PaaS",
  description: "Deploy and manage applications, databases, and SSL certificates with Docker and Traefik on port 9999",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="bg-slate-50/60 text-slate-900 min-h-screen flex antialiased selection:bg-pink-500 selection:text-white">
        <ToastProvider>
          <ClientLayoutWrapper>
            {children}
          </ClientLayoutWrapper>
        </ToastProvider>
      </body>
    </html>
  );
}
