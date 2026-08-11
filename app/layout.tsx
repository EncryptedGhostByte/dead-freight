import type { Metadata } from "next";
import { headers } from "next/headers";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("host") ?? "localhost:3000";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const image = `${protocol}://${host}/og-v3.png`;

  return {
    title: "Dead Freight — Los Santos Containment",
    description: "Solve eight field traces, then stop the infected in a playable thermal gunship finale.",
    openGraph: {
      title: "Dead Freight",
      description: "Track the infected cargo, then contain the breach from Gunship 2-1.",
      images: [{ url: image, width: 1536, height: 1024, alt: "Dead Freight infected cargo tracking operation" }],
    },
    twitter: {
      card: "summary_large_image",
      title: "Dead Freight",
      description: "Track the infected cargo, then contain the breach from Gunship 2-1.",
      images: [image],
    },
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
