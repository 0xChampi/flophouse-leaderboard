import type { Metadata, Viewport } from "next";
import "@fontsource-variable/inter";
import "@fontsource-variable/space-grotesk";
import "./globals.css";

export const metadata: Metadata = {
  title: "Flophouse — The House Leaderboard",
  description: "The Flophouse community leaderboard. Explore Gamba race #20764, player standings, projected prizes, and the house rules. Hosted by Travszzz.",
  robots: { index: true, follow: true },
  openGraph: { title: "Flophouse — The House Leaderboard", description: "Explore the Flophouse community standings, projected prizes, and house rules.", type: "website" },
  icons: { icon: "/icon.svg" },
};
export const viewport: Viewport = { themeColor: "#10131c", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
