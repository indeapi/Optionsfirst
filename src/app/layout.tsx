import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ThemeScript } from "@/components/shell/ThemeScript";
import { AppFrame } from "@/components/shell/AppFrame";

export const metadata: Metadata = {
  title: "Options First — Options Analytics for US & India",
  description:
    "Industrial-grade options analytics across US (IBKR) and Indian (Zerodha Kite) markets. World-class OI, straddle and payoff visualisation, ranked strategies, and the Hermes multi-agent desk.",
  applicationName: "Options First",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f7f9fc" },
    { media: "(prefers-color-scheme: dark)", color: "#0e1626" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <ThemeScript />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="font-sans antialiased">
        <AppFrame>{children}</AppFrame>
      </body>
    </html>
  );
}
