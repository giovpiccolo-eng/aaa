import "./globals.css";
import { Providers } from "./providers";

export const metadata = {
  title: "Concordance — Acorn International School",
  description: "Integrated History coordination console",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Fredoka:wght@400;500;600;700&family=Nunito:wght@400;500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body className="bg-stone-50 text-gray-900 antialiased" style={{ fontFamily: "'Nunito', sans-serif" }}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
