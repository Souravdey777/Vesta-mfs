import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "MF Screener",
  description: "Conversational mutual fund screening for Indian investors."
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen font-sans">{children}</body>
    </html>
  );
}
