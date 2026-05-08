
import type {Metadata, Viewport} from 'next';
import { Poppins } from 'next/font/google';
import './globals.css';
import { cn } from '@/lib/utils';
import { APP_LOGO_URL_ENCODED } from '@/lib/branding';
import { Toaster } from "@/components/ui/toaster"

const poppins = Poppins({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-poppins',
  display: 'swap',
});

const APP_NAME = "El Rio - POS";
const APP_DESCRIPTION = "Point of Sale system for your business.";

export const metadata: Metadata = {
  applicationName: APP_NAME,
  title: {
    default: APP_NAME,
    template: `%s | ${APP_NAME}`,
  },
  description: APP_DESCRIPTION,
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: APP_NAME,
    // startUpImage: [],
  },
  formatDetection: {
    telephone: false,
  },
  manifest: "/manifest.json",
  icons: {
    icon: [{ url: APP_LOGO_URL_ENCODED, type: "image/png" }],
    apple: [{ url: APP_LOGO_URL_ENCODED, type: "image/png" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#F97316",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={poppins.variable} suppressHydrationWarning>
      <head>
        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" href={APP_LOGO_URL_ENCODED} />
      </head>
      <body className={cn("font-body antialiased")}>
        {children}
        <Toaster />
      </body>
    </html>
  );
}
