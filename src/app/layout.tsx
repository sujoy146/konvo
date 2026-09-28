import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";
import { EncryptionProvider } from "@/context/EncryptionContext";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Konvo - E2EE Chat",
  description: "End-to-End Encrypted Real-Time Chat Application",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <AuthProvider>
          <EncryptionProvider>
            {children}
          </EncryptionProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
