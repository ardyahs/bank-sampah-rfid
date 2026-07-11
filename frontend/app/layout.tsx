import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Bank Sampah Digital RFID",
  description: "Dashboard Bank Sampah Digital Berbasis RFID",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  );
}
