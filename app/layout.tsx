import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'PONG — x402 via USD1',
  description: 'Pay 10 USD1 (EIP-3009) to receive 40,000 PONG allocation',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body style={{ margin: 0, padding: 0 }}>{children}</body>
    </html>
  )
}
