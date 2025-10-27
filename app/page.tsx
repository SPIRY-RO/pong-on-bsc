'use client'

import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

const EXPECTED_CHAIN_ID = '0x38' // BSC Mainnet (56 in hex)

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

  // Listen for MetaMask account changes
  useEffect(() => {
    if (!window.ethereum) return

    const handleAccountsChanged = (accounts: string[]) => {
      console.log('[MetaMask] Account changed:', accounts)
      if (accounts.length === 0) {
        // User disconnected
        setAccount('')
        addStatus('⚠️ Wallet disconnected')
      } else {
        const newAccount = accounts[0].toLowerCase()
        console.log('[MetaMask] Switching to new account:', newAccount)
        setAccount(newAccount)
        addStatus(`✅ Switched to: ${newAccount.slice(0, 6)}...${newAccount.slice(-4)}`)
        // Reset transaction state when account changes
        resetTransaction()
      }
    }

    window.ethereum.on('accountsChanged', handleAccountsChanged)

    return () => {
      window.ethereum.removeListener('accountsChanged', handleAccountsChanged)
    }
  }, [])

  const connectWallet = async () => {
    try {
      console.log('[Wallet] Starting connection...')

      if (!window.ethereum) {
        console.error('[Wallet] MetaMask not found')
        addStatus('❌ MetaMask not found')
        alert('MetaMask not found! Please install MetaMask extension.')
        return
      }

      // CRITICAL: Use wallet_requestPermissions to force account selection
      // This ensures the user explicitly picks which account to use
      console.log('[Wallet] Requesting permission to connect...')
      addStatus('🔄 Please select your account in MetaMask...')

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
        console.log('[Wallet] Permission request failed, trying eth_requestAccounts...')
      }

      const accounts = await window.ethereum.request({
        method: 'eth_accounts',
      })
      console.log('[Wallet] Accounts:', accounts)

      if (!accounts || accounts.length === 0) {
        addStatus('❌ No accounts found')
        return
      }

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
      console.log('[Wallet] Selected account:', selectedAccount)
      setAccount(selectedAccount)
      addStatus(`✅ Connected: ${selectedAccount.slice(0, 6)}...${selectedAccount.slice(-4)}`)
      console.log('[Wallet] Connection successful!')
      console.log('[Wallet] 🎯 THIS is the account that will be used for signing!')
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
      console.warn(`[Pay:${callId}] 🚨 DUPLICATE CALL PREVENTED! This should not happen!`)
      return
    }

    // Set ref immediately to block any other calls
    paymentInProgressRef.current = true
    console.log(`[Pay:${callId}] ✅ Lock acquired, proceeding...`)
    console.log(`[Pay:${callId}] 🔒 NO MORE CALLS SHOULD HAPPEN UNTIL THIS COMPLETES`)

    // NEW APPROACH: Don't check account state - we'll get it from MetaMask directly
    // This eliminates the "connected account vs signing account" mismatch!

    setLoading(true)
    setStatus([])
    setTxHash('')
    setSelectedTier(tierAmount)
    setTransactionStage('requesting')

    // Map tier amount to endpoint
    const tierEndpoints: Record<number, string> = {
      1: '/pong1',      // Tier 1: 1 USD1 → 4,000 PONG
      5: '/pong5',      // Tier 2: 5 USD1 → 20,000 PONG (MOST POPULAR)
      10: '/pong10',    // Tier 3: 10 USD1 → 40,000 PONG
    }
    const endpoint = tierEndpoints[tierAmount]

    if (!endpoint) {
      console.error(`[Pay:${callId}] Invalid tier amount:`, tierAmount)
      paymentInProgressRef.current = false
      addStatus('❌ Invalid tier selected')
      return
    }

    try {
      // Step 0: Get the CURRENTLY SELECTED account from MetaMask
      // CRITICAL: Use eth_requestAccounts (not eth_accounts) to get the ACTIVE account
      // eth_requestAccounts returns the account that's CURRENTLY SELECTED in MetaMask UI
      // This is the account that WILL sign when we call eth_signTypedData_v4
      if (!window.ethereum) {
        throw new Error('MetaMask not found! Please install MetaMask.')
      }

      // eth_requestAccounts prompts user if needed and returns currently selected account
      const activeAccounts = await window.ethereum.request({ method: 'eth_requestAccounts' })
      const signingAccount = activeAccounts[0]?.toLowerCase()

      if (!signingAccount) {
        throw new Error('No account found in MetaMask. Please select an account.')
      }

      console.log(`[Pay:${callId}] 🎯 CURRENTLY SELECTED METAMASK ACCOUNT: ${signingAccount}`)
      console.log(`[Pay:${callId}] This is the account that WILL sign the transaction!`)
      console.log(`[Pay:${callId}] (Retrieved via eth_requestAccounts - guarantees current selection)`)

      // Step 1: Request challenge FOR THE ACTIVE ACCOUNT
      addStatus('🔄 Requesting EIP-2612 Permit challenge...')
      console.log(`[Pay:${callId}] Fetching challenge from ${endpoint}`)
      console.log(`[Pay:${callId}] Requesting challenge for owner: ${signingAccount}`)

      const challengeRes = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ owner: signingAccount }), // Use ACTIVE account, not state!
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
      console.log(`[Pay:${callId}] 🔍 CHALLENGE DETAILS:`)
      console.log(`[Pay:${callId}]   domain.name: "${challenge.domain.name}"`)
      console.log(`[Pay:${callId}]   domain.version: "${challenge.domain.version}"`)
      console.log(`[Pay:${callId}]   domain.chainId: ${challenge.domain.chainId}`)
      console.log(`[Pay:${callId}]   domain.verifyingContract: ${challenge.domain.verifyingContract}`)
      console.log(`[Pay:${callId}]   values.owner: ${challenge.values.owner}`)
      console.log(`[Pay:${callId}]   values.spender: ${challenge.values.spender}`)
      console.log(`[Pay:${callId}]   values.value: ${challenge.values.value}`)
      console.log(`[Pay:${callId}]   values.nonce: ${challenge.values.nonce}`)
      console.log(`[Pay:${callId}]   values.deadline: ${challenge.values.deadline}`)
      console.log(`[Pay:${callId}] 🎯 Expected signer: ${challenge.values.owner}`)
      addStatus('✅ Challenge received')

      // Step 2: Sign using viem WalletClient (x402-permit pattern!)
      // CRITICAL: Don't use raw window.ethereum.request()
      // Use viem's WalletClient with custom(window.ethereum) transport
      setTransactionStage('signing')
      addStatus('🔏 Requesting signature...')

      console.log(`[Pay:${callId}] ===== CREATING VIEM WALLET CLIENT (x402-permit pattern) =====`)
      console.log(`[Pay:${callId}] 🔑 Account from eth_requestAccounts: ${signingAccount}`)
      console.log(`[Pay:${callId}] 📝 Challenge generated for owner: ${challenge.values.owner}`)
      console.log(`[Pay:${callId}] ✅ Match check: ${signingAccount === challenge.values.owner.toLowerCase()}`)

      // Create viem WalletClient (exactly like x402-permit does)
      const { createWalletClient, custom } = await import('viem')
      const { bsc } = await import('viem/chains')

      const walletClient = createWalletClient({
        account: signingAccount as `0x${string}`,
        chain: bsc,
        transport: custom(window.ethereum)
      })

      console.log(`[Pay:${callId}] ✅ Viem WalletClient created`)
      console.log(`[Pay:${callId}] ✅ Account: ${walletClient.account.address}`)

      // Build typed data for signing (x402-permit format)
      const typedData = {
        domain: challenge.domain,
        types: challenge.types,
        primaryType: challenge.primaryType as 'Permit',
        message: challenge.values,
      }

      console.log(`[Pay:${callId}] ===== SIGNING WITH VIEM WALLETCLIENT =====`)
      console.log(`[Pay:${callId}] Domain:`, JSON.stringify(challenge.domain, null, 2))
      console.log(`[Pay:${callId}] Message:`, JSON.stringify(challenge.values, null, 2))

      // Sign using viem's signTypedData (NOT raw eth_signTypedData_v4!)
      const signature = await walletClient.signTypedData(typedData)

      console.log(`[Pay:${callId}] ✅ Signature received from viem WalletClient`)
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
      {/* Animated Background Elements */}
      <div style={styles.bgGradient1} />
      <div style={styles.bgGradient2} />
      <div style={styles.bgGrid} />

      {/* Floating Particles */}
      {[...Array(8)].map((_, i) => (
        <motion.div
          key={i}
          style={{
            ...styles.particle,
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * 100}%`,
          }}
          animate={{
            y: [0, -100, 0],
            x: [0, Math.random() * 50 - 25, 0],
            opacity: [0, 0.6, 0],
            scale: [0.8, 1.2, 0.8],
          }}
          transition={{
            duration: 5 + Math.random() * 5,
            repeat: Infinity,
            delay: Math.random() * 5,
          }}
        />
      ))}

      {/* Hero Section */}
      <motion.div
        style={styles.hero}
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        {/* x402 Protocol Badge */}
        <motion.div
          style={styles.x402Badge}
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2, duration: 0.5 }}
        >
          <span style={styles.x402BadgeIcon}>⚡</span>
          <span style={styles.x402BadgeText}>x402 Payments Enabled</span>
          <span style={styles.x402BadgePulse} />
        </motion.div>

        {/* Mascot with Enhanced Glow */}
        <motion.div
          style={styles.heroMascotContainer}
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.3, duration: 0.6, type: 'spring' }}
        >
          <div style={styles.mascotGlow} />
          <motion.img
            src="/pong_logo.png"
            alt="PONG Logo"
            style={styles.heroMascot}
            animate={{ y: [0, -15, 0] }}
            transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
          />
        </motion.div>

        {/* Title with Gradient Animation */}
        <motion.h1
          style={styles.heroTitle}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.6 }}
        >
          <span className="gradient-text-gold" style={styles.pongText}>
            PONG
          </span>
        </motion.h1>

        <motion.p
          style={styles.heroSubtitle}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5, duration: 0.6 }}
        >
          Fair Launch Token Distribution
        </motion.p>

        <motion.p
          style={styles.heroDescription}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6, duration: 0.6 }}
        >
          Gasless payment via EIP-2612 Permit on BNB Chain. No gas fees for you, instant allocation.
        </motion.p>

        {/* Trust Badges */}
        <motion.div
          style={styles.trustBadges}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7, duration: 0.6 }}
        >
          {[
            { icon: '🚫', text: 'No Team Allocation' },
            { icon: '💯', text: 'No Founder Tokens' },
            { icon: '💧', text: '100% to Liquidity' },
            { icon: '⚖️', text: 'Fair Launch' },
          ].map((badge, i) => (
            <motion.div
              key={badge.text}
              style={styles.trustBadge}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.8 + i * 0.1, duration: 0.4 }}
              whileHover={{ scale: 1.05, y: -2 }}
            >
              <span style={styles.trustBadgeIcon}>{badge.icon}</span>
              <span>{badge.text}</span>
            </motion.div>
          ))}
        </motion.div>

        {/* BNB Chain Badge */}
        <motion.div
          style={styles.bnbBadge}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1, duration: 0.6 }}
        >
          <div style={styles.bnbBadgeInner}>
            <span style={styles.bnbBadgeText}>Powered by</span>
            <span style={styles.bnbBadgeLogo}>BNB CHAIN</span>
          </div>
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
              initial={{ scale: 0.8, opacity: 0, y: 50 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.8, opacity: 0, y: 50 }}
              transition={{ type: 'spring', damping: 20 }}
            >
              <div style={styles.successMascotContainer}>
                <motion.img
                  src="/pong_logo.png"
                  alt="PONG Logo"
                  style={styles.successMascot}
                  animate={{ y: [0, -10, 0] }}
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
              <h2 style={styles.successTitle}>Transaction Successful!</h2>
              <p style={styles.successMessage}>
                You've been allocated{' '}
                <span className="gradient-text-gold" style={styles.successPongAmount}>
                  {allocatedPong.toLocaleString()} PONG
                </span>
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
              <motion.button
                style={styles.successButton}
                onClick={resetTransaction}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                Make Another Purchase
              </motion.button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <div style={styles.mainContent}>
        {!account ? (
          /* Wallet Connection Card */
          <motion.div
            style={styles.connectCard}
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8, duration: 0.6 }}
          >
            <div style={styles.connectCardGlow} />
            <h2 style={styles.connectTitle}>Get Started</h2>
            <p style={styles.connectDescription}>
              Connect your wallet to participate in the PONG fair launch
            </p>
            <motion.button
              style={styles.connectButton}
              onClick={connectWallet}
              whileHover={{ scale: 1.02, boxShadow: '0 0 30px rgba(240, 185, 11, 0.4)' }}
              whileTap={{ scale: 0.98 }}
            >
              <span style={styles.connectButtonIcon}>🔌</span>
              Connect Wallet
            </motion.button>
            <div style={styles.techBadges}>
              <span style={styles.techBadge}>BNB Chain</span>
              <span style={styles.techBadge}>EIP-2612</span>
              <span style={styles.techBadge}>Gasless</span>
              <span style={{ ...styles.techBadge, ...styles.techBadgeHighlight }}>x402</span>
            </div>
          </motion.div>
        ) : transactionStage === 'idle' || transactionStage === 'error' ? (
          /* Pricing Tiers */
          <>
            <motion.div
              style={styles.accountBanner}
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
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
              transition={{ delay: 0.2, duration: 0.5 }}
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
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 + index * 0.1, duration: 0.5 }}
                  whileHover={{
                    y: -8,
                    transition: { duration: 0.2 },
                  }}
                >
                  {tier.popular && (
                    <motion.div
                      style={styles.popularBadge}
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.5 + index * 0.1 }}
                    >
                      🔥 MOST POPULAR
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
                    <div style={styles.tierPongLabel}>PONG Tokens</div>
                  </div>
                  <div style={styles.tierRatio}>4,000 PONG per USD1</div>
                  <motion.button
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
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 20 }}
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
          /* Transaction Progress */
          <motion.div
            style={styles.progressCard}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4 }}
          >
            <h2 style={styles.progressTitle}>Processing Transaction</h2>
            <p style={styles.progressSubtitle}>
              Purchasing {selectedTier} USD1 → {PAYMENT_TIERS.find((t) => t.usd1 === selectedTier)?.pong.toLocaleString()} PONG
            </p>

            <div style={styles.progressSteps}>
              {[
                { stage: 'requesting', label: 'Request Challenge', emoji: '📡' },
                { stage: 'signing', label: 'Sign Authorization', emoji: '✍️' },
                { stage: 'settling', label: 'Settle On-Chain', emoji: '⚡' },
              ].map((step, index) => {
                const isActive = transactionStage === step.stage
                const isComplete =
                  (step.stage === 'requesting' && ['signing', 'settling'].includes(transactionStage)) ||
                  (step.stage === 'signing' && transactionStage === 'settling')

                return (
                  <div key={step.stage}>
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
                      {isActive && (
                        <motion.div
                          style={styles.progressStepSpinner}
                          animate={{ rotate: 360 }}
                          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                        />
                      )}
                    </motion.div>
                  </div>
                )
              })}
            </div>

            {/* Console Output */}
            {status.length > 0 && (
              <motion.div
                style={styles.progressConsole}
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                transition={{ duration: 0.3 }}
              >
                {status.slice(-5).map((msg, i) => (
                  <motion.div
                    key={i}
                    style={styles.progressConsoleItem}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                  >
                    {msg}
                  </motion.div>
                ))}
              </motion.div>
            )}
          </motion.div>
        )}
      </div>

      {/* Footer */}
      <motion.footer
        style={styles.footer}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.2, duration: 0.6 }}
      >
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
      </motion.footer>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    minHeight: '100vh',
    background: 'var(--bg-primary)',
    color: 'var(--text-primary)',
    padding: '20px',
    position: 'relative',
    overflow: 'hidden',
  },

  // Animated Background
  bgGradient1: {
    position: 'absolute',
    top: '-20%',
    left: '-10%',
    width: '800px',
    height: '800px',
    background: 'radial-gradient(circle, rgba(240, 185, 11, 0.08) 0%, transparent 70%)',
    pointerEvents: 'none',
    zIndex: 0,
    filter: 'blur(60px)',
  },
  bgGradient2: {
    position: 'absolute',
    bottom: '-30%',
    right: '-10%',
    width: '1000px',
    height: '1000px',
    background: 'radial-gradient(circle, rgba(14, 203, 129, 0.06) 0%, transparent 70%)',
    pointerEvents: 'none',
    zIndex: 0,
    filter: 'blur(80px)',
  },
  bgGrid: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundImage: 'linear-gradient(rgba(43, 49, 57, 0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(43, 49, 57, 0.3) 1px, transparent 1px)',
    backgroundSize: '50px 50px',
    opacity: 0.3,
    pointerEvents: 'none',
    zIndex: 0,
  },
  particle: {
    position: 'absolute',
    width: '4px',
    height: '4px',
    borderRadius: '50%',
    background: 'var(--color-binance-gold)',
    boxShadow: '0 0 10px rgba(240, 185, 11, 0.6)',
    pointerEvents: 'none',
    zIndex: 1,
  },

  // Hero Section
  hero: {
    textAlign: 'center',
    paddingTop: '40px',
    paddingBottom: '60px',
    position: 'relative',
    maxWidth: '1000px',
    margin: '0 auto',
    zIndex: 2,
  },

  // x402 Protocol Badge
  x402Badge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    background: 'rgba(59, 130, 246, 0.1)',
    border: '1px solid rgba(59, 130, 246, 0.3)',
    borderRadius: '24px',
    padding: '8px 20px',
    fontSize: '13px',
    fontWeight: 600,
    color: '#3B82F6',
    marginBottom: '24px',
    position: 'relative',
    overflow: 'hidden',
  },
  x402BadgeIcon: {
    fontSize: '16px',
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
    borderRadius: '24px',
    border: '1px solid rgba(59, 130, 246, 0.5)',
    animation: 'pulse 2s ease-in-out infinite',
  },

  // Mascot
  heroMascotContainer: {
    position: 'relative',
    marginBottom: '24px',
    display: 'flex',
    justifyContent: 'center',
  },
  mascotGlow: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    width: '200px',
    height: '200px',
    background: 'radial-gradient(circle, rgba(240, 185, 11, 0.3) 0%, transparent 70%)',
    filter: 'blur(40px)',
    pointerEvents: 'none',
    animation: 'pulse 3s ease-in-out infinite',
  },
  heroMascot: {
    width: '140px',
    height: '140px',
    objectFit: 'contain',
    filter: 'drop-shadow(0 10px 30px rgba(240, 185, 11, 0.4))',
    position: 'relative',
    zIndex: 1,
  },

  // Title
  heroTitle: {
    fontSize: '80px',
    fontWeight: 900,
    margin: '0 0 16px 0',
    letterSpacing: '-0.04em',
    lineHeight: '1',
  },
  pongText: {
    fontSize: 'inherit',
    fontWeight: 'inherit',
    textShadow: '0 0 40px rgba(240, 185, 11, 0.3)',
  },
  heroSubtitle: {
    fontSize: '26px',
    fontWeight: 600,
    color: 'var(--text-secondary)',
    margin: '0 0 12px 0',
  },
  heroDescription: {
    fontSize: '16px',
    color: 'var(--text-tertiary)',
    margin: '0 0 40px 0',
    maxWidth: '640px',
    marginLeft: 'auto',
    marginRight: 'auto',
    lineHeight: '1.6',
  },

  // Trust Badges
  trustBadges: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '12px',
    justifyContent: 'center',
    maxWidth: '800px',
    margin: '0 auto 32px auto',
  },
  trustBadge: {
    background: 'rgba(14, 203, 129, 0.08)',
    border: '1px solid rgba(14, 203, 129, 0.25)',
    borderRadius: '10px',
    padding: '12px 20px',
    fontSize: '14px',
    fontWeight: 600,
    color: 'var(--color-success)',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    cursor: 'default',
    transition: 'all 0.2s ease',
  },
  trustBadgeIcon: {
    fontSize: '18px',
  },

  // BNB Chain Badge
  bnbBadge: {
    display: 'inline-block',
    marginTop: '16px',
  },
  bnbBadgeInner: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    background: 'rgba(240, 185, 11, 0.05)',
    border: '1px solid rgba(240, 185, 11, 0.2)',
    borderRadius: '8px',
    padding: '8px 16px',
  },
  bnbBadgeText: {
    fontSize: '12px',
    color: 'var(--text-tertiary)',
  },
  bnbBadgeLogo: {
    fontSize: '14px',
    fontWeight: 700,
    color: 'var(--color-binance-gold)',
    letterSpacing: '1px',
  },

  // Main Content
  mainContent: {
    maxWidth: '1200px',
    margin: '0 auto',
    position: 'relative',
    zIndex: 2,
  },

  // Connect Card
  connectCard: {
    background: 'var(--bg-secondary)',
    border: '1px solid var(--border-color)',
    borderRadius: '24px',
    padding: '56px',
    maxWidth: '520px',
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
    background: 'radial-gradient(circle, rgba(240, 185, 11, 0.05) 0%, transparent 50%)',
    pointerEvents: 'none',
  },
  connectTitle: {
    fontSize: '36px',
    fontWeight: 700,
    margin: '0 0 12px 0',
    background: 'linear-gradient(135deg, var(--text-primary) 0%, var(--text-secondary) 100%)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    backgroundClip: 'text',
  },
  connectDescription: {
    fontSize: '16px',
    color: 'var(--text-secondary)',
    margin: '0 0 36px 0',
    lineHeight: '1.6',
  },
  connectButton: {
    width: '100%',
    background: 'linear-gradient(135deg, var(--color-binance-gold) 0%, var(--color-binance-gold-dark) 100%)',
    color: '#000',
    border: 'none',
    borderRadius: '12px',
    padding: '20px 32px',
    fontSize: '18px',
    fontWeight: 700,
    cursor: 'pointer',
    transition: 'all 0.3s ease',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '12px',
    boxShadow: '0 4px 20px rgba(240, 185, 11, 0.3)',
  },
  connectButtonIcon: {
    fontSize: '24px',
  },
  techBadges: {
    display: 'flex',
    gap: '10px',
    flexWrap: 'wrap',
    marginTop: '28px',
    justifyContent: 'center',
  },
  techBadge: {
    background: 'var(--bg-elevated)',
    border: '1px solid var(--border-color)',
    borderRadius: '6px',
    padding: '8px 14px',
    fontSize: '12px',
    color: 'var(--text-tertiary)',
    fontFamily: 'Monaco, "Courier New", monospace',
    fontWeight: 600,
  },
  techBadgeHighlight: {
    background: 'rgba(59, 130, 246, 0.1)',
    border: '1px solid rgba(59, 130, 246, 0.3)',
    color: '#3B82F6',
  },

  // Account Banner
  accountBanner: {
    background: 'rgba(240, 185, 11, 0.08)',
    border: '1px solid rgba(240, 185, 11, 0.25)',
    borderRadius: '12px',
    padding: '16px 28px',
    marginBottom: '40px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '12px',
    flexWrap: 'wrap',
    position: 'relative',
  },
  accountLabel: {
    fontSize: '14px',
    color: 'var(--text-secondary)',
    fontWeight: 500,
  },
  accountAddress: {
    fontSize: '15px',
    color: 'var(--color-binance-gold)',
    fontFamily: 'Monaco, "Courier New", monospace',
    fontWeight: 700,
    letterSpacing: '0.5px',
  },
  connectedDot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    background: 'var(--color-success)',
    boxShadow: '0 0 10px var(--color-success)',
    animation: 'pulse 2s ease-in-out infinite',
  },

  // Tiers
  tiersTitle: {
    fontSize: '36px',
    fontWeight: 700,
    textAlign: 'center',
    margin: '0 0 36px 0',
    background: 'linear-gradient(135deg, var(--text-primary) 0%, var(--text-secondary) 100%)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    backgroundClip: 'text',
  },
  tiersContainer: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
    gap: '28px',
    marginBottom: '40px',
  },
  tierCard: {
    background: 'var(--bg-secondary)',
    border: '1px solid var(--border-color)',
    borderRadius: '20px',
    padding: '36px 28px',
    textAlign: 'center',
    position: 'relative',
    transition: 'all 0.3s ease',
    cursor: 'pointer',
  },
  tierCardPopular: {
    border: '2px solid var(--color-binance-gold)',
    boxShadow: '0 0 40px rgba(240, 185, 11, 0.15)',
    background: 'linear-gradient(135deg, rgba(240, 185, 11, 0.03) 0%, var(--bg-secondary) 100%)',
  },
  popularBadge: {
    position: 'absolute',
    top: '-14px',
    left: '50%',
    transform: 'translateX(-50%)',
    background: 'linear-gradient(135deg, var(--color-binance-gold) 0%, var(--color-binance-gold-dark) 100%)',
    color: '#000',
    padding: '8px 20px',
    borderRadius: '24px',
    fontSize: '12px',
    fontWeight: 700,
    letterSpacing: '0.5px',
    boxShadow: '0 4px 16px rgba(240, 185, 11, 0.4)',
  },
  tierHeader: {
    marginBottom: '24px',
  },
  tierAmount: {
    fontSize: '64px',
    fontWeight: 900,
    lineHeight: '1',
    marginBottom: '8px',
  },
  tierCurrency: {
    fontSize: '18px',
    color: 'var(--text-tertiary)',
    fontWeight: 600,
  },
  tierDivider: {
    height: '1px',
    background: 'linear-gradient(90deg, transparent 0%, var(--border-color) 50%, transparent 100%)',
    margin: '24px 0',
  },
  tierReward: {
    marginBottom: '16px',
  },
  tierPongAmount: {
    fontSize: '36px',
    fontWeight: 700,
    color: 'var(--color-binance-gold)',
    marginBottom: '8px',
  },
  tierPongLabel: {
    fontSize: '14px',
    color: 'var(--text-tertiary)',
  },
  tierRatio: {
    fontSize: '13px',
    color: 'var(--text-disabled)',
    marginBottom: '28px',
    fontFamily: 'Monaco, "Courier New", monospace',
  },
  tierButton: {
    width: '100%',
    background: 'var(--bg-tertiary)',
    border: '1px solid var(--border-hover)',
    color: 'var(--text-primary)',
    borderRadius: '12px',
    padding: '16px 28px',
    fontSize: '16px',
    fontWeight: 700,
    cursor: 'pointer',
    transition: 'all 0.3s ease',
  },
  tierButtonPopular: {
    background: 'linear-gradient(135deg, var(--color-binance-gold) 0%, var(--color-binance-gold-dark) 100%)',
    border: 'none',
    color: '#000',
    boxShadow: '0 4px 20px rgba(240, 185, 11, 0.3)',
  },

  // Progress Card
  progressCard: {
    background: 'var(--bg-secondary)',
    border: '1px solid var(--border-color)',
    borderRadius: '24px',
    padding: '56px',
    maxWidth: '800px',
    margin: '0 auto',
  },
  progressTitle: {
    fontSize: '36px',
    fontWeight: 700,
    textAlign: 'center',
    margin: '0 0 12px 0',
  },
  progressSubtitle: {
    fontSize: '16px',
    color: 'var(--text-secondary)',
    textAlign: 'center',
    margin: '0 0 56px 0',
  },
  progressSteps: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: '40px',
  },
  progressStep: {
    flex: '0 0 auto',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '16px',
    position: 'relative',
  },
  progressStepCircle: {
    width: '64px',
    height: '64px',
    borderRadius: '50%',
    background: 'var(--bg-elevated)',
    border: '2px solid var(--border-color)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '24px',
    fontWeight: 700,
    color: 'var(--text-disabled)',
    transition: 'all 0.3s ease',
  },
  progressStepCircleActive: {
    background: 'linear-gradient(135deg, var(--color-binance-gold) 0%, var(--color-binance-gold-dark) 100%)',
    border: '2px solid var(--color-binance-gold)',
    color: '#000',
    boxShadow: '0 0 30px rgba(240, 185, 11, 0.4)',
  },
  progressStepCircleComplete: {
    background: 'var(--color-success)',
    border: '2px solid var(--color-success)',
    color: '#fff',
    boxShadow: '0 0 20px rgba(14, 203, 129, 0.3)',
  },
  progressStepLabel: {
    fontSize: '14px',
    color: 'var(--text-secondary)',
    fontWeight: 600,
    textAlign: 'center',
    maxWidth: '120px',
  },
  progressStepSpinner: {
    width: '24px',
    height: '24px',
    border: '3px solid var(--border-color)',
    borderTop: '3px solid var(--color-binance-gold)',
    borderRadius: '50%',
  },
  progressStepConnector: {
    flex: '1 1 auto',
    height: '2px',
    background: 'var(--border-color)',
    marginTop: '32px',
    marginLeft: '12px',
    marginRight: '12px',
  },
  progressConsole: {
    background: 'var(--bg-elevated)',
    border: '1px solid var(--border-color)',
    borderRadius: '12px',
    padding: '20px',
    fontSize: '13px',
    fontFamily: 'Monaco, "Courier New", monospace',
    color: 'var(--text-secondary)',
    maxHeight: '220px',
    overflowY: 'auto',
  },
  progressConsoleItem: {
    marginBottom: '10px',
    lineHeight: '1.6',
  },

  // Success Modal
  modal: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(0, 0, 0, 0.85)',
    backdropFilter: 'blur(12px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    padding: '20px',
  },
  successCard: {
    background: 'var(--bg-secondary)',
    border: '2px solid var(--color-success)',
    borderRadius: '28px',
    padding: '56px',
    maxWidth: '540px',
    width: '100%',
    textAlign: 'center',
    boxShadow: '0 0 80px rgba(14, 203, 129, 0.25)',
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
    width: '110px',
    height: '110px',
    objectFit: 'contain',
    filter: 'drop-shadow(0 10px 40px rgba(240, 185, 11, 0.6))',
  },
  successIconContainer: {
    marginBottom: '28px',
  },
  successIcon: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '88px',
    height: '88px',
    borderRadius: '50%',
    background: 'linear-gradient(135deg, var(--color-success) 0%, var(--color-success-dark) 100%)',
    color: '#fff',
    fontSize: '52px',
    fontWeight: 700,
    boxShadow: '0 10px 40px rgba(14, 203, 129, 0.4)',
  },
  successTitle: {
    fontSize: '36px',
    fontWeight: 700,
    margin: '0 0 20px 0',
    color: 'var(--color-success)',
  },
  successMessage: {
    fontSize: '18px',
    color: 'var(--text-secondary)',
    margin: '0 0 36px 0',
    lineHeight: '1.6',
  },
  successPongAmount: {
    fontSize: '24px',
    fontWeight: 800,
  },
  successDetails: {
    background: 'var(--bg-elevated)',
    border: '1px solid var(--border-color)',
    borderRadius: '14px',
    padding: '24px',
    marginBottom: '28px',
  },
  successDetailRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '10px 0',
  },
  successDetailLabel: {
    fontSize: '14px',
    color: 'var(--text-tertiary)',
    fontWeight: 500,
  },
  successDetailValue: {
    fontSize: '15px',
    color: 'var(--text-primary)',
    fontWeight: 700,
    fontFamily: 'Monaco, "Courier New", monospace',
  },
  successTxLink: {
    fontSize: '14px',
    color: 'var(--color-info)',
    textDecoration: 'none',
    fontWeight: 700,
    transition: 'opacity 0.2s ease',
  },
  successButton: {
    width: '100%',
    background: 'linear-gradient(135deg, var(--color-binance-gold) 0%, var(--color-binance-gold-dark) 100%)',
    color: '#000',
    border: 'none',
    borderRadius: '12px',
    padding: '18px 32px',
    fontSize: '16px',
    fontWeight: 700,
    cursor: 'pointer',
    transition: 'all 0.3s ease',
    boxShadow: '0 4px 20px rgba(240, 185, 11, 0.3)',
  },

  // Error Card
  errorCard: {
    background: 'rgba(246, 70, 93, 0.08)',
    border: '1px solid rgba(246, 70, 93, 0.3)',
    borderRadius: '14px',
    padding: '28px',
    marginTop: '28px',
  },
  errorHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    marginBottom: '16px',
  },
  errorIcon: {
    fontSize: '28px',
  },
  errorTitle: {
    fontSize: '20px',
    fontWeight: 700,
    color: 'var(--color-error)',
  },
  errorMessage: {
    fontSize: '14px',
    color: '#FCA5A5',
    fontFamily: 'Monaco, "Courier New", monospace',
    marginBottom: '20px',
    lineHeight: '1.6',
  },
  errorButton: {
    background: 'var(--color-error)',
    color: '#fff',
    border: 'none',
    borderRadius: '10px',
    padding: '12px 24px',
    fontSize: '15px',
    fontWeight: 700,
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  },

  // Footer
  footer: {
    marginTop: '80px',
    paddingTop: '40px',
    borderTop: '1px solid var(--border-color)',
    textAlign: 'center',
    position: 'relative',
    zIndex: 2,
  },
  footerContent: {
    display: 'flex',
    gap: '40px',
    justifyContent: 'center',
    flexWrap: 'wrap',
    marginBottom: '24px',
  },
  footerInfo: {
    display: 'flex',
    gap: '10px',
    alignItems: 'center',
  },
  footerLabel: {
    fontSize: '13px',
    color: 'var(--text-disabled)',
    fontWeight: 500,
  },
  footerValue: {
    fontSize: '13px',
    color: 'var(--text-tertiary)',
    fontFamily: 'Monaco, "Courier New", monospace',
    fontWeight: 600,
  },
}

declare global {
  interface Window {
    ethereum?: any
  }
}
