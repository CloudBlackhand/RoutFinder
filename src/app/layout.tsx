import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Finder",
  description: "Rotas e rastreamento em tempo real para instaladores",
};

export const viewport: Viewport = { themeColor: "#020617" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" className="h-full antialiased">
      <body className="min-h-full bg-slate-950">{children}</body>
    </html>
  );
}
