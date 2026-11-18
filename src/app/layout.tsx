import "./globals.css";
import type { Metadata, Viewport } from "next";
import { DM_Sans, JetBrains_Mono } from "next/font/google";
import { Shell } from "@/components/Identity";

export const metadata: Metadata = { title: "Sats-for-Data", description: "Teach AI your African language and get paid in sats." };
export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#ffffff" };

const inter = DM_Sans({ subsets: ["latin"], variable: "--font-sans", weight: ["400","500","700","900"] });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono", weight: ["400"] });

export default function Root({ children }: { children: React.ReactNode }) {
  return <html lang="en" className={`${inter.variable} ${mono.variable}`}><body><Shell>{children}</Shell></body></html>;
}
