'use client'

import { motion } from 'framer-motion'
import Link from 'next/link'

export default function AboutPage() {
  return (
    <div style={styles.container}>
      <div style={styles.content}>
        {/* Header */}
        <motion.div
          style={styles.header}
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <Link href="/" style={styles.backLink}>
            ← Back to PONG?
          </Link>
          <h1 style={styles.title}>About & Disclaimer</h1>
          <p style={styles.subtitle}>PONG? Protocol Implementation on BNB Chain</p>
        </motion.div>

        {/* Main Content */}
        <motion.div
          style={styles.sections}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.5 }}
        >
          {/* Why PONG? */}
          <section style={styles.section}>
            <h2 style={styles.sectionTitle}>Why PONG? (with a question mark?)</h2>
            <p style={styles.text}>
              PONG? was created to differentiate from our inspiration <strong>PENG!</strong> - the pioneering x402
              implementation on BNB Chain. While PENG! blazed the trail, PONG? adds its own unique twist with the
              question mark symbolizing curiosity, exploration, and the experimental nature of gasless payments.
              We're not competing - we're contributing to the ecosystem PENG! helped create.
            </p>
          </section>

          {/* Historical Significance */}
          <section style={styles.section}>
            <h2 style={styles.sectionTitle}>Historical Significance</h2>
            <p style={styles.text}>
              PONG? builds upon the groundbreaking work of PENG!, which represented the first successful
              implementation of the x402 protocol on BNB Chain. This was made possible through the integration
              of EIP-2612 Permit signatures, opening new possibilities for gasless payments on BNB Chain and
              other EVM-compatible chains.
            </p>
          </section>

          {/* x402 Protocol Evolution */}
          <section style={styles.section}>
            <h2 style={styles.sectionTitle}>x402 Protocol Evolution</h2>
            <p style={styles.text}>
              The x402 protocol has evolved significantly with the recent addition of EIP-2612 Permit support.
              This enhancement was officially merged into the main x402 repository through Pull Request #485,
              expanding the protocol's capabilities beyond the original EIP-3009 USDC implementation.
            </p>
          </section>

          {/* Chain Compatibility Breakthrough */}
          <section style={styles.section}>
            <h2 style={styles.sectionTitle}>Chain Compatibility Breakthrough</h2>
            <p style={styles.text}>
              Previously, x402 was limited to chains supporting EIP-3009, which excluded networks including
              BNB Chain, since Circle did not deploy native USDC on it. With the addition of EIP-2612 Permit
              support, any token that implements the permit function can now be used with the x402 protocol,
              dramatically expanding its reach and utility.
            </p>
          </section>

          {/* Technical Implementation */}
          <section style={styles.section}>
            <h2 style={styles.sectionTitle}>Technical Implementation</h2>
            <p style={styles.text}>
              PONG? operates as a USD1 facilitator on BNB Chain, enabling gasless token distribution through
              cryptographic signatures. We implement off-chain signature authorization using EIP-2612's permit()
              function with domain-separated typed data (EIP-712), enabling meta-transactions where our backend
              submits the on-chain transaction while you sign off-chain.
            </p>
            <div style={styles.infoBox}>
              <div style={styles.infoRow}>
                <span style={styles.infoLabel}>Facilitator Address:</span>
                <code style={styles.infoValue}>0x8676532800bEF0c69F8Af0A989dBf3943B1b408A</code>
              </div>
              <div style={styles.infoRow}>
                <span style={styles.infoLabel}>Network:</span>
                <span style={styles.infoValue}>BNB Chain (BSC)</span>
              </div>
              <div style={styles.infoRow}>
                <span style={styles.infoLabel}>Token Standard:</span>
                <span style={styles.infoValue}>EIP-2612 Permit</span>
              </div>
              <div style={styles.infoRow}>
                <span style={styles.infoLabel}>Payment Token:</span>
                <span style={styles.infoValue}>USD1 (EIP-2612 compatible)</span>
              </div>
            </div>
            <p style={styles.text}>
              You can check the facilitator address on BSCScan:{' '}
              <a
                href="https://bscscan.com/address/0x8676532800bEF0c69F8Af0A989dBf3943B1b408A"
                target="_blank"
                rel="noopener noreferrer"
                style={styles.link}
              >
                View on BSCScan ↗
              </a>
            </p>
          </section>

          {/* Protocol Benefits */}
          <section style={styles.section}>
            <h2 style={styles.sectionTitle}>Protocol Benefits</h2>
            <p style={styles.text}>
              The x402 protocol enables gasless payments through cryptographic signatures, eliminating the need
              for users to hold native tokens for transaction fees. This creates a seamless payment experience
              while maintaining security through cryptographic verification using EIP-712 domain separation.
            </p>
          </section>

          {/* Security & Trust */}
          <section style={styles.section}>
            <h2 style={styles.sectionTitle}>Security & Trust</h2>
            <p style={styles.text}>
              All payments are cryptographically verified using EIP-2612 Permit signatures, ensuring that only
              authorized transactions are processed. The facilitator contract handles the settlement process
              securely and transparently. Every signature is domain-separated and bound to specific parameters
              including amount, deadline, and nonce.
            </p>
          </section>

          {/* Open Source Commitment */}
          <section style={styles.section}>
            <h2 style={styles.sectionTitle}>Open Source Commitment</h2>
            <p style={styles.text}>
              The x402 protocol is fully open source and community-driven. The recent addition of EIP-2612
              Permit support demonstrates the protocol's commitment to innovation and broader blockchain
              ecosystem compatibility.
            </p>
            <p style={styles.text}>
              Learn more about the x402 protocol at:{' '}
              <a
                href="https://github.com/exact-labs/x402-protocol"
                target="_blank"
                rel="noopener noreferrer"
                style={styles.link}
              >
                x402 Documentation ↗
              </a>
            </p>
          </section>

          {/* PONG? Token Disclaimer */}
          <section style={styles.section}>
            <h2 style={styles.sectionTitle}>PONG? Token Disclaimer</h2>
            <div style={styles.warningBox}>
              <p style={styles.warningText}>
                <strong>⚠️ IMPORTANT:</strong> PONG? is a demonstration token with no utility, value, or
                purpose beyond showcasing the x402 protocol implementation. It is not a financial instrument,
                investment opportunity, or store of value.
              </p>
            </div>
            <p style={styles.text}>
              <strong>Minting Information:</strong> PONG? tokens can be minted through three endpoints:
            </p>
            <ul style={styles.list}>
              <li style={styles.listItem}>
                <code style={styles.code}>/pong1</code> - 4,000 PONG? for 1 USD1
              </li>
              <li style={styles.listItem}>
                <code style={styles.code}>/pong5</code> - 20,000 PONG? for 5 USD1 (Most Popular)
              </li>
              <li style={styles.listItem}>
                <code style={styles.code}>/pong10</code> - 40,000 PONG? for 10 USD1
              </li>
            </ul>
            <p style={styles.text}>
              All endpoints provide a rate of 4,000 PONG? per USD1. The entire payment amount goes to
              sustaining operations and keeping the facilitator running.
            </p>
            <p style={styles.text}>
              <strong>Fair Launch:</strong> PONG? features a fair launch with no team allocation, no founder
              tokens, and 100% of proceeds going to liquidity. The team reserves the right to refund sybils
              and suspicious addresses to ensure fair distribution.
            </p>
          </section>

          {/* Cryptocurrency Risk Disclaimer */}
          <section style={styles.section}>
            <h2 style={styles.sectionTitle}>Cryptocurrency Risk Disclaimer</h2>
            <div style={styles.warningBox}>
              <p style={styles.warningText}>
                Cryptocurrency transactions involve significant risks. Users should be aware of the following:
              </p>
            </div>
            <ul style={styles.list}>
              <li style={styles.listItem}>
                <strong>Volatility:</strong> Cryptocurrency prices can be extremely volatile
              </li>
              <li style={styles.listItem}>
                <strong>Regulatory Risk:</strong> Cryptocurrency regulations may change
              </li>
              <li style={styles.listItem}>
                <strong>Technical Risk:</strong> Smart contracts may have bugs or vulnerabilities
              </li>
              <li style={styles.listItem}>
                <strong>Market Risk:</strong> Cryptocurrency markets are highly speculative
              </li>
              <li style={styles.listItem}>
                <strong>Loss Risk:</strong> You may lose some or all of your investment
              </li>
            </ul>
            <div style={styles.highlightBox}>
              <p style={styles.highlightText}>
                <strong>⚠️ IMPORTANT:</strong> Only invest what you can afford to lose. This project is for
                educational and demonstration purposes only. This does not constitute financial advice.
              </p>
            </div>
          </section>

          {/* Technical Implementation Disclaimer */}
          <section style={styles.section}>
            <h2 style={styles.sectionTitle}>Technical Implementation Disclaimer</h2>
            <p style={styles.text}>
              This implementation is for demonstration purposes and showcases the potential of the x402
              protocol on BNB Chain. Users should exercise caution and understand the risks associated with
              cryptocurrency transactions.
            </p>
            <p style={styles.text}>
              PONG? demonstrates a working implementation of x402 on BNB Chain, utilizing:
            </p>
            <ul style={styles.list}>
              <li style={styles.listItem}>EIP-2612 Permit signatures for gasless approvals</li>
              <li style={styles.listItem}>Custom BNB Chain facilitator for payment settlement</li>
              <li style={styles.listItem}>USD1 token for payment processing</li>
              <li style={styles.listItem}>Cryptographic verification (EIP-712) for security</li>
              <li style={styles.listItem}>Meta-transaction architecture for gasless UX</li>
            </ul>
          </section>

          {/* Acknowledgments */}
          <section style={styles.section}>
            <h2 style={styles.sectionTitle}>Acknowledgments</h2>
            <p style={styles.text}>
              Special thanks to the <strong>PENG!</strong> team for pioneering x402 on BNB Chain and proving
              that gasless payments are possible on networks beyond those supporting EIP-3009. PONG? stands
              on the shoulders of giants.
            </p>
            <p style={styles.text}>
              Thanks to the x402 protocol developers and the broader Ethereum community for creating the
              standards (EIP-2612, EIP-712) that make this possible.
            </p>
          </section>

          {/* Contact & Social */}
          <section style={styles.section}>
            <h2 style={styles.sectionTitle}>Stay Connected</h2>
            <p style={styles.text}>
              Follow us on X (Twitter):{' '}
              <a
                href="https://x.com/PONGBNBx402"
                target="_blank"
                rel="noopener noreferrer"
                style={styles.link}
              >
                @PONGBNBx402 ↗
              </a>
            </p>
          </section>
        </motion.div>

        {/* Footer */}
        <motion.div
          style={styles.footer}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4, duration: 0.5 }}
        >
          <p style={styles.footerText}>
            © 2025 PONG? Protocol · Built with ❤️ on BNB Chain · Powered by x402
          </p>
          <p style={styles.footerText}>
            <Link href="/" style={styles.footerLink}>
              Go to PONG? App
            </Link>
          </p>
        </motion.div>
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    minHeight: '100vh',
    background: 'var(--bg-primary)',
    color: 'var(--text-primary)',
    padding: '40px 20px',
  },
  content: {
    maxWidth: '900px',
    margin: '0 auto',
  },
  header: {
    textAlign: 'center',
    marginBottom: '60px',
  },
  backLink: {
    display: 'inline-block',
    color: 'var(--color-binance-gold)',
    textDecoration: 'none',
    fontSize: '14px',
    fontWeight: 600,
    marginBottom: '20px',
    transition: 'opacity 0.2s ease',
  },
  title: {
    fontSize: '48px',
    fontWeight: 900,
    margin: '0 0 12px 0',
    background: 'linear-gradient(135deg, var(--text-primary) 0%, var(--color-binance-gold) 100%)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    backgroundClip: 'text',
  },
  subtitle: {
    fontSize: '18px',
    color: 'var(--text-secondary)',
    margin: 0,
  },
  sections: {
    display: 'flex',
    flexDirection: 'column',
    gap: '48px',
  },
  section: {
    background: 'var(--bg-secondary)',
    border: '1px solid var(--border-color)',
    borderRadius: '16px',
    padding: '32px',
  },
  sectionTitle: {
    fontSize: '28px',
    fontWeight: 700,
    color: 'var(--text-primary)',
    margin: '0 0 20px 0',
    paddingBottom: '12px',
    borderBottom: '2px solid var(--color-binance-gold)',
  },
  text: {
    fontSize: '15px',
    lineHeight: '1.8',
    color: 'var(--text-secondary)',
    margin: '0 0 16px 0',
  },
  infoBox: {
    background: 'var(--bg-elevated)',
    border: '1px solid var(--border-color)',
    borderRadius: '12px',
    padding: '20px',
    marginTop: '20px',
    marginBottom: '20px',
  },
  infoRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px 0',
    borderBottom: '1px solid var(--border-color)',
    flexWrap: 'wrap',
    gap: '8px',
  },
  infoLabel: {
    fontSize: '14px',
    color: 'var(--text-tertiary)',
    fontWeight: 600,
  },
  infoValue: {
    fontSize: '14px',
    color: 'var(--text-primary)',
    fontFamily: 'Monaco, "Courier New", monospace',
    fontWeight: 600,
  },
  warningBox: {
    background: 'rgba(246, 70, 93, 0.08)',
    border: '2px solid rgba(246, 70, 93, 0.3)',
    borderRadius: '12px',
    padding: '20px',
    marginBottom: '20px',
  },
  warningText: {
    fontSize: '15px',
    lineHeight: '1.7',
    color: 'var(--text-secondary)',
    margin: 0,
  },
  highlightBox: {
    background: 'rgba(240, 185, 11, 0.08)',
    border: '2px solid rgba(240, 185, 11, 0.3)',
    borderRadius: '12px',
    padding: '20px',
    marginTop: '20px',
  },
  highlightText: {
    fontSize: '15px',
    lineHeight: '1.7',
    color: 'var(--text-secondary)',
    margin: 0,
  },
  list: {
    margin: '16px 0',
    paddingLeft: '24px',
  },
  listItem: {
    fontSize: '15px',
    lineHeight: '1.8',
    color: 'var(--text-secondary)',
    marginBottom: '12px',
  },
  code: {
    background: 'rgba(240, 185, 11, 0.1)',
    color: 'var(--color-binance-gold)',
    padding: '2px 8px',
    borderRadius: '4px',
    fontFamily: 'Monaco, "Courier New", monospace',
    fontSize: '14px',
    fontWeight: 600,
  },
  link: {
    color: 'var(--color-info)',
    textDecoration: 'none',
    fontWeight: 600,
    transition: 'opacity 0.2s ease',
  },
  footer: {
    marginTop: '80px',
    paddingTop: '40px',
    borderTop: '1px solid var(--border-color)',
    textAlign: 'center',
  },
  footerText: {
    fontSize: '13px',
    color: 'var(--text-tertiary)',
    margin: '8px 0',
  },
  footerLink: {
    color: 'var(--color-binance-gold)',
    textDecoration: 'none',
    fontWeight: 600,
  },
}
