import type { Metadata } from 'next'
import { Geist, Geist_Mono, Inter } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import './globals.css'

const geist = Geist({ subsets: ["latin"], variable: "--font-geist" });
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono" });
// Geist has no Cyrillic glyphs, so Mongolian letters (esp. Өө, Үү) render as
// "??"/boxes. Inter ships full Cyrillic incl. the Mongolian-specific glyphs,
// so we load it as the Cyrillic fallback in the font stack (see globals.css).
const cyrillic = Inter({
  subsets: ["latin", "cyrillic", "cyrillic-ext"],
  variable: "--font-cyrillic",
});

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://vexoai.studio'

export const metadata: Metadata = {
  metadataBase: new URL(APP_URL),
  title: {
    default: 'VexoAi — AI Video Ad Generator',
    template: '%s · VexoAi',
  },
  description:
    'Create stunning video ads with AI. Transform text and images into professional video content with Mongolian TTS.',
  applicationName: 'VexoAi',
  generator: 'Veio.digital',
  keywords: [
    'AI video',
    'video ad generator',
    'AI ads',
    'text to video',
    'image to video',
    'Mongolian TTS',
    'VexoAi',
    'Seedance',
    'Kling',
  ],
  authors: [{ name: 'Veio.digital' }],
  creator: 'Veio.digital',
  publisher: 'Veio.digital',
  alternates: {
    canonical: '/',
  },
  icons: {
    icon: [{ url: '/favicon.png', type: 'image/png' }],
    shortcut: '/favicon.png',
    apple: '/favicon.png',
  },
  openGraph: {
    type: 'website',
    url: APP_URL,
    siteName: 'VexoAi',
    title: 'VexoAi — AI Video Ad Generator',
    description:
      'Create stunning video ads with AI. Transform text and images into professional video content with Mongolian TTS.',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'VexoAi — AI Video Ad Generator',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'VexoAi — AI Video Ad Generator',
    description:
      'Create stunning video ads with AI. Transform text and images into professional video content with Mongolian TTS.',
    images: ['/og-image.png'],
  },
  robots: {
    index: true,
    follow: true,
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
      className={`${geist.variable} ${geistMono.variable} ${cyrillic.variable}`}
    >
      <body className="font-sans antialiased bg-background">
        {children}
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
