import type { ReactNode } from "react";
import { CasperWalletProvider } from "../components/casper-wallet";
import { Nav } from "../components/nav";
import "./globals.css";
import { Geist } from "next/font/google";
import { cn } from "@/lib/utils";

const geist = Geist({subsets:['latin'],variable:'--font-sans'});

export const metadata = {
  title: "Cortex",
  description: "AI-underwritten invoice financing marketplace on Casper",
  manifest: "/site.webmanifest",
  icons: {
    icon: [
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" }
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }]
  }
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={cn("font-sans", geist.variable)}>
      <body>
        <CasperWalletProvider>
          <div className="min-h-dvh" id="cortex-root">
            <Nav />
            <main className="mx-auto max-w-[1160px] px-6 py-12 pb-20">{children}</main>
          </div>
        </CasperWalletProvider>
      </body>
    </html>
  );
}
