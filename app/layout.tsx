import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "TMB Atelier — Dessinez votre Tour du Mont-Blanc",
  description:
    "Un atelier cartographique pour préparer le Tour du Mont-Blanc : variantes, sentiers, étapes et fichiers GPX.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr">
      <body className="antialiased">{children}</body>
    </html>
  );
}
