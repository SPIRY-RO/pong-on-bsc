'use client'

import { useState } from 'react'

const CHAIN_ID = 56
const EXPECTED_CHAIN_ID = '0x38' // 56 in hex

export default function Home() {
  const [account, setAccount] = useState<string>('')
  const [status, setStatus] = useState<string[]>([])
  const [txHash, setTxHash] = useState<string>('')
  const [loading, setLoading] = useState(false)

  const addStatus = (msg: string) => {
    setStatus((prev) => [...prev, `${new Date().toLocaleTimeString()} → ${msg}`])
  }

  const connectWallet = async () => {
    try {
      if (!window.ethereum) {
        addStatus('❌ MetaMask not found')
        return
      }

      const accounts = await window.ethereum.request({
        method: 'eth_requestAccounts',
      })

      const chainId = await window.ethereum.request({ method: 'eth_chainId' })

      if (chainId !== EXPECTED_CHAIN_ID) {
        addStatus('⚠️  Wrong network. Switching to BNB Chain...')
        try {
          await window.ethereum.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: EXPECTED_CHAIN_ID }],
          })
          addStatus('✅ Switched to BNB Chain')
        } catch (switchError: any) {
          if (switchError.code === 4902) {
            addStatus('❌ BNB Chain not found in wallet. Please add it manually.')
          }
          return
        }
      }

      setAccount(accounts[0])
      addStatus(`✅ Connected: ${accounts[0].slice(0, 6)}...${accounts[0].slice(-4)}`)
    } catch (error) {
      addStatus(`❌ Connection failed: ${(error as Error).message}`)
    }
  }

  const pay = async () => {
    if (!account) {
      addStatus('❌ Connect wallet first')
      return
    }

    setLoading(true)
    setStatus([])
    setTxHash('')

    try {
      // Step 1: Request challenge
      addStatus('🔄 Requesting EIP-3009 challenge...')
      const challengeRes = await fetch('/api/pong', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ owner: account }),
      })

      // x402 protocol: 402 status is expected for payment challenges
      if (challengeRes.status !== 402) {
        const err = await challengeRes.json()
        throw new Error(err.error || 'Challenge request failed')
      }

      const challenge = await challengeRes.json()
      addStatus('✅ Challenge received')

      // Step 2: Sign with eth_signTypedData_v4
      addStatus('🔏 Requesting signature...')
      const signature = await window.ethereum.request({
        method: 'eth_signTypedData_v4',
        params: [
          account,
          JSON.stringify({
            domain: challenge.domain,
            types: challenge.types,
            primaryType: challenge.primaryType,
            message: challenge.values,
          }),
        ],
      })

      addStatus('✅ Signature obtained')

      // Extract v, r, s
      const sig = signature.slice(2)
      const r = '0x' + sig.slice(0, 64)
      const s = '0x' + sig.slice(64, 128)
      const v = parseInt(sig.slice(128, 130), 16)

      // Step 3: Settle
      addStatus('⚡ Settling transaction on-chain...')
      const settleRes = await fetch('/api/pong/settle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: challenge.values.from,
          to: challenge.values.to,
          value: challenge.values.value,
          validAfter: challenge.values.validAfter,
          validBefore: challenge.values.validBefore,
          nonce: challenge.values.nonce,
          v,
          r,
          s,
        }),
      })

      if (settleRes.status !== 201) {
        const err = await settleRes.json()
        throw new Error(err.error || 'Settlement failed')
      }

      const result = await settleRes.json()
      setTxHash(result.txHash)
      addStatus(`✅ Success! Tx: ${result.txHash}`)
      addStatus(`🎉 Allocated ${result.allocationPONG} PONG (handled off-chain)`)
    } catch (error: any) {
      addStatus(`❌ Error: ${error.message}`)
      if (error.message.includes('expired')) {
        addStatus('💡 Hint: Request a new challenge and try again')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h1 style={styles.title}>PONG</h1>
        <p style={styles.subtitle}>x402 via USD1 (EIP-3009)</p>
        <p style={styles.description}>
          Pay 10 USD1 → 40,000 PONG allocation (off-chain)
        </p>

        <div style={styles.badges}>
          <span style={styles.badge}>BNB Chain</span>
          <span style={styles.badge}>EIP-3009</span>
          <span style={styles.badge}>Gasless for payer</span>
          <span style={styles.badge}>x402</span>
        </div>

        {!account ? (
          <button style={styles.button} onClick={connectWallet}>
            Connect Wallet
          </button>
        ) : (
          <>
            <div style={styles.accountBox}>
              {account.slice(0, 6)}...{account.slice(-4)}
            </div>
            <button
              style={{ ...styles.button, ...(loading ? styles.buttonDisabled : {}) }}
              onClick={pay}
              disabled={loading}
            >
              {loading ? 'Processing...' : 'Pay 10 USD1'}
            </button>
          </>
        )}

        {status.length > 0 && (
          <pre style={styles.console}>
            {status.map((msg, i) => (
              <div key={i}>{msg}</div>
            ))}
          </pre>
        )}

        {txHash && (
          <a
            href={`https://bscscan.com/tx/${txHash}`}
            target="_blank"
            rel="noopener noreferrer"
            style={styles.link}
          >
            View on BSCScan ↗
          </a>
        )}
      </div>

      <footer style={styles.footer}>
        <a
          href="https://github.com/anthropics/claude-code"
          target="_blank"
          rel="noopener noreferrer"
          style={styles.footerLink}
        >
          Built with Claude Code
        </a>
      </footer>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    minHeight: '100vh',
    background: '#0b0b0f',
    color: '#e4e4e7',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    padding: '20px',
  },
  card: {
    background: '#11131a',
    border: '1px solid #1f2230',
    borderRadius: '16px',
    padding: '48px',
    maxWidth: '600px',
    width: '100%',
    boxShadow: '0 4px 24px rgba(0, 0, 0, 0.4)',
  },
  title: {
    fontSize: '48px',
    fontWeight: 700,
    margin: '0 0 8px 0',
    letterSpacing: '-0.02em',
  },
  subtitle: {
    fontSize: '16px',
    color: '#71717a',
    margin: '0 0 8px 0',
    fontFamily: 'Monaco, Courier, monospace',
  },
  description: {
    fontSize: '18px',
    color: '#a1a1aa',
    margin: '0 0 24px 0',
  },
  badges: {
    display: 'flex',
    gap: '8px',
    flexWrap: 'wrap',
    marginBottom: '32px',
  },
  badge: {
    background: '#18181b',
    border: '1px solid #27272a',
    borderRadius: '6px',
    padding: '6px 12px',
    fontSize: '12px',
    color: '#a1a1aa',
    fontFamily: 'Monaco, Courier, monospace',
  },
  button: {
    width: '100%',
    background: '#3b82f6',
    color: '#fff',
    border: 'none',
    borderRadius: '12px',
    padding: '16px',
    fontSize: '16px',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  buttonDisabled: {
    background: '#27272a',
    cursor: 'not-allowed',
  },
  accountBox: {
    background: '#18181b',
    border: '1px solid #27272a',
    borderRadius: '8px',
    padding: '12px',
    marginBottom: '16px',
    textAlign: 'center',
    fontFamily: 'Monaco, Courier, monospace',
    fontSize: '14px',
  },
  console: {
    background: '#09090b',
    border: '1px solid #18181b',
    borderRadius: '8px',
    padding: '16px',
    marginTop: '24px',
    fontSize: '12px',
    fontFamily: 'Monaco, Courier, monospace',
    color: '#a1a1aa',
    overflowX: 'auto',
    maxHeight: '300px',
    overflowY: 'auto',
  },
  link: {
    display: 'block',
    marginTop: '16px',
    color: '#3b82f6',
    textAlign: 'center',
    textDecoration: 'none',
    fontSize: '14px',
  },
  footer: {
    marginTop: '40px',
    textAlign: 'center',
  },
  footerLink: {
    color: '#52525b',
    textDecoration: 'none',
    fontSize: '14px',
  },
}

declare global {
  interface Window {
    ethereum?: any
  }
}
