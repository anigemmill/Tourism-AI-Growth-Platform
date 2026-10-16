import type { Metadata } from "next";
import { Geist, Geist_Mono, Instrument_Serif, Inter, Inter_Tight, JetBrains_Mono } from "next/font/google";
import { getBrand } from "@/lib/brand";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
const displaySerif = Instrument_Serif({ variable: "--font-display-serif", subsets: ["latin"], weight: "400", style: ["normal", "italic"] });
// Findable brand fonts (see globals.css [data-brand="findable"]).
const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });
const interTight = Inter_Tight({ variable: "--font-inter-tight", subsets: ["latin"], weight: ["600", "700", "800"] });
const jetbrainsMono = JetBrains_Mono({ variable: "--font-jetbrains-mono", subsets: ["latin"], weight: ["500"] });

export function generateMetadata(): Metadata {
  const brand = getBrand();
  return {
    title: brand.id === "findable"
      ? { default: "Findable", template: "%s · Findable" }
      : { default: "Tourism AI Growth OS · Outside In", template: "%s · Growth OS" },
    description: brand.description,
    robots: { index: false, follow: false },
  };
}

export default function RootLayout({ children }: LayoutProps<"/">) {
  const brand = getBrand();
  const fonts = brand.id === "findable"
    ? `${inter.variable} ${interTight.variable} ${jetbrainsMono.variable}`
    : `${geistSans.variable} ${geistMono.variable} ${displaySerif.variable}`;
  return (
    <html lang="en-NZ" data-brand={brand.id} className={`${fonts} h-full antialiased`}>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
