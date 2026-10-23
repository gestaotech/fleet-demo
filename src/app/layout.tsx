import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Gestão de Frota - Gestão Tech",
  description: "Fundação segura para gestão de frota",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
