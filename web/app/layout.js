import { Outfit } from "next/font/google";
import "./globals.css";
import PwaRegister from "./components/PwaRegister";

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
});

export const metadata = {
  title: "Titan Protection — Security Operations Dashboard",
  description: "Real-time guard patrol monitoring, incident reporting, checklists, and access control. Built to Protect.",
  applicationName: "Titan Protection",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Titan Protection",
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/icon-192.png", sizes: "192x192" }],
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
  themeColor: "#1b4332",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={outfit.variable} suppressHydrationWarning>
      <body suppressHydrationWarning>
        <PwaRegister />
        {children}
      </body>
    </html>
  );
}
