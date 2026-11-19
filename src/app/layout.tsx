import type { Metadata, Viewport } from "next";
import "./globals.css";
import { enforceProductionEnv } from "../../backend/utils/env-validation";

enforceProductionEnv();

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export const metadata: Metadata = {
  title: "clickmyQ+ | Less Waiting. Better Care.",
  description:
    "clickmyQ+ is a smart OPD queue management SaaS for clinics and hospitals. Live patient queues, token management, appointments, staff and billing — all in one secure platform.",
  keywords: [
    "OPD queue management",
    "clinic queue software",
    "live queue management",
    "patient queue",
    "token management system",
    "healthcare saas",
    "clinic management",
    "hospital management",
    "patient management",
  ],
  icons: {
    icon: [
      { url: "/fevicon.ico", sizes: "any" },
      { url: "/logo/fevicon-icon.png", type: "image/png" }
    ],
  },
  openGraph: {
    title: "clickmyQ+ | Less Waiting. Better Care.",
    description:
      "Smart OPD queue management — live patient queues, token management and clinic operations in one platform.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
