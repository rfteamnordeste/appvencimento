import type { Metadata, Viewport } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'RF Team — Controle de Mensalidades',
  description: 'Sistema de controle de mensalidades para a academia RF Team de Jiu-Jitsu. Lembre seus alunos de forma simples e respeitosa.',
  manifest: '/manifest.json',
  icons: {
    icon: '/icons/icon.svg',
    apple: '/icons/icon-192.png',
  },
  applicationName: 'RF Team',
  keywords: ['jiu-jitsu', 'academia', 'mensalidade', 'controle', 'RF Team'],
  authors: [{ name: 'RF Team' }],
}

export const viewport: Viewport = {
  themeColor: '#0a0a0a',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  )
}
