'use client'

import { useState, useRef, useEffect } from 'react'

const CHAIN_ID = 56
const EXPECTED_CHAIN_ID = '0x38' // 56 in hex

// Payment tier configuration
const PAYMENT_TIERS = [
  { amount: 1, usd1: 1, pong: 4000, popular: false },
  { amount: 5, usd1: 5, pong: 20000, popular: true },
  { amount: 10, usd1: 10, pong: 40000, popular: false },
]

type TransactionStage = 'idle' | 'requesting' | 'signing' | 'settling' | 'success' | 'error'

let renderCount = 0

export default function Home() {
  renderCount++
  console.log(`[Component] ===== RENDER #${renderCount} =====`)

  const [account, setAccount] = useState<string>('')
  const [status, setStatus] = useState<string[]>([])
  const [txHash, setTxHash] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [selectedTier, setSelectedTier] = useState<number | null>(null)
  const [transactionStage, setTransactionStage] = useState<TransactionStage>('idle')
  const [allocatedPong, setAllocatedPong] = useState<number>(0)
  const paymentInProgressRef = useRef(false)

  const addStatus = (msg: string) => {
    setStatus((prev) => [...prev, `${new Date().toLocaleTimeString()} → ${msg}`])
  }

  // Debug: monitor account changes
  useEffect(() => {
    console.log('[Effect] Account changed to:', account || 'empty')
    if (account) {
      console.log('[Effect] Account is set! UI should show pricing tiers now.')
    } else {
      console.log('[Effect] No account, UI should show connect button.')
    }
  }, [account])

  const connectWallet = async () => {
    try {
      console.log('[Wallet] Starting connection...')

      if (!window.ethereum) {
        console.error('[Wallet] MetaMask not found')
        addStatus('❌ MetaMask not found')
        alert('MetaMask not found! Please install MetaMask extension.')
        return
      }

      console.log('[Wallet] Requesting accounts...')
      const accounts = await window.ethereum.request({
        method: 'eth_requestAccounts',
      })
      console.log('[Wallet] Accounts:', accounts)

      const chainId = await window.ethereum.request({ method: 'eth_chainId' })
      console.log('[Wallet] Current chainId:', chainId, 'Expected:', EXPECTED_CHAIN_ID)

      if (chainId !== EXPECTED_CHAIN_ID) {
        console.log('[Wallet] Wrong network, switching...')
        addStatus('⚠️  Wrong network. Switching to BNB Chain...')
        try {
          await window.ethereum.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: EXPECTED_CHAIN_ID }],
          })
          console.log('[Wallet] Switched to BNB Chain')
          addStatus('✅ Switched to BNB Chain')
        } catch (switchError: any) {
          console.error('[Wallet] Switch error:', switchError)
          if (switchError.code === 4902) {
            addStatus('❌ BNB Chain not found in wallet. Please add it manually.')
          }
          return
        }
      }

      const selectedAccount = accounts[0].toLowerCase()
      console.log('[Wallet] Setting account:', selectedAccount)
      setAccount(selectedAccount)
      addStatus(`✅ Connected: ${selectedAccount.slice(0, 6)}...${selectedAccount.slice(-4)}`)
      console.log('[Wallet] Connection successful!')
      console.log('[Wallet] Account state should now be:', selectedAccount)
    } catch (error) {
      console.error('[Wallet] Connection error:', error)
      addStatus(`❌ Connection failed: ${(error as Error).message}`)
    }
  }

  const pay = async (tierAmount: number) => {
    const callId = Math.random().toString(36).substring(7)
    console.log(`[Pay:${callId}] ===== FUNCTION CALLED =====`)
    console.log(`[Pay:${callId}] Tier:`, tierAmount)
    console.log(`[Pay:${callId}] InProgress ref:`, paymentInProgressRef.current)

    // CRITICAL: Check ref FIRST before any state
    if (paymentInProgressRef.current) {
      console.warn(`[Pay:${callId}] ⛔ BLOCKED - Already in progress`)
      return
    }

    // Set ref immediately to block any other calls
    paymentInProgressRef.current = true
    console.log(`[Pay:${callId}] ✅ Lock acquired, proceeding...`)

    if (!account) {
      console.error(`[Pay:${callId}] No account, aborting`)
      paymentInProgressRef.current = false
      addStatus('❌ Connect wallet first')
      return
    }

    setLoading(true)
    setStatus([])
    setTxHash('')
    setSelectedTier(tierAmount)
    setTransactionStage('requesting')

    // Map tier amount to endpoint
    const tierEndpoints: Record<number, string> = {
      1: '/pong',      // Tier 1: 1 USD1 → 4,000 PONG
      5: '/pong5',     // Tier 2: 5 USD1 → 20,000 PONG (MOST POPULAR)
      10: '/PONG2',    // Tier 3: 10 USD1 → 40,000 PONG
    }
    const endpoint = tierEndpoints[tierAmount]

    if (!endpoint) {
      console.error(`[Pay:${callId}] Invalid tier amount:`, tierAmount)
      paymentInProgressRef.current = false
      addStatus('❌ Invalid tier selected')
      return
    }

    try {
      // Step 1: Request challenge
      addStatus('🔄 Requesting EIP-2612 Permit challenge...')
      console.log(`[Pay:${callId}] Fetching challenge from ${endpoint}`)

      const challengeRes = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ owner: account }),
      })

      console.log(`[Pay:${callId}] Challenge response status:`, challengeRes.status)

      // x402 protocol: 402 status is expected for payment challenges
      if (challengeRes.status !== 402) {
        const err = await challengeRes.json()
        console.error(`[Pay:${callId}] Challenge failed:`, err)
        throw new Error(err.error || 'Challenge request failed')
      }

      const challenge = await challengeRes.json()
      console.log(`[Pay:${callId}] Challenge received:`, challenge)
      addStatus('✅ Challenge received')

      // Step 2: Sign with eth_signTypedData_v4
      setTransactionStage('signing')
      addStatus('🔏 Requesting signature...')

      console.log(`[Pay:${callId}] ===== REQUESTING SIGNATURE FROM METAMASK =====`)
      console.log(`[Pay:${callId}] This should appear ONLY ONCE!`)

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

      console.log(`[Pay:${callId}] Signature received from MetaMask`)
      console.log(`[Pay:${callId}] Signature:`, signature)

      addStatus('✅ Signature obtained')

      // Step 3: Settle with EIP-2612 Permit
      // Send FULL signature to backend (not split v,r,s)
      setTransactionStage('settling')
      addStatus('⚡ Settling transaction on-chain...')

      const settlePayload = {
        owner: challenge.values.owner,
        spender: challenge.values.spender,
        value: challenge.values.value,
        nonce: challenge.values.nonce,
        deadline: challenge.values.deadline,
        signature: signature, // Send full signature (0x + 130 hex chars)
      }

      console.log('Settle payload:', settlePayload)

      const settleRes = await fetch('/settle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settlePayload),
      })

      if (settleRes.status !== 201) {
        const err = await settleRes.json()
        console.error('Settlement error:', err)
        throw new Error(err.error + (err.details ? `: ${err.details}` : '') || 'Settlement failed')
      }

      const result = await settleRes.json()
      setTxHash(result.txHash)
      setAllocatedPong(result.allocationPONG)
      setTransactionStage('success')
      addStatus(`✅ Success! Tx: ${result.txHash}`)
      addStatus(`🎉 Allocated ${result.allocationPONG.toLocaleString()} PONG`)
    } catch (error: any) {
      setTransactionStage('error')
      addStatus(`❌ Error: ${error.message}`)
      if (error.message.includes('expired')) {
        addStatus('💡 Hint: Request a new challenge and try again')
      }
    } finally {
      setLoading(false)
      paymentInProgressRef.current = false
      console.log(`[Pay:${callId}] Payment process ended, lock released`)
    }
  }

  const resetTransaction = () => {
    setTransactionStage('idle')
    setTxHash('')
    setStatus([])
    setSelectedTier(null)
    setAllocatedPong(0)
    paymentInProgressRef.current = false
    console.log('[Reset] Transaction reset')
  }

  // Debug logging
  console.log('[Render] State:', {
    account: account ? account.slice(0, 10) + '...' : 'none',
    transactionStage,
    loading
  })

  return (
    <div style={styles.container}>
      {/* Hero Section */}
      <div style={styles.hero}>
        <div style={styles.heroGlow} />
        <div style={styles.heroMascotContainer}>
          <img
            src="/pong-mascot.png"
            alt="PONG Mascot"
            style={styles.heroMascot}
          />
        </div>
        <h1 style={styles.heroTitle}>
          <span style={styles.pongText}>PONG</span>
        </h1>
        <p style={styles.heroSubtitle}>Fair Launch Token Distribution</p>
        <p style={styles.heroDescription}>
          Gasless payment via EIP-2612 Permit on BNB Chain. No gas fees for you, instant allocation.
        </p>

        {/* Trust Badges */}
        <div style={styles.trustBadges}>
          <div style={styles.trustBadge}>
            <span style={styles.trustIcon}>✓</span>
            <span>No Team Allocation</span>
          </div>
          <div style={styles.trustBadge}>
            <span style={styles.trustIcon}>✓</span>
            <span>No Founder Tokens</span>
          </div>
          <div style={styles.trustBadge}>
            <span style={styles.trustIcon}>✓</span>
            <span>100% to Liquidity</span>
          </div>
          <div style={styles.trustBadge}>
            <span style={styles.trustIcon}>✓</span>
            <span>Fair Launch</span>
          </div>
        </div>
      </div>

      {/* Success Modal */}
      {transactionStage === 'success' && (
        <div style={styles.modal} onClick={resetTransaction}>
          <div style={styles.successCard} onClick={(e) => e.stopPropagation()}>
            <div style={styles.successMascotContainer}>
              <img
                src="/pong-mascot.png"
                alt="PONG Mascot"
                style={styles.successMascot}
              />
            </div>
            <div style={styles.successIconContainer}>
              <div style={styles.successIcon}>✓</div>
            </div>
            <h2 style={styles.successTitle}>Transaction Successful!</h2>
            <p style={styles.successMessage}>
              You've been allocated{' '}
              <span style={styles.successPongAmount}>{allocatedPong.toLocaleString()} PONG</span>
            </p>
            <div style={styles.successDetails}>
              <div style={styles.successDetailRow}>
                <span style={styles.successDetailLabel}>Amount Paid:</span>
                <span style={styles.successDetailValue}>{selectedTier} USD1</span>
              </div>
              <div style={styles.successDetailRow}>
                <span style={styles.successDetailLabel}>Transaction:</span>
                <a
                  href={`https://bscscan.com/tx/${txHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={styles.successTxLink}
                >
                  View on BSCScan ↗
                </a>
              </div>
            </div>
            <button style={styles.successButton} onClick={resetTransaction}>
              Make Another Purchase
            </button>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div style={styles.mainContent}>
        {!account ? (
          /* Wallet Connection Card */
          <div style={styles.connectCard}>
            <h2 style={styles.connectTitle}>Get Started</h2>
            <p style={styles.connectDescription}>
              Connect your wallet to participate in the PONG fair launch
            </p>
            <button style={styles.connectButton} onClick={connectWallet}>
              <span style={styles.connectButtonIcon}>🔌</span>
              Connect Wallet
            </button>
            <div style={styles.techBadges}>
              <span style={styles.techBadge}>BNB Chain</span>
              <span style={styles.techBadge}>EIP-2612</span>
              <span style={styles.techBadge}>Gasless</span>
              <span style={styles.techBadge}>x402</span>
            </div>
          </div>
        ) : transactionStage === 'idle' || transactionStage === 'error' ? (
          /* Pricing Tiers */
          <>
            <div style={styles.accountBanner}>
              <span style={styles.accountLabel}>Connected:</span>
              <span style={styles.accountAddress}>
                {account.slice(0, 6)}...{account.slice(-4)}
              </span>
            </div>

            <h2 style={styles.tiersTitle}>Choose Your Tier</h2>
            <div style={styles.tiersContainer}>
              {PAYMENT_TIERS.map((tier) => (
                <div
                  key={tier.amount}
                  style={{
                    ...styles.tierCard,
                    ...(tier.popular ? styles.tierCardPopular : {}),
                  }}
                >
                  {tier.popular && <div style={styles.popularBadge}>MOST POPULAR</div>}
                  <div style={styles.tierHeader}>
                    <div style={styles.tierAmount}>{tier.usd1}</div>
                    <div style={styles.tierCurrency}>USD1</div>
                  </div>
                  <div style={styles.tierDivider} />
                  <div style={styles.tierReward}>
                    <div style={styles.tierPongAmount}>{tier.pong.toLocaleString()}</div>
                    <div style={styles.tierPongLabel}>PONG Tokens</div>
                  </div>
                  <div style={styles.tierRatio}>4,000 PONG per USD1</div>
                  <button
                    type="button"
                    style={{
                      ...styles.tierButton,
                      ...(tier.popular ? styles.tierButtonPopular : {}),
                      ...(loading ? { opacity: 0.5, cursor: 'not-allowed' } : {}),
                      pointerEvents: loading ? 'none' : 'auto',
                    }}
                    onClick={() => {
                      console.log('[Button] Clicked tier:', tier.usd1)
                      pay(tier.usd1)
                    }}
                    disabled={loading || paymentInProgressRef.current}
                  >
                    {loading && selectedTier === tier.usd1 ? 'Processing...' : 'Select'}
                  </button>
                </div>
              ))}
            </div>

            {transactionStage === 'error' && status.length > 0 && (
              <div style={styles.errorCard}>
                <div style={styles.errorHeader}>
                  <span style={styles.errorIcon}>⚠️</span>
                  <span style={styles.errorTitle}>Transaction Failed</span>
                </div>
                <div style={styles.errorMessage}>{status[status.length - 1]}</div>
                <button style={styles.errorButton} onClick={resetTransaction}>
                  Try Again
                </button>
              </div>
            )}
          </>
        ) : (
          /* Transaction Progress */
          <div style={styles.progressCard}>
            <h2 style={styles.progressTitle}>Processing Transaction</h2>
            <p style={styles.progressSubtitle}>
              Purchasing {selectedTier} USD1 → {PAYMENT_TIERS.find((t) => t.usd1 === selectedTier)?.pong.toLocaleString()} PONG
            </p>

            <div style={styles.progressSteps}>
              <div style={styles.progressStep}>
                <div
                  style={{
                    ...styles.progressStepCircle,
                    ...(transactionStage === 'requesting' ? styles.progressStepCircleActive : {}),
                    ...(transactionStage === 'signing' || transactionStage === 'settling'
                      ? styles.progressStepCircleComplete
                      : {}),
                  }}
                >
                  {transactionStage === 'signing' || transactionStage === 'settling' ? '✓' : '1'}
                </div>
                <div style={styles.progressStepLabel}>Request Challenge</div>
                {transactionStage === 'requesting' && (
                  <div style={styles.progressStepSpinner} />
                )}
              </div>

              <div style={styles.progressStepConnector} />

              <div style={styles.progressStep}>
                <div
                  style={{
                    ...styles.progressStepCircle,
                    ...(transactionStage === 'signing' ? styles.progressStepCircleActive : {}),
                    ...(transactionStage === 'settling' ? styles.progressStepCircleComplete : {}),
                  }}
                >
                  {transactionStage === 'settling' ? '✓' : '2'}
                </div>
                <div style={styles.progressStepLabel}>Sign Authorization</div>
                {transactionStage === 'signing' && (
                  <div style={styles.progressStepSpinner} />
                )}
              </div>

              <div style={styles.progressStepConnector} />

              <div style={styles.progressStep}>
                <div
                  style={{
                    ...styles.progressStepCircle,
                    ...(transactionStage === 'settling' ? styles.progressStepCircleActive : {}),
                  }}
                >
                  3
                </div>
                <div style={styles.progressStepLabel}>Settle On-Chain</div>
                {transactionStage === 'settling' && (
                  <div style={styles.progressStepSpinner} />
                )}
              </div>
            </div>

            {/* Console Output */}
            {status.length > 0 && (
              <div style={styles.progressConsole}>
                {status.slice(-5).map((msg, i) => (
                  <div key={i} style={styles.progressConsoleItem}>
                    {msg}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <footer style={styles.footer}>
        <div style={styles.footerContent}>
          <div style={styles.footerInfo}>
            <span style={styles.footerLabel}>Protocol:</span>
            <span style={styles.footerValue}>x402 via EIP-2612</span>
          </div>
          <div style={styles.footerInfo}>
            <span style={styles.footerLabel}>Network:</span>
            <span style={styles.footerValue}>BNB Chain (BSC)</span>
          </div>
          <div style={styles.footerInfo}>
            <span style={styles.footerLabel}>Rate:</span>
            <span style={styles.footerValue}>4,000 PONG per USD1</span>
          </div>
        </div>
      </footer>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    minHeight: '100vh',
    background: '#0b0b0f',
    color: '#e4e4e7',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    padding: '20px',
    position: 'relative',
    overflow: 'hidden',
  },

  // Hero Section
  hero: {
    textAlign: 'center',
    paddingTop: '60px',
    paddingBottom: '40px',
    position: 'relative',
    maxWidth: '900px',
    margin: '0 auto',
  },
  heroGlow: {
    position: 'absolute',
    top: '0',
    left: '50%',
    transform: 'translateX(-50%)',
    width: '600px',
    height: '600px',
    background: 'radial-gradient(circle, rgba(59, 130, 246, 0.15) 0%, transparent 70%)',
    pointerEvents: 'none',
    zIndex: 0,
  },
  heroMascotContainer: {
    position: 'relative',
    zIndex: 1,
    marginBottom: '20px',
    display: 'flex',
    justifyContent: 'center',
  },
  heroMascot: {
    width: '120px',
    height: '120px',
    objectFit: 'contain',
    filter: 'drop-shadow(0 8px 24px rgba(255, 183, 3, 0.3))',
    animation: 'float 3s ease-in-out infinite',
  },
  heroTitle: {
    position: 'relative',
    zIndex: 1,
    fontSize: '72px',
    fontWeight: 800,
    margin: '0 0 16px 0',
    letterSpacing: '-0.03em',
  },
  pongText: {
    background: 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    backgroundClip: 'text',
  },
  heroSubtitle: {
    position: 'relative',
    zIndex: 1,
    fontSize: '24px',
    fontWeight: 600,
    color: '#a1a1aa',
    margin: '0 0 12px 0',
  },
  heroDescription: {
    position: 'relative',
    zIndex: 1,
    fontSize: '16px',
    color: '#71717a',
    margin: '0 0 32px 0',
    maxWidth: '600px',
    marginLeft: 'auto',
    marginRight: 'auto',
  },

  // Trust Badges
  trustBadges: {
    position: 'relative',
    zIndex: 1,
    display: 'flex',
    flexWrap: 'wrap',
    gap: '12px',
    justifyContent: 'center',
    maxWidth: '700px',
    margin: '0 auto',
  },
  trustBadge: {
    background: 'rgba(34, 197, 94, 0.1)',
    border: '1px solid rgba(34, 197, 94, 0.3)',
    borderRadius: '8px',
    padding: '10px 18px',
    fontSize: '14px',
    fontWeight: 500,
    color: '#22c55e',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  trustIcon: {
    fontSize: '16px',
    fontWeight: 700,
  },

  // Main Content
  mainContent: {
    maxWidth: '1100px',
    margin: '0 auto',
    position: 'relative',
    zIndex: 1,
  },

  // Connect Card
  connectCard: {
    background: '#11131a',
    border: '1px solid #1f2230',
    borderRadius: '20px',
    padding: '48px',
    maxWidth: '500px',
    margin: '0 auto',
    textAlign: 'center',
  },
  connectTitle: {
    fontSize: '32px',
    fontWeight: 700,
    margin: '0 0 12px 0',
  },
  connectDescription: {
    fontSize: '16px',
    color: '#a1a1aa',
    margin: '0 0 32px 0',
  },
  connectButton: {
    width: '100%',
    background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
    color: '#fff',
    border: 'none',
    borderRadius: '12px',
    padding: '18px 24px',
    fontSize: '18px',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 0.2s',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '12px',
  },
  connectButtonIcon: {
    fontSize: '24px',
  },
  techBadges: {
    display: 'flex',
    gap: '8px',
    flexWrap: 'wrap',
    marginTop: '24px',
    justifyContent: 'center',
  },
  techBadge: {
    background: '#18181b',
    border: '1px solid #27272a',
    borderRadius: '6px',
    padding: '6px 12px',
    fontSize: '12px',
    color: '#a1a1aa',
    fontFamily: 'Monaco, Courier, monospace',
  },

  // Account Banner
  accountBanner: {
    background: 'rgba(59, 130, 246, 0.1)',
    border: '1px solid rgba(59, 130, 246, 0.3)',
    borderRadius: '12px',
    padding: '16px 24px',
    marginBottom: '32px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '12px',
    flexWrap: 'wrap',
  },
  accountLabel: {
    fontSize: '14px',
    color: '#a1a1aa',
    fontWeight: 500,
  },
  accountAddress: {
    fontSize: '14px',
    color: '#3b82f6',
    fontFamily: 'Monaco, Courier, monospace',
    fontWeight: 600,
  },

  // Tiers
  tiersTitle: {
    fontSize: '32px',
    fontWeight: 700,
    textAlign: 'center',
    margin: '0 0 32px 0',
  },
  tiersContainer: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
    gap: '24px',
    marginBottom: '32px',
  },
  tierCard: {
    background: '#11131a',
    border: '1px solid #1f2230',
    borderRadius: '16px',
    padding: '32px 24px',
    textAlign: 'center',
    position: 'relative',
    transition: 'all 0.3s ease',
  },
  tierCardPopular: {
    border: '2px solid #3b82f6',
    boxShadow: '0 0 40px rgba(59, 130, 246, 0.2)',
  },
  popularBadge: {
    position: 'absolute',
    top: '-12px',
    left: '50%',
    transform: 'translateX(-50%)',
    background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
    color: '#fff',
    padding: '6px 16px',
    borderRadius: '20px',
    fontSize: '11px',
    fontWeight: 700,
    letterSpacing: '0.5px',
  },
  tierHeader: {
    marginBottom: '20px',
  },
  tierAmount: {
    fontSize: '56px',
    fontWeight: 800,
    lineHeight: '1',
    background: 'linear-gradient(135deg, #e4e4e7 0%, #a1a1aa 100%)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    backgroundClip: 'text',
  },
  tierCurrency: {
    fontSize: '18px',
    color: '#71717a',
    fontWeight: 600,
    marginTop: '4px',
  },
  tierDivider: {
    height: '1px',
    background: 'linear-gradient(90deg, transparent 0%, #1f2230 50%, transparent 100%)',
    margin: '20px 0',
  },
  tierReward: {
    marginBottom: '12px',
  },
  tierPongAmount: {
    fontSize: '32px',
    fontWeight: 700,
    color: '#3b82f6',
  },
  tierPongLabel: {
    fontSize: '14px',
    color: '#71717a',
    marginTop: '4px',
  },
  tierRatio: {
    fontSize: '13px',
    color: '#52525b',
    marginBottom: '24px',
    fontFamily: 'Monaco, Courier, monospace',
  },
  tierButton: {
    width: '100%',
    background: '#18181b',
    border: '1px solid #27272a',
    color: '#e4e4e7',
    borderRadius: '10px',
    padding: '14px 24px',
    fontSize: '16px',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  tierButtonPopular: {
    background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
    border: 'none',
    color: '#fff',
  },

  // Progress Card
  progressCard: {
    background: '#11131a',
    border: '1px solid #1f2230',
    borderRadius: '20px',
    padding: '48px',
    maxWidth: '700px',
    margin: '0 auto',
  },
  progressTitle: {
    fontSize: '32px',
    fontWeight: 700,
    textAlign: 'center',
    margin: '0 0 8px 0',
  },
  progressSubtitle: {
    fontSize: '16px',
    color: '#a1a1aa',
    textAlign: 'center',
    margin: '0 0 48px 0',
  },
  progressSteps: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: '32px',
  },
  progressStep: {
    flex: '0 0 auto',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '12px',
    position: 'relative',
  },
  progressStepCircle: {
    width: '56px',
    height: '56px',
    borderRadius: '50%',
    background: '#18181b',
    border: '2px solid #27272a',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '20px',
    fontWeight: 700,
    color: '#52525b',
  },
  progressStepCircleActive: {
    background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
    border: '2px solid #3b82f6',
    color: '#fff',
    boxShadow: '0 0 20px rgba(59, 130, 246, 0.4)',
  },
  progressStepCircleComplete: {
    background: '#22c55e',
    border: '2px solid #22c55e',
    color: '#fff',
  },
  progressStepLabel: {
    fontSize: '13px',
    color: '#a1a1aa',
    fontWeight: 500,
    textAlign: 'center',
    maxWidth: '100px',
  },
  progressStepSpinner: {
    width: '20px',
    height: '20px',
    border: '2px solid #27272a',
    borderTop: '2px solid #3b82f6',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
  },
  progressStepConnector: {
    flex: '1 1 auto',
    height: '2px',
    background: '#27272a',
    marginTop: '28px',
    marginLeft: '8px',
    marginRight: '8px',
  },
  progressConsole: {
    background: '#09090b',
    border: '1px solid #18181b',
    borderRadius: '12px',
    padding: '16px',
    fontSize: '13px',
    fontFamily: 'Monaco, Courier, monospace',
    color: '#a1a1aa',
    maxHeight: '200px',
    overflowY: 'auto',
  },
  progressConsoleItem: {
    marginBottom: '8px',
  },

  // Success Modal
  modal: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(0, 0, 0, 0.8)',
    backdropFilter: 'blur(8px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    padding: '20px',
  },
  successCard: {
    background: '#11131a',
    border: '2px solid #22c55e',
    borderRadius: '24px',
    padding: '48px',
    maxWidth: '500px',
    width: '100%',
    textAlign: 'center',
    boxShadow: '0 0 60px rgba(34, 197, 94, 0.3)',
    position: 'relative',
  },
  successMascotContainer: {
    position: 'absolute',
    top: '-60px',
    left: '50%',
    transform: 'translateX(-50%)',
    zIndex: 10,
  },
  successMascot: {
    width: '100px',
    height: '100px',
    objectFit: 'contain',
    filter: 'drop-shadow(0 8px 32px rgba(255, 183, 3, 0.5))',
    animation: 'bounce 0.6s ease-in-out infinite',
  },
  successIconContainer: {
    marginBottom: '24px',
  },
  successIcon: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '80px',
    height: '80px',
    borderRadius: '50%',
    background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
    color: '#fff',
    fontSize: '48px',
    fontWeight: 700,
    boxShadow: '0 8px 32px rgba(34, 197, 94, 0.4)',
  },
  successTitle: {
    fontSize: '32px',
    fontWeight: 700,
    margin: '0 0 16px 0',
    color: '#22c55e',
  },
  successMessage: {
    fontSize: '18px',
    color: '#a1a1aa',
    margin: '0 0 32px 0',
  },
  successPongAmount: {
    color: '#3b82f6',
    fontWeight: 700,
    fontSize: '22px',
  },
  successDetails: {
    background: '#09090b',
    border: '1px solid #18181b',
    borderRadius: '12px',
    padding: '20px',
    marginBottom: '24px',
  },
  successDetailRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '8px 0',
  },
  successDetailLabel: {
    fontSize: '14px',
    color: '#71717a',
  },
  successDetailValue: {
    fontSize: '14px',
    color: '#e4e4e7',
    fontWeight: 600,
    fontFamily: 'Monaco, Courier, monospace',
  },
  successTxLink: {
    fontSize: '14px',
    color: '#3b82f6',
    textDecoration: 'none',
    fontWeight: 600,
  },
  successButton: {
    width: '100%',
    background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
    color: '#fff',
    border: 'none',
    borderRadius: '12px',
    padding: '16px 24px',
    fontSize: '16px',
    fontWeight: 600,
    cursor: 'pointer',
  },

  // Error Card
  errorCard: {
    background: 'rgba(239, 68, 68, 0.1)',
    border: '1px solid rgba(239, 68, 68, 0.3)',
    borderRadius: '12px',
    padding: '24px',
    marginTop: '24px',
  },
  errorHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    marginBottom: '12px',
  },
  errorIcon: {
    fontSize: '24px',
  },
  errorTitle: {
    fontSize: '18px',
    fontWeight: 600,
    color: '#ef4444',
  },
  errorMessage: {
    fontSize: '14px',
    color: '#fca5a5',
    fontFamily: 'Monaco, Courier, monospace',
    marginBottom: '16px',
  },
  errorButton: {
    background: '#ef4444',
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    padding: '10px 20px',
    fontSize: '14px',
    fontWeight: 600,
    cursor: 'pointer',
  },

  // Footer
  footer: {
    marginTop: '60px',
    paddingTop: '32px',
    borderTop: '1px solid #1f2230',
    textAlign: 'center',
  },
  footerContent: {
    display: 'flex',
    gap: '32px',
    justifyContent: 'center',
    flexWrap: 'wrap',
    marginBottom: '20px',
  },
  footerInfo: {
    display: 'flex',
    gap: '8px',
    alignItems: 'center',
  },
  footerLabel: {
    fontSize: '13px',
    color: '#52525b',
  },
  footerValue: {
    fontSize: '13px',
    color: '#a1a1aa',
    fontFamily: 'Monaco, Courier, monospace',
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
