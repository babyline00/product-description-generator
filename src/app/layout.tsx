import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Product Description Generator",
  description:
    "Bulk product description generator for e-commerce — upload a CSV of SKUs + specs, get SEO-optimized descriptions per product with tone presets, A/B variants, and CSV export.",
  keywords: [
    "product descriptions",
    "e-commerce",
    "SEO copywriting",
    "LLM",
    "bulk generation",
    "Next.js",
    "tone presets",
    "A/B variants",
  ],
  authors: [{ name: "Product Description Generator" }],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        {children}
        <Toaster richColors position="top-right" />
      </body>
    </html>
  );
}
