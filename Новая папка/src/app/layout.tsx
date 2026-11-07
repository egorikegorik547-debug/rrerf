import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Мёртвый город — выживание, турели, подвал и вылазки",
  description: "Выживание в городе зомби: торговец, оборона, подвал, вылазки за ресурсами и крафт.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ru">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Oswald:wght@400;500;600;700&family=Russo+One&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="bg-black text-stone-200 antialiased">{children}</body>
    </html>
  );
}
