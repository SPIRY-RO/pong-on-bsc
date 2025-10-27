'use client'

import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'

const EXPECTED_CHAIN_ID = '0x38' // BSC Mainnet (56 in hex)

// Payment tier configuration
const PAYMENT_TIERS = [
  { amount: 1, usd1: 1, pong: 4000, popular: false },
  { amount: 5, usd1: 5, pong: 20000, popular: true },
  { amount: 10, usd1: 10, pong: 40000, popular: false },
]

// Fixed particle positions to avoid hydration mismatch
const PARTICLE_POSITIONS = [
  { left: 15, top: 20, delay: 0, duration: 8 },
  { left: 85, top: 15, delay: 1.5, duration: 7 },
  { left: 45, top: 80, delay: 3, duration: 9 },
  { left: 25, top: 60, delay: 0.5, duration: 7.5 },
  { left: 70, top: 40, delay: 2, duration: 8.5 },
  { left: 10, top: 85, delay: 4, duration: 6.5 },
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

  // Listen for MetaMask account changes
  useEffect(() => {
    if (!window.ethereum) return

    const handleAccountsChanged = (accounts: string[]) => {
      console.log('[MetaMask] Account changed:', accounts)
      if (accounts.length === 0) {
        setAccount('')
        addStatus('⚠️ Wallet disconnected')
      } else {
        const newAccount = accounts[0].toLowerCase()
        setAccount(newAccount)
        addStatus(`✅ Switched to: ${newAccount.slice(0, 6)}...${newAccount.slice(-4)}`)
        resetTransaction()
      }
    }

    window.ethereum.on('accountsChanged', handleAccountsChanged)
    return () => window.ethereum.removeListener('accountsChanged', handleAccountsChanged)
  }, [])

  const connectWallet = async () => {
    try {
      if (!window.ethereum) {
        addStatus('❌ MetaMask not found')
        alert('MetaMask not found! Please install MetaMask extension.')
        return
      }

      addStatus('🔄 Connecting wallet...')

      try {
        await window.ethereum.request({
          method: 'wallet_requestPermissions',
          params: [{ eth_accounts: {} }],
        })
      } catch (permError: any) {
        if (permError.code === 4001) {
          addStatus('❌ Connection cancelled')
          return
        }
      }

      const accounts = await window.ethereum.request({ method: 'eth_accounts' })
      if (!accounts || accounts.length === 0) {
        addStatus('❌ No accounts found')
        return
      }

      const chainId = await window.ethereum.request({ method: 'eth_chainId' })
      if (chainId !== EXPECTED_CHAIN_ID) {
        addStatus('⚠️  Switching to BNB Chain...')
        try {
          await window.ethereum.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: EXPECTED_CHAIN_ID }],
          })
          addStatus('✅ Switched to BNB Chain')
        } catch (switchError: any) {
          if (switchError.code === 4902) {
            addStatus('❌ BNB Chain not found in wallet')
          }
          return
        }
      }

      const selectedAccount = accounts[0].toLowerCase()
      setAccount(selectedAccount)
      addStatus(`✅ Connected: ${selectedAccount.slice(0, 6)}...${selectedAccount.slice(-4)}`)
    } catch (error) {
      addStatus(`❌ Connection failed: ${(error as Error).message}`)
    }
  }

  const pay = async (tierAmount: number) => {
    const callId = Math.random().toString(36).substring(7)

    if (paymentInProgressRef.current) {
      console.warn(`[Pay:${callId}] ⛔ BLOCKED - Already in progress`)
      return
    }

    paymentInProgressRef.current = true
    setLoading(true)
    setStatus([])
    setTxHash('')
    setSelectedTier(tierAmount)
    setTransactionStage('requesting')

    const tierEndpoints: Record<number, string> = {
      1: '/pong1',
      5: '/pong5',
      10: '/pong10',
    }
    const endpoint = tierEndpoints[tierAmount]

    if (!endpoint) {
      paymentInProgressRef.current = false
      addStatus('❌ Invalid tier selected')
      return
    }

    try {
      if (!window.ethereum) {
        throw new Error('MetaMask not found!')
      }

      const activeAccounts = await window.ethereum.request({ method: 'eth_requestAccounts' })
      const signingAccount = activeAccounts[0]?.toLowerCase()

      if (!signingAccount) {
        throw new Error('No account found in MetaMask')
      }

      // Step 1: Request challenge
      addStatus('🔄 Requesting EIP-2612 Permit...')
      const challengeRes = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ owner: signingAccount }),
      })

      if (challengeRes.status !== 402) {
        const err = await challengeRes.json()
        throw new Error(err.error || 'Challenge request failed')
      }

      const challenge = await challengeRes.json()
      addStatus('✅ Challenge received')

      // Step 2: Sign with viem
      setTransactionStage('signing')
      addStatus('🔏 Requesting signature...')

      const { createWalletClient, custom } = await import('viem')
      const { bsc } = await import('viem/chains')

      const walletClient = createWalletClient({
        account: signingAccount as `0x${string}`,
        chain: bsc,
        transport: custom(window.ethereum)
      })

      const typedData = {
        domain: challenge.domain,
        types: challenge.types,
        primaryType: challenge.primaryType as 'Permit',
        message: challenge.values,
      }

      const signature = await walletClient.signTypedData(typedData)
      addStatus('✅ Signature obtained')

      // Step 3: Settle
      setTransactionStage('settling')
      addStatus('⚡ Settling on-chain...')

      const settlePayload = {
        owner: challenge.values.owner,
        spender: challenge.values.spender,
        value: challenge.values.value,
        nonce: challenge.values.nonce,
        deadline: challenge.values.deadline,
        signature: signature,
      }

      const settleRes = await fetch('/settle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settlePayload),
      })

      if (settleRes.status !== 201) {
        const err = await settleRes.json()
        throw new Error(err.error + (err.details ? `: ${err.details}` : '') || 'Settlement failed')
      }

      const result = await settleRes.json()
      setTxHash(result.txHash)
      setAllocatedPong(result.allocationPONG)
      setTransactionStage('success')
      addStatus(`✅ Success! Tx: ${result.txHash}`)
      addStatus(`🎉 Allocated ${result.allocationPONG.toLocaleString()} PONG?`)
    } catch (error: any) {
      setTransactionStage('error')
      addStatus(`❌ Error: ${error.message}`)
    } finally {
      setLoading(false)
      paymentInProgressRef.current = false
    }
  }

  const resetTransaction = () => {
    setTransactionStage('idle')
    setTxHash('')
    setStatus([])
    setSelectedTier(null)
    setAllocatedPong(0)
    paymentInProgressRef.current = false
  }

  return (
    <div style={styles.container}>
      {/* Animated Background Elements */}
      <div style={styles.bgGradient1} />
      <div style={styles.bgGradient2} />
      <div style={styles.bgGrid} />

      {/* Floating Particles - Fixed positions to avoid hydration mismatch */}
      {PARTICLE_POSITIONS.map((particle, i) => (
        <motion.div
          key={`particle-${i}`}
          style={{
            ...styles.particle,
            left: `${particle.left}%`,
            top: `${particle.top}%`,
          }}
          animate={{
            y: [0, -80, 0],
            opacity: [0, 0.5, 0],
            scale: [0.8, 1.1, 0.8],
          }}
          transition={{
            duration: particle.duration,
            repeat: Infinity,
            delay: particle.delay,
          }}
        />
      ))}

      {/* Hero Section - Compact */}
      <motion.div
        style={styles.hero}
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        {/* x402 Protocol Badge */}
        <motion.div
          style={styles.x402Badge}
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1, duration: 0.4 }}
        >
          <span style={styles.x402BadgeIcon}>⚡</span>
          <span style={styles.x402BadgeText}>x402 Payments</span>
          <span style={styles.x402BadgePulse} />
        </motion.div>

        {/* Logo - Compact */}
        <motion.div
          style={styles.heroMascotContainer}
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.2, duration: 0.5 }}
        >
          <div style={styles.mascotGlow} />
          <motion.img
            src="/pong_logo.png"
            alt="PONG? Logo"
            style={styles.heroMascot}
            animate={{ y: [0, -10, 0] }}
            transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
          />
        </motion.div>

        {/* Title - Compact */}
        <motion.h1
          style={styles.heroTitle}
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.5 }}
        >
          <span className="gradient-text-gold" style={styles.pongText}>PONG?</span>
        </motion.h1>

        <motion.p
          style={styles.heroSubtitle}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4, duration: 0.5 }}
        >
          USD1 Facilitator on BSC · PONG? Meme Coin
        </motion.p>

        <motion.p
          style={styles.heroDescription}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.45, duration: 0.5 }}
        >
          Gasless payment via EIP-2612 Permit on BNB Chain. No gas fees for you, instant allocation.
          We implement off-chain signature authorization using EIP-2612's permit() function with domain-separated
          typed data (EIP-712), enabling meta-transactions where our backend submits the on-chain transaction
          while you sign off-chain. USD1 token approval happens gaslessly through cryptographic signatures.
        </motion.p>

        {/* Trust Badges - Compact */}
        <motion.div
          style={styles.trustBadges}
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.5 }}
        >
          {[
            { icon: '🚫', text: 'No Team' },
            { icon: '💯', text: 'Fair Launch' },
            { icon: '💧', text: '100% Liquidity' },
            { icon: '⚡', text: 'Gasless' },
          ].map((badge) => (
            <motion.div
              key={badge.text}
              style={styles.trustBadge}
              whileHover={{ scale: 1.05, y: -2 }}
            >
              <span style={styles.trustBadgeIcon}>{badge.icon}</span>
              <span>{badge.text}</span>
            </motion.div>
          ))}
        </motion.div>
      </motion.div>

      {/* Success Modal */}
      <AnimatePresence>
        {transactionStage === 'success' && (
          <motion.div
            style={styles.modal}
            onClick={resetTransaction}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              style={styles.successCard}
              onClick={(e) => e.stopPropagation()}
              initial={{ scale: 0.9, opacity: 0, y: 30 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 30 }}
              transition={{ type: 'spring', damping: 25 }}
            >
              <div style={styles.successMascotContainer}>
                <motion.img
                  src="/pong_logo.png"
                  alt="PONG? Logo"
                  style={styles.successMascot}
                  animate={{ y: [0, -8, 0] }}
                  transition={{ duration: 0.6, repeat: Infinity }}
                />
              </div>
              <motion.div
                style={styles.successIconContainer}
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.2, type: 'spring', damping: 15 }}
              >
                <div style={styles.successIcon}>✓</div>
              </motion.div>
              <h2 style={styles.successTitle}>Success!</h2>
              <p style={styles.successMessage}>
                You've been allocated{' '}
                <span className="gradient-text-gold" style={styles.successPongAmount}>
                  {allocatedPong.toLocaleString()} PONG?
                </span>
              </p>
              <div style={styles.successDetails}>
                <div style={styles.successDetailRow}>
                  <span style={styles.successDetailLabel}>Paid:</span>
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
              <motion.button
                style={styles.successButton}
                onClick={resetTransaction}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                Buy More PONG?
              </motion.button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <div style={styles.mainContent}>
        {!account ? (
          /* Wallet Connection Card - Compact */
          <motion.div
            style={styles.connectCard}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6, duration: 0.5 }}
          >
            <div style={styles.connectCardGlow} />
            <h2 style={styles.connectTitle}>Connect Wallet</h2>
            <p style={styles.connectDescription}>
              Connect to participate in the fair launch
            </p>
            <motion.button
              style={styles.connectButton}
              onClick={connectWallet}
              whileHover={{ scale: 1.02, boxShadow: '0 0 25px rgba(240, 185, 11, 0.4)' }}
              whileTap={{ scale: 0.98 }}
            >
              <span style={styles.connectButtonIcon}>🔌</span>
              Connect Wallet
            </motion.button>
            <div style={styles.techBadges}>
              <span style={styles.techBadge}>BNB Chain</span>
              <span style={{ ...styles.techBadge, ...styles.techBadgeHighlight }}>x402</span>
              <span style={styles.techBadge}>Gasless</span>
            </div>
          </motion.div>
        ) : transactionStage === 'idle' || transactionStage === 'error' ? (
          /* Pricing Tiers - Compact */
          <>
            <motion.div
              style={styles.accountBanner}
              initial={{ opacity: 0, y: -15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
            >
              <span style={styles.accountLabel}>Connected:</span>
              <span style={styles.accountAddress}>
                {account.slice(0, 6)}...{account.slice(-4)}
              </span>
              <div style={styles.connectedDot} />
            </motion.div>

            <motion.h2
              style={styles.tiersTitle}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.15, duration: 0.4 }}
            >
              Choose Your Tier
            </motion.h2>

            <div style={styles.tiersContainer}>
              {PAYMENT_TIERS.map((tier, index) => (
                <motion.div
                  key={tier.amount}
                  style={{
                    ...styles.tierCard,
                    ...(tier.popular ? styles.tierCardPopular : {}),
                  }}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 + index * 0.08, duration: 0.4 }}
                  whileHover={{ y: -6, transition: { duration: 0.2 } }}
                >
                  {tier.popular && (
                    <motion.div
                      style={styles.popularBadge}
                      initial={{ opacity: 0, y: -8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.4 + index * 0.08 }}
                    >
                      🔥 POPULAR
                    </motion.div>
                  )}
                  <div style={styles.tierHeader}>
                    <div className="gradient-text-gold" style={styles.tierAmount}>
                      {tier.usd1}
                    </div>
                    <div style={styles.tierCurrency}>USD1</div>
                  </div>
                  <div style={styles.tierDivider} />
                  <div style={styles.tierReward}>
                    <div style={styles.tierPongAmount}>{tier.pong.toLocaleString()}</div>
                    <div style={styles.tierPongLabel}>PONG?</div>
                  </div>
                  <div style={styles.tierRatio}>4,000 per USD1</div>
                  <motion.button
                    type="button"
                    style={{
                      ...styles.tierButton,
                      ...(tier.popular ? styles.tierButtonPopular : {}),
                      ...(loading ? { opacity: 0.5, cursor: 'not-allowed' } : {}),
                      pointerEvents: loading ? 'none' : 'auto',
                    }}
                    onClick={() => pay(tier.usd1)}
                    disabled={loading || paymentInProgressRef.current}
                    whileHover={!loading ? { scale: 1.02 } : {}}
                    whileTap={!loading ? { scale: 0.98 } : {}}
                  >
                    {loading && selectedTier === tier.usd1 ? (
                      <>
                        <motion.span
                          animate={{ rotate: 360 }}
                          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                        >
                          ⚡
                        </motion.span>
                        Processing...
                      </>
                    ) : (
                      'Select Tier'
                    )}
                  </motion.button>
                </motion.div>
              ))}
            </div>

            <AnimatePresence>
              {transactionStage === 'error' && status.length > 0 && (
                <motion.div
                  style={styles.errorCard}
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 15 }}
                >
                  <div style={styles.errorHeader}>
                    <span style={styles.errorIcon}>⚠️</span>
                    <span style={styles.errorTitle}>Transaction Failed</span>
                  </div>
                  <div style={styles.errorMessage}>{status[status.length - 1]}</div>
                  <motion.button
                    style={styles.errorButton}
                    onClick={resetTransaction}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    Try Again
                  </motion.button>
                </motion.div>
              )}
            </AnimatePresence>
          </>
        ) : (
          /* Transaction Progress - Compact */
          <motion.div
            style={styles.progressCard}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3 }}
          >
            <h2 style={styles.progressTitle}>Processing</h2>
            <p style={styles.progressSubtitle}>
              {selectedTier} USD1 → {PAYMENT_TIERS.find((t) => t.usd1 === selectedTier)?.pong.toLocaleString()} PONG?
            </p>

            <div style={styles.progressSteps}>
              {[
                { stage: 'requesting', label: 'Request', emoji: '📡' },
                { stage: 'signing', label: 'Sign', emoji: '✍️' },
                { stage: 'settling', label: 'Settle', emoji: '⚡' },
              ].map((step, index) => {
                const isActive = transactionStage === step.stage
                const isComplete =
                  (step.stage === 'requesting' && ['signing', 'settling'].includes(transactionStage)) ||
                  (step.stage === 'signing' && transactionStage === 'settling')

                return (
                  <div key={step.stage} style={styles.progressStepWrapper}>
                    {index > 0 && <div style={styles.progressStepConnector} />}
                    <motion.div
                      style={styles.progressStep}
                      animate={isActive ? { scale: [1, 1.05, 1] } : {}}
                      transition={{ duration: 1, repeat: Infinity }}
                    >
                      <div
                        style={{
                          ...styles.progressStepCircle,
                          ...(isActive ? styles.progressStepCircleActive : {}),
                          ...(isComplete ? styles.progressStepCircleComplete : {}),
                        }}
                      >
                        {isComplete ? '✓' : step.emoji}
                      </div>
                      <div style={styles.progressStepLabel}>{step.label}</div>
                    </motion.div>
                  </div>
                )
              })}
            </div>

            {/* Console Output - Compact */}
            {status.length > 0 && (
              <motion.div
                style={styles.progressConsole}
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                transition={{ duration: 0.3 }}
              >
                {status.slice(-4).map((msg, i) => (
                  <motion.div
                    key={i}
                    style={styles.progressConsoleItem}
                    initial={{ opacity: 0, x: -15 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.04 }}
                  >
                    {msg}
                  </motion.div>
                ))}
              </motion.div>
            )}
          </motion.div>
        )}
      </div>

      {/* Footer - Compact */}
      <motion.footer
        style={styles.footer}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1, duration: 0.5 }}
      >
        <div style={styles.footerContent}>
          <div style={styles.footerInfo}>
            <span style={styles.footerLabel}>x402 via EIP-2612</span>
          </div>
          <div style={styles.footerInfo}>
            <span style={styles.footerLabel}>BNB Chain</span>
          </div>
          <div style={styles.footerInfo}>
            <span style={styles.footerLabel}>4,000 PONG?/USD1</span>
          </div>
        </div>

        {/* API Endpoints Section */}
        <motion.div
          style={styles.apiSection}
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.2, duration: 0.5 }}
        >
          <div style={styles.apiHeader}>
            <span style={styles.apiTitle}>🔌 API Endpoints</span>
            <a
              href="https://x.com/PONGBNBx402"
              target="_blank"
              rel="noopener noreferrer"
              style={styles.twitterLink}
            >
              @PONGBNBx402 ↗
            </a>
          </div>
          <div style={styles.apiEndpoints}>
            {[
              { endpoint: '/pong1', description: '1 USD1 → 4,000 PONG?' },
              { endpoint: '/pong5', description: '5 USD1 → 20,000 PONG?' },
              { endpoint: '/pong10', description: '10 USD1 → 40,000 PONG?' },
            ].map((api) => (
              <div key={api.endpoint} style={styles.apiEndpoint}>
                <code style={styles.apiCode}>POST {api.endpoint}</code>
                <span style={styles.apiDescription}>{api.description}</span>
                <span style={styles.apiStatus}>402 Payment Required</span>
              </div>
            ))}
          </div>
          <div style={styles.apiNote}>
            Browser access shows paywall interface. API access returns 402 Payment Required with EIP-2612 challenge.
          </div>
        </motion.div>

        {/* About Link */}
        <motion.div
          style={styles.aboutSection}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.4, duration: 0.5 }}
        >
          <Link href="/about" style={styles.aboutLink}>
            📄 About & Disclaimer
          </Link>
        </motion.div>
      </motion.footer>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    minHeight: '100vh',
    background: 'var(--bg-primary)',
    color: 'var(--text-primary)',
    padding: '16px',
    position: 'relative',
    overflow: 'hidden',
  },

  // Animated Background - Subtle
  bgGradient1: {
    position: 'absolute',
    top: '-15%',
    left: '-8%',
    width: '500px',
    height: '500px',
    background: 'radial-gradient(circle, rgba(240, 185, 11, 0.06) 0%, transparent 70%)',
    pointerEvents: 'none',
    zIndex: 0,
    filter: 'blur(50px)',
  },
  bgGradient2: {
    position: 'absolute',
    bottom: '-20%',
    right: '-8%',
    width: '600px',
    height: '600px',
    background: 'radial-gradient(circle, rgba(14, 203, 129, 0.04) 0%, transparent 70%)',
    pointerEvents: 'none',
    zIndex: 0,
    filter: 'blur(60px)',
  },
  bgGrid: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundImage: 'linear-gradient(rgba(43, 49, 57, 0.2) 1px, transparent 1px), linear-gradient(90deg, rgba(43, 49, 57, 0.2) 1px, transparent 1px)',
    backgroundSize: '40px 40px',
    opacity: 0.25,
    pointerEvents: 'none',
    zIndex: 0,
  },
  particle: {
    position: 'absolute',
    width: '3px',
    height: '3px',
    borderRadius: '50%',
    background: 'var(--color-binance-gold)',
    boxShadow: '0 0 8px rgba(240, 185, 11, 0.5)',
    pointerEvents: 'none',
    zIndex: 1,
  },

  // Hero Section - Compact
  hero: {
    textAlign: 'center',
    paddingTop: '20px',
    paddingBottom: '32px',
    position: 'relative',
    maxWidth: '900px',
    margin: '0 auto',
    zIndex: 2,
  },

  // x402 Protocol Badge - Compact
  x402Badge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    background: 'rgba(59, 130, 246, 0.1)',
    border: '1px solid rgba(59, 130, 246, 0.3)',
    borderRadius: '20px',
    padding: '6px 16px',
    fontSize: '11px',
    fontWeight: 600,
    color: '#3B82F6',
    marginBottom: '16px',
    position: 'relative',
    overflow: 'hidden',
  },
  x402BadgeIcon: {
    fontSize: '14px',
  },
  x402BadgeText: {
    letterSpacing: '0.3px',
  },
  x402BadgePulse: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: '20px',
    border: '1px solid rgba(59, 130, 246, 0.5)',
    animation: 'pulse 2s ease-in-out infinite',
  },

  // Logo - Compact
  heroMascotContainer: {
    position: 'relative',
    marginBottom: '16px',
    display: 'flex',
    justifyContent: 'center',
  },
  mascotGlow: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    width: '140px',
    height: '140px',
    background: 'radial-gradient(circle, rgba(240, 185, 11, 0.25) 0%, transparent 70%)',
    filter: 'blur(30px)',
    pointerEvents: 'none',
    animation: 'pulse 3s ease-in-out infinite',
  },
  heroMascot: {
    width: '100px',
    height: '100px',
    objectFit: 'contain',
    filter: 'drop-shadow(0 8px 24px rgba(240, 185, 11, 0.35))',
    position: 'relative',
    zIndex: 1,
  },

  // Title - Compact
  heroTitle: {
    fontSize: '56px',
    fontWeight: 900,
    margin: '0 0 12px 0',
    letterSpacing: '-0.04em',
    lineHeight: '1',
  },
  pongText: {
    fontSize: 'inherit',
    fontWeight: 'inherit',
    textShadow: '0 0 30px rgba(240, 185, 11, 0.25)',
  },
  heroSubtitle: {
    fontSize: '18px',
    fontWeight: 600,
    color: 'var(--text-secondary)',
    margin: '0 0 12px 0',
  },
  heroDescription: {
    fontSize: '13px',
    color: 'var(--text-tertiary)',
    margin: '0 0 24px 0',
    maxWidth: '700px',
    marginLeft: 'auto',
    marginRight: 'auto',
    lineHeight: '1.7',
    padding: '0 16px',
  },

  // Trust Badges - Compact
  trustBadges: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '8px',
    justifyContent: 'center',
    maxWidth: '600px',
    margin: '0 auto',
  },
  trustBadge: {
    background: 'rgba(14, 203, 129, 0.08)',
    border: '1px solid rgba(14, 203, 129, 0.25)',
    borderRadius: '8px',
    padding: '8px 14px',
    fontSize: '12px',
    fontWeight: 600,
    color: 'var(--color-success)',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    cursor: 'default',
    transition: 'all 0.2s ease',
  },
  trustBadgeIcon: {
    fontSize: '14px',
  },

  // Main Content
  mainContent: {
    maxWidth: '1100px',
    margin: '0 auto',
    position: 'relative',
    zIndex: 2,
  },

  // Connect Card - Compact
  connectCard: {
    background: 'var(--bg-secondary)',
    border: '1px solid var(--border-color)',
    borderRadius: '20px',
    padding: '40px 32px',
    maxWidth: '440px',
    margin: '0 auto',
    textAlign: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  connectCardGlow: {
    position: 'absolute',
    top: '-50%',
    left: '-50%',
    width: '200%',
    height: '200%',
    background: 'radial-gradient(circle, rgba(240, 185, 11, 0.04) 0%, transparent 50%)',
    pointerEvents: 'none',
  },
  connectTitle: {
    fontSize: '28px',
    fontWeight: 700,
    margin: '0 0 10px 0',
    background: 'linear-gradient(135deg, var(--text-primary) 0%, var(--text-secondary) 100%)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    backgroundClip: 'text',
  },
  connectDescription: {
    fontSize: '14px',
    color: 'var(--text-secondary)',
    margin: '0 0 28px 0',
    lineHeight: '1.5',
  },
  connectButton: {
    width: '100%',
    background: 'linear-gradient(135deg, var(--color-binance-gold) 0%, var(--color-binance-gold-dark) 100%)',
    color: '#000',
    border: 'none',
    borderRadius: '12px',
    padding: '16px 28px',
    fontSize: '16px',
    fontWeight: 700,
    cursor: 'pointer',
    transition: 'all 0.3s ease',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '10px',
    boxShadow: '0 4px 18px rgba(240, 185, 11, 0.3)',
  },
  connectButtonIcon: {
    fontSize: '20px',
  },
  techBadges: {
    display: 'flex',
    gap: '8px',
    flexWrap: 'wrap',
    marginTop: '20px',
    justifyContent: 'center',
  },
  techBadge: {
    background: 'var(--bg-elevated)',
    border: '1px solid var(--border-color)',
    borderRadius: '6px',
    padding: '6px 12px',
    fontSize: '11px',
    color: 'var(--text-tertiary)',
    fontFamily: 'Monaco, "Courier New", monospace',
    fontWeight: 600,
  },
  techBadgeHighlight: {
    background: 'rgba(59, 130, 246, 0.1)',
    border: '1px solid rgba(59, 130, 246, 0.3)',
    color: '#3B82F6',
  },

  // Account Banner - Compact
  accountBanner: {
    background: 'rgba(240, 185, 11, 0.08)',
    border: '1px solid rgba(240, 185, 11, 0.25)',
    borderRadius: '10px',
    padding: '12px 20px',
    marginBottom: '28px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '10px',
    flexWrap: 'wrap',
  },
  accountLabel: {
    fontSize: '13px',
    color: 'var(--text-secondary)',
    fontWeight: 500,
  },
  accountAddress: {
    fontSize: '14px',
    color: 'var(--color-binance-gold)',
    fontFamily: 'Monaco, "Courier New", monospace',
    fontWeight: 700,
  },
  connectedDot: {
    width: '7px',
    height: '7px',
    borderRadius: '50%',
    background: 'var(--color-success)',
    boxShadow: '0 0 8px var(--color-success)',
    animation: 'pulse 2s ease-in-out infinite',
  },

  // Tiers - Compact
  tiersTitle: {
    fontSize: '28px',
    fontWeight: 700,
    textAlign: 'center',
    margin: '0 0 24px 0',
    background: 'linear-gradient(135deg, var(--text-primary) 0%, var(--text-secondary) 100%)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    backgroundClip: 'text',
  },
  tiersContainer: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
    gap: '20px',
    marginBottom: '28px',
  },
  tierCard: {
    background: 'var(--bg-secondary)',
    border: '1px solid var(--border-color)',
    borderRadius: '16px',
    padding: '28px 20px',
    textAlign: 'center',
    position: 'relative',
    transition: 'all 0.3s ease',
    cursor: 'pointer',
  },
  tierCardPopular: {
    border: '2px solid var(--color-binance-gold)',
    boxShadow: '0 0 30px rgba(240, 185, 11, 0.12)',
    background: 'linear-gradient(135deg, rgba(240, 185, 11, 0.03) 0%, var(--bg-secondary) 100%)',
  },
  popularBadge: {
    position: 'absolute',
    top: '-12px',
    left: '50%',
    transform: 'translateX(-50%)',
    background: 'linear-gradient(135deg, var(--color-binance-gold) 0%, var(--color-binance-gold-dark) 100%)',
    color: '#000',
    padding: '6px 16px',
    borderRadius: '20px',
    fontSize: '10px',
    fontWeight: 700,
    letterSpacing: '0.5px',
    boxShadow: '0 4px 14px rgba(240, 185, 11, 0.35)',
  },
  tierHeader: {
    marginBottom: '20px',
  },
  tierAmount: {
    fontSize: '52px',
    fontWeight: 900,
    lineHeight: '1',
    marginBottom: '6px',
  },
  tierCurrency: {
    fontSize: '16px',
    color: 'var(--text-tertiary)',
    fontWeight: 600,
  },
  tierDivider: {
    height: '1px',
    background: 'linear-gradient(90deg, transparent 0%, var(--border-color) 50%, transparent 100%)',
    margin: '20px 0',
  },
  tierReward: {
    marginBottom: '12px',
  },
  tierPongAmount: {
    fontSize: '30px',
    fontWeight: 700,
    color: 'var(--color-binance-gold)',
    marginBottom: '6px',
  },
  tierPongLabel: {
    fontSize: '13px',
    color: 'var(--text-tertiary)',
  },
  tierRatio: {
    fontSize: '11px',
    color: 'var(--text-disabled)',
    marginBottom: '20px',
    fontFamily: 'Monaco, "Courier New", monospace',
  },
  tierButton: {
    width: '100%',
    background: 'var(--bg-tertiary)',
    border: '1px solid var(--border-hover)',
    color: 'var(--text-primary)',
    borderRadius: '10px',
    padding: '14px 24px',
    fontSize: '14px',
    fontWeight: 700,
    cursor: 'pointer',
    transition: 'all 0.3s ease',
  },
  tierButtonPopular: {
    background: 'linear-gradient(135deg, var(--color-binance-gold) 0%, var(--color-binance-gold-dark) 100%)',
    border: 'none',
    color: '#000',
    boxShadow: '0 4px 18px rgba(240, 185, 11, 0.3)',
  },

  // Progress Card - Compact
  progressCard: {
    background: 'var(--bg-secondary)',
    border: '1px solid var(--border-color)',
    borderRadius: '20px',
    padding: '36px 28px',
    maxWidth: '700px',
    margin: '0 auto',
  },
  progressTitle: {
    fontSize: '28px',
    fontWeight: 700,
    textAlign: 'center',
    margin: '0 0 10px 0',
  },
  progressSubtitle: {
    fontSize: '14px',
    color: 'var(--text-secondary)',
    textAlign: 'center',
    margin: '0 0 36px 0',
  },
  progressSteps: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: '32px',
  },
  progressStepWrapper: {
    flex: '1',
    display: 'flex',
    alignItems: 'flex-start',
  },
  progressStep: {
    flex: '0 0 auto',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '12px',
  },
  progressStepCircle: {
    width: '52px',
    height: '52px',
    borderRadius: '50%',
    background: 'var(--bg-elevated)',
    border: '2px solid var(--border-color)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '20px',
    fontWeight: 700,
    color: 'var(--text-disabled)',
    transition: 'all 0.3s ease',
  },
  progressStepCircleActive: {
    background: 'linear-gradient(135deg, var(--color-binance-gold) 0%, var(--color-binance-gold-dark) 100%)',
    border: '2px solid var(--color-binance-gold)',
    color: '#000',
    boxShadow: '0 0 25px rgba(240, 185, 11, 0.35)',
  },
  progressStepCircleComplete: {
    background: 'var(--color-success)',
    border: '2px solid var(--color-success)',
    color: '#fff',
    boxShadow: '0 0 18px rgba(14, 203, 129, 0.3)',
  },
  progressStepLabel: {
    fontSize: '12px',
    color: 'var(--text-secondary)',
    fontWeight: 600,
    textAlign: 'center',
  },
  progressStepConnector: {
    flex: '1',
    height: '2px',
    background: 'var(--border-color)',
    marginTop: '26px',
    marginLeft: '8px',
    marginRight: '8px',
  },
  progressConsole: {
    background: 'var(--bg-elevated)',
    border: '1px solid var(--border-color)',
    borderRadius: '10px',
    padding: '16px',
    fontSize: '11px',
    fontFamily: 'Monaco, "Courier New", monospace',
    color: 'var(--text-secondary)',
    maxHeight: '180px',
    overflowY: 'auto',
  },
  progressConsoleItem: {
    marginBottom: '8px',
    lineHeight: '1.5',
  },

  // Success Modal - Compact
  modal: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(0, 0, 0, 0.85)',
    backdropFilter: 'blur(10px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    padding: '16px',
  },
  successCard: {
    background: 'var(--bg-secondary)',
    border: '2px solid var(--color-success)',
    borderRadius: '24px',
    padding: '44px 32px',
    maxWidth: '460px',
    width: '100%',
    textAlign: 'center',
    boxShadow: '0 0 60px rgba(14, 203, 129, 0.2)',
    position: 'relative',
  },
  successMascotContainer: {
    position: 'absolute',
    top: '-50px',
    left: '50%',
    transform: 'translateX(-50%)',
    zIndex: 10,
  },
  successMascot: {
    width: '90px',
    height: '90px',
    objectFit: 'contain',
    filter: 'drop-shadow(0 8px 30px rgba(240, 185, 11, 0.5))',
  },
  successIconContainer: {
    marginBottom: '20px',
  },
  successIcon: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '72px',
    height: '72px',
    borderRadius: '50%',
    background: 'linear-gradient(135deg, var(--color-success) 0%, var(--color-success-dark) 100%)',
    color: '#fff',
    fontSize: '44px',
    fontWeight: 700,
    boxShadow: '0 8px 32px rgba(14, 203, 129, 0.35)',
  },
  successTitle: {
    fontSize: '30px',
    fontWeight: 700,
    margin: '0 0 16px 0',
    color: 'var(--color-success)',
  },
  successMessage: {
    fontSize: '16px',
    color: 'var(--text-secondary)',
    margin: '0 0 28px 0',
    lineHeight: '1.5',
  },
  successPongAmount: {
    fontSize: '20px',
    fontWeight: 800,
  },
  successDetails: {
    background: 'var(--bg-elevated)',
    border: '1px solid var(--border-color)',
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
    fontSize: '13px',
    color: 'var(--text-tertiary)',
    fontWeight: 500,
  },
  successDetailValue: {
    fontSize: '14px',
    color: 'var(--text-primary)',
    fontWeight: 700,
    fontFamily: 'Monaco, "Courier New", monospace',
  },
  successTxLink: {
    fontSize: '13px',
    color: 'var(--color-info)',
    textDecoration: 'none',
    fontWeight: 700,
  },
  successButton: {
    width: '100%',
    background: 'linear-gradient(135deg, var(--color-binance-gold) 0%, var(--color-binance-gold-dark) 100%)',
    color: '#000',
    border: 'none',
    borderRadius: '12px',
    padding: '16px 28px',
    fontSize: '15px',
    fontWeight: 700,
    cursor: 'pointer',
    transition: 'all 0.3s ease',
    boxShadow: '0 4px 18px rgba(240, 185, 11, 0.3)',
  },

  // Error Card - Compact
  errorCard: {
    background: 'rgba(246, 70, 93, 0.08)',
    border: '1px solid rgba(246, 70, 93, 0.3)',
    borderRadius: '12px',
    padding: '20px',
    marginTop: '20px',
  },
  errorHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    marginBottom: '12px',
  },
  errorIcon: {
    fontSize: '24px',
  },
  errorTitle: {
    fontSize: '18px',
    fontWeight: 700,
    color: 'var(--color-error)',
  },
  errorMessage: {
    fontSize: '12px',
    color: '#FCA5A5',
    fontFamily: 'Monaco, "Courier New", monospace',
    marginBottom: '16px',
    lineHeight: '1.5',
  },
  errorButton: {
    background: 'var(--color-error)',
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    padding: '10px 20px',
    fontSize: '14px',
    fontWeight: 700,
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  },

  // Footer - Compact
  footer: {
    marginTop: '56px',
    paddingTop: '28px',
    borderTop: '1px solid var(--border-color)',
    textAlign: 'center',
    position: 'relative',
    zIndex: 2,
  },
  footerContent: {
    display: 'flex',
    gap: '24px',
    justifyContent: 'center',
    flexWrap: 'wrap',
  },
  footerInfo: {
    display: 'flex',
    gap: '8px',
    alignItems: 'center',
  },
  footerLabel: {
    fontSize: '11px',
    color: 'var(--text-disabled)',
    fontFamily: 'Monaco, "Courier New", monospace',
    fontWeight: 600,
  },

  // API Section
  apiSection: {
    marginTop: '32px',
    paddingTop: '28px',
    borderTop: '1px solid var(--border-color)',
    maxWidth: '700px',
    margin: '32px auto 0 auto',
  },
  apiHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '20px',
    flexWrap: 'wrap',
    gap: '12px',
  },
  apiTitle: {
    fontSize: '14px',
    fontWeight: 700,
    color: 'var(--text-primary)',
    letterSpacing: '0.3px',
  },
  twitterLink: {
    fontSize: '12px',
    color: 'var(--color-info)',
    textDecoration: 'none',
    fontWeight: 600,
    transition: 'opacity 0.2s ease',
  },
  apiEndpoints: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    marginBottom: '16px',
  },
  apiEndpoint: {
    background: 'var(--bg-elevated)',
    border: '1px solid var(--border-color)',
    borderRadius: '10px',
    padding: '14px 16px',
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    transition: 'all 0.2s ease',
  },
  apiCode: {
    fontSize: '13px',
    fontFamily: 'Monaco, "Courier New", monospace',
    color: 'var(--color-binance-gold)',
    fontWeight: 700,
    background: 'rgba(240, 185, 11, 0.08)',
    padding: '4px 8px',
    borderRadius: '4px',
    alignSelf: 'flex-start',
  },
  apiDescription: {
    fontSize: '12px',
    color: 'var(--text-secondary)',
    fontWeight: 500,
  },
  apiStatus: {
    fontSize: '10px',
    color: 'var(--color-info)',
    fontFamily: 'Monaco, "Courier New", monospace',
    fontWeight: 600,
    background: 'rgba(59, 130, 246, 0.08)',
    padding: '3px 8px',
    borderRadius: '4px',
    alignSelf: 'flex-start',
  },
  apiNote: {
    fontSize: '11px',
    color: 'var(--text-tertiary)',
    lineHeight: '1.6',
    fontStyle: 'italic',
    marginTop: '8px',
    padding: '12px',
    background: 'rgba(59, 130, 246, 0.05)',
    borderRadius: '8px',
    border: '1px solid rgba(59, 130, 246, 0.1)',
  },

  // About Section
  aboutSection: {
    marginTop: '32px',
    paddingTop: '24px',
    borderTop: '1px solid var(--border-color)',
    textAlign: 'center',
  },
  aboutLink: {
    display: 'inline-block',
    fontSize: '14px',
    color: 'var(--text-primary)',
    textDecoration: 'none',
    fontWeight: 600,
    padding: '12px 24px',
    background: 'var(--bg-elevated)',
    border: '1px solid var(--border-color)',
    borderRadius: '10px',
    transition: 'all 0.3s ease',
  },
}

declare global {
  interface Window {
    ethereum?: any
  }
}
