import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'PONG — Fair Launch Token Distribution',
  description: 'Fair launch token distribution via EIP-3009 on BNB Chain. No team allocation, no founder tokens, 100% to liquidity.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <head>
        <style>{`
          @keyframes spin {
            from {
              transform: rotate(0deg);
            }
            to {
              transform: rotate(360deg);
            }
          }
        `}</style>
      </head>
      <body style={{ margin: 0, padding: 0 }}>{children}</body>
    </html>
  )
}
