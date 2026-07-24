import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Photo Box Portal",
  description: "Temporary NFC photo delivery portal for events"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
