import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'PONG — Fair Launch Token Distribution | x402 Payments',
  description: 'Fair launch token distribution via x402 protocol on BNB Chain. No team allocation, no founder tokens, 100% to liquidity. Powered by EIP-2612 gasless payments.',
  keywords: 'PONG, BNB Chain, x402, EIP-2612, Fair Launch, Token Distribution, Gasless Payments',
  openGraph: {
    title: 'PONG — Fair Launch Token Distribution',
    description: 'Fair launch token distribution via x402 protocol on BNB Chain',
    type: 'website',
  },
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
          /* CSS Custom Properties - Binance-Inspired Design System */
          :root {
            --color-binance-gold: #F0B90B;
            --color-binance-gold-dark: #C99400;
            --color-binance-dark: #1E2329;
            --color-binance-darker: #0B0E11;
            --color-success: #0ECB81;
            --color-success-dark: #0A9760;
            --color-error: #F6465D;
            --color-warning: #F0B90B;
            --color-info: #3B82F6;

            --bg-primary: #0B0E11;
            --bg-secondary: #1E2329;
            --bg-tertiary: #2B3139;
            --bg-elevated: #181A20;

            --text-primary: #EAECEF;
            --text-secondary: #B7BDC6;
            --text-tertiary: #848E9C;
            --text-disabled: #5E6673;

            --border-color: #2B3139;
            --border-hover: #474D57;

            --glow-gold: 0 0 20px rgba(240, 185, 11, 0.3), 0 0 40px rgba(240, 185, 11, 0.1);
            --glow-blue: 0 0 20px rgba(59, 130, 246, 0.3), 0 0 40px rgba(59, 130, 246, 0.1);
            --glow-success: 0 0 20px rgba(14, 203, 129, 0.3), 0 0 40px rgba(14, 203, 129, 0.1);
          }

          /* Reset & Base Styles */
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }

          body {
            margin: 0;
            padding: 0;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            background: var(--bg-primary);
            color: var(--text-primary);
            overflow-x: hidden;
            -webkit-font-smoothing: antialiased;
            -moz-osx-font-smoothing: grayscale;
          }

          /* Scrollbar Styling */
          ::-webkit-scrollbar {
            width: 8px;
            height: 8px;
          }

          ::-webkit-scrollbar-track {
            background: var(--bg-secondary);
          }

          ::-webkit-scrollbar-thumb {
            background: var(--bg-tertiary);
            border-radius: 4px;
          }

          ::-webkit-scrollbar-thumb:hover {
            background: var(--border-hover);
          }

          /* Enhanced Animations */
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }

          @keyframes float {
            0%, 100% { transform: translateY(0px); }
            50% { transform: translateY(-20px); }
          }

          @keyframes bounce {
            0%, 100% { transform: translateY(0); }
            50% { transform: translateY(-15px); }
          }

          @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.8; }
          }

          @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
          }

          @keyframes slideUp {
            from {
              opacity: 0;
              transform: translateY(20px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }

          @keyframes fadeInDown {
            from {
              opacity: 0;
              transform: translateY(-10px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }

          @keyframes glow {
            0%, 100% {
              box-shadow: 0 0 20px rgba(240, 185, 11, 0.2), 0 0 40px rgba(240, 185, 11, 0.1);
            }
            50% {
              box-shadow: 0 0 30px rgba(240, 185, 11, 0.4), 0 0 60px rgba(240, 185, 11, 0.2);
            }
          }

          @keyframes shimmer {
            0% {
              background-position: -1000px 0;
            }
            100% {
              background-position: 1000px 0;
            }
          }

          @keyframes slideInRight {
            from {
              opacity: 0;
              transform: translateX(30px);
            }
            to {
              opacity: 1;
              transform: translateX(0);
            }
          }

          @keyframes scaleIn {
            from {
              opacity: 0;
              transform: scale(0.9);
            }
            to {
              opacity: 1;
              transform: scale(1);
            }
          }

          @keyframes gradientFlow {
            0% { background-position: 0% 50%; }
            50% { background-position: 100% 50%; }
            100% { background-position: 0% 50%; }
          }

          @keyframes borderGlow {
            0%, 100% { border-color: rgba(240, 185, 11, 0.3); }
            50% { border-color: rgba(240, 185, 11, 0.6); }
          }

          /* Particle Animation */
          @keyframes particle-float {
            0%, 100% {
              transform: translate(0, 0) scale(1);
              opacity: 0;
            }
            10% {
              opacity: 0.8;
            }
            50% {
              transform: translate(100px, -100px) scale(1.2);
              opacity: 0.6;
            }
            90% {
              opacity: 0.3;
            }
          }

          /* Utility Classes */
          .gradient-text-gold {
            background: linear-gradient(135deg, #F0B90B 0%, #FCD535 50%, #F0B90B 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
            background-size: 200% auto;
            animation: gradientFlow 3s ease infinite;
          }

          .gradient-text-blue {
            background: linear-gradient(135deg, #3B82F6 0%, #8B5CF6 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
          }

          .glass-effect {
            background: rgba(30, 35, 41, 0.6);
            backdrop-filter: blur(12px);
            -webkit-backdrop-filter: blur(12px);
            border: 1px solid rgba(255, 255, 255, 0.05);
          }

          /* Accessibility - Respect prefers-reduced-motion */
          @media (prefers-reduced-motion: reduce) {
            *,
            *::before,
            *::after {
              animation-duration: 0.01ms !important;
              animation-iteration-count: 1 !important;
              transition-duration: 0.01ms !important;
            }
          }

          /* Selection Styling */
          ::selection {
            background: rgba(240, 185, 11, 0.3);
            color: var(--text-primary);
          }
        `}</style>
      </head>
      <body>{children}</body>
    </html>
  )
}
