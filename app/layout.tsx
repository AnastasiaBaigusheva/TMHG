import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Самая сложная игра в мире",
  description:
    "Интерактивная психологическая игра-исследование. Не терапия, не диагностика — инструмент саморефлексии через честный разговор с ИИ.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ru">
      <body className="font-sans antialiased min-h-screen bg-bg text-[#e9e7e2]">
        {children}
      </body>
    </html>
  );
}
