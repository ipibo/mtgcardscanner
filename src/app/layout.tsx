import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import { BottomNav } from "@/components/BottomNav";
import { ServiceWorkerRegistrar } from "@/components/ServiceWorkerRegistrar";

const geist = Geist({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "MTG Collection",
  description: "Scan and manage your Magic: The Gathering card collection",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "MTGScan",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#7c3aed",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className={`${geist.className} min-h-screen bg-background text-foreground`}>
        <main className="mx-auto max-w-lg pb-20 pt-4 px-4">
          {children}
        </main>
        <BottomNav />
        <ServiceWorkerRegistrar />
      </body>
    </html>
  );
}
