'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import * as BABYLON from '@babylonjs/core'

// Payment tier configuration
const PAYMENT_TIERS = [
  { amount: 1, usd1: 1, pong: 4000, color: '#3B82F6', label: 'STARTER' },
  { amount: 5, usd1: 5, pong: 20000, color: '#F0B90B', label: 'POPULAR' },
  { amount: 10, usd1: 10, pong: 40000, color: '#0ECB81', label: 'WHALE' },
]

const EXPECTED_CHAIN_ID = '0x38' // BSC Mainnet

export default function AlphaPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState<string>('')
  const [selectedTier, setSelectedTier] = useState<number | null>(null)
  const [keyboardSelected, setKeyboardSelected] = useState<number>(1) // 0, 1, 2 for tier indices
  const glowLayersRef = useRef<BABYLON.GlowLayer[]>([])
  const cardsRef = useRef<BABYLON.Mesh[]>([])

  // Add global styles for scrollbar and hover effects
  useEffect(() => {
    const style = document.createElement('style')
    style.innerHTML = `
      .info-panel-content::-webkit-scrollbar {
        width: 6px;
      }
      .info-panel-content::-webkit-scrollbar-track {
        background: rgba(0, 0, 0, 0.2);
        border-radius: 10px;
      }
      .info-panel-content::-webkit-scrollbar-thumb {
        background: rgba(240, 185, 11, 0.3);
        border-radius: 10px;
      }
      .info-panel-content::-webkit-scrollbar-thumb:hover {
        background: rgba(240, 185, 11, 0.5);
      }
      .info-link:hover {
        background: rgba(240, 185, 11, 0.15) !important;
        border-color: rgba(240, 185, 11, 0.4) !important;
        transform: translateX(4px);
      }
      .control-item:hover {
        background: rgba(240, 185, 11, 0.1) !important;
        border-color: rgba(240, 185, 11, 0.25) !important;
      }
    `
    document.head.appendChild(style)
    return () => {
      document.head.removeChild(style)
    }
  }, [])

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (loading) return

      if (e.key === 'ArrowLeft') {
        e.preventDefault()
        setKeyboardSelected((prev) => (prev - 1 + 3) % 3)
      } else if (e.key === 'ArrowRight') {
        e.preventDefault()
        setKeyboardSelected((prev) => (prev + 1) % 3)
      } else if (e.key === 'Enter' && !loading) {
        e.preventDefault()
        const tier = PAYMENT_TIERS[keyboardSelected]
        handlePayment(tier.usd1)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [keyboardSelected, loading])

  const containersRef = useRef<BABYLON.TransformNode[]>([])
  const bordersRef = useRef<BABYLON.Mesh[]>([])
  const particlesRef = useRef<BABYLON.ParticleSystem[]>([])
  const selectedIndexRef = useRef<number>(1) // Track selected index for floating animation

  // Update glow, scale, border, and particles on keyboard selection change
  useEffect(() => {
    selectedIndexRef.current = keyboardSelected

    // Update Babylon scene's selected index
    if ((window as any).__updateCardSelection) {
      (window as any).__updateCardSelection(keyboardSelected)
    }

    if (glowLayersRef.current.length === 3) {
      glowLayersRef.current.forEach((glow, index) => {
        // Pulsing effect on selected card
        glow.intensity = index === keyboardSelected ? 2.5 : 0.3
      })
    }
    if (cardsRef.current.length === 3) {
      cardsRef.current.forEach((card, index) => {
        const targetScale = index === keyboardSelected ? 1.15 : 1
        card.scaling = new BABYLON.Vector3(targetScale, targetScale, targetScale)
      })
    }
    if (bordersRef.current.length === 3) {
      bordersRef.current.forEach((border, index) => {
        if (border.material && 'alpha' in border.material) {
          border.material.alpha = index === keyboardSelected ? 0.9 : 0
        }
      })
    }
    // BLANĂ: Toggle particle effects
    if (particlesRef.current.length === 3) {
      particlesRef.current.forEach((particles, index) => {
        if (index === keyboardSelected) {
          particles.start()
        } else {
          particles.stop()
        }
      })
    }
  }, [keyboardSelected])

  useEffect(() => {
    if (!canvasRef.current) return

    // Create Babylon engine and scene
    const engine = new BABYLON.Engine(canvasRef.current, true, {
      preserveDrawingBuffer: true,
      stencil: true,
    })

    const scene = new BABYLON.Scene(engine)
    scene.clearColor = new BABYLON.Color4(0.04, 0.05, 0.06, 1) // Dark background

    // Camera setup - Arc Rotate for horizontal card view (perfect framing)
    const camera = new BABYLON.ArcRotateCamera(
      'camera',
      0, // Alpha - facing straight at cards
      Math.PI / 3, // Beta - better angle for card view
      11, // Radius - optimal distance for framing
      new BABYLON.Vector3(0, 0, 0), // Target center of cards
      scene
    )
    // Position camera for perfect framing
    camera.setPosition(new BABYLON.Vector3(0, 2.5, -11))
    camera.lowerRadiusLimit = 9
    camera.upperRadiusLimit = 14
    camera.lowerBetaLimit = Math.PI / 4 // Prevent looking too far down
    camera.upperBetaLimit = Math.PI / 2.5 // Prevent looking too far up
    camera.attachControl(canvasRef.current, true)

    // Disable arrow keys for camera control (we use them for card selection)
    camera.keysUp = []
    camera.keysDown = []
    camera.keysLeft = []
    camera.keysRight = []

    // Lighting - Clean and bright
    const hemisphericLight = new BABYLON.HemisphericLight(
      'hemiLight',
      new BABYLON.Vector3(0, 1, 0),
      scene
    )
    hemisphericLight.intensity = 0.6
    hemisphericLight.diffuse = new BABYLON.Color3(1, 1, 1)
    hemisphericLight.groundColor = new BABYLON.Color3(0.3, 0.3, 0.4)

    // Directional light from above
    const dirLight = new BABYLON.DirectionalLight(
      'dirLight',
      new BABYLON.Vector3(-0.5, -1, 0.5),
      scene
    )
    dirLight.intensity = 0.8
    dirLight.diffuse = new BABYLON.Color3(240 / 255, 185 / 255, 11 / 255) // Gold tint

    // ==== CREATE SUBTLE CLOUD PARTICLES (NORI - doar efect) ====
    const cloudParticles = new BABYLON.ParticleSystem('cloudParticles', 30, scene)

    // Create a custom texture for clouds
    const cloudTexture = new BABYLON.Texture('https://raw.githubusercontent.com/BabylonJS/Babylon.js/master/packages/tools/playground/public/textures/cloud.png', scene)
    cloudParticles.particleTexture = cloudTexture

    // Emitter position (around the cards)
    cloudParticles.emitter = new BABYLON.Vector3(0, 0, 0)
    cloudParticles.minEmitBox = new BABYLON.Vector3(-10, -2, -6)
    cloudParticles.maxEmitBox = new BABYLON.Vector3(10, 5, 6)

    // Subtle cloud properties
    cloudParticles.color1 = new BABYLON.Color4(0.9, 0.9, 0.95, 0.15)
    cloudParticles.color2 = new BABYLON.Color4(0.8, 0.8, 0.85, 0.1)
    cloudParticles.colorDead = new BABYLON.Color4(0.7, 0.7, 0.75, 0)

    cloudParticles.minSize = 3
    cloudParticles.maxSize = 5

    cloudParticles.minLifeTime = 15
    cloudParticles.maxLifeTime = 25

    cloudParticles.emitRate = 3

    // Very slow floating movement
    cloudParticles.direction1 = new BABYLON.Vector3(-0.2, 0.05, -0.1)
    cloudParticles.direction2 = new BABYLON.Vector3(0.2, 0.1, 0.1)

    cloudParticles.minEmitPower = 0.05
    cloudParticles.maxEmitPower = 0.1
    cloudParticles.updateSpeed = 0.003

    cloudParticles.blendMode = BABYLON.ParticleSystem.BLENDMODE_STANDARD

    cloudParticles.start()

    // ==== CREATE DANCING QUESTION MARKS (MAI MULTE, PATTERN-URI RANDOM) ====
    const questionMarks: Array<{ mesh: BABYLON.Mesh; pattern: number; speed: number; radius: number }> = []
    const questionMarkCount = 18

    for (let i = 0; i < questionMarkCount; i++) {
      // Create question mark texture with random opacity
      const qTexture = new BABYLON.DynamicTexture(`qTexture${i}`, { width: 128, height: 128 }, scene)
      const qCtx = qTexture.getContext() as CanvasRenderingContext2D
      qCtx.font = 'bold 100px Arial'

      // Random colors between gold and green
      const colors = ['#F0B90B', '#0ECB81', '#3B82F6', '#FF6B6B']
      qCtx.fillStyle = colors[i % colors.length]

      qCtx.textAlign = 'center'
      qCtx.textBaseline = 'middle'
      qCtx.fillText('?', 64, 64)
      qTexture.update()

      const size = 0.5 + Math.random() * 0.5 // Random sizes 0.5-1.0
      const qPlane = BABYLON.MeshBuilder.CreatePlane(`question${i}`, { size }, scene)
      qPlane.billboardMode = BABYLON.Mesh.BILLBOARDMODE_ALL

      const qMat = new BABYLON.StandardMaterial(`qMat${i}`, scene)
      qMat.diffuseTexture = qTexture
      qMat.emissiveTexture = qTexture
      qMat.opacityTexture = qTexture
      qMat.alpha = 0.6 + Math.random() * 0.4 // Random opacity
      qMat.backFaceCulling = false
      qPlane.material = qMat

      // Random starting position
      qPlane.position.x = (Math.random() - 0.5) * 12
      qPlane.position.y = Math.random() * 5 - 1
      qPlane.position.z = (Math.random() - 0.5) * 10

      // Random movement pattern (0-4)
      const pattern = Math.floor(Math.random() * 5)
      const speed = 0.5 + Math.random() * 1.5
      const radius = 2 + Math.random() * 4

      questionMarks.push({ mesh: qPlane, pattern, speed, radius })
    }

    // Animate question marks with different patterns
    let qTime = 0
    scene.registerBeforeRender(() => {
      qTime += 0.01
      questionMarks.forEach((qData, index) => {
        const { mesh, pattern, speed, radius } = qData
        const offset = index * 0.8

        switch (pattern) {
          case 0: // Circular orbit
            mesh.position.x += Math.cos(qTime * speed + offset) * 0.02
            mesh.position.z += Math.sin(qTime * speed + offset) * 0.02
            mesh.position.y += Math.sin(qTime * 1.5 + offset) * 0.015
            break
          case 1: // Figure-8
            mesh.position.x += Math.sin(qTime * speed + offset) * 0.025
            mesh.position.y += Math.sin(qTime * speed * 2 + offset) * 0.02
            mesh.position.z += Math.cos(qTime * speed + offset) * 0.015
            break
          case 2: // Spiral
            mesh.position.x += Math.cos(qTime * speed + offset) * Math.sin(qTime * 0.5) * 0.02
            mesh.position.y += (Math.sin(qTime * 0.8 + offset) * 0.03)
            mesh.position.z += Math.sin(qTime * speed + offset) * Math.cos(qTime * 0.5) * 0.02
            break
          case 3: // Bouncy
            mesh.position.y += Math.abs(Math.sin(qTime * speed * 2 + offset)) * 0.03
            mesh.position.x += Math.cos(qTime * speed + offset) * 0.01
            mesh.position.z += Math.sin(qTime * speed * 0.7 + offset) * 0.01
            break
          case 4: // Random walk
            mesh.position.x += (Math.random() - 0.5) * 0.02
            mesh.position.y += Math.sin(qTime * speed + offset) * 0.02
            mesh.position.z += (Math.random() - 0.5) * 0.02
            break
        }

        // Keep within bounds
        if (Math.abs(mesh.position.x) > 7) mesh.position.x *= 0.9
        if (mesh.position.y > 5 || mesh.position.y < -2) mesh.position.y *= 0.9
        if (Math.abs(mesh.position.z) > 6) mesh.position.z *= 0.9
      })
    })

    // ==== CREATE "PONG?" HEADER TEXT ====

    const headerTexture = new BABYLON.DynamicTexture(
      'headerTexture',
      { width: 1024, height: 200 },
      scene
    )
    const ctx = headerTexture.getContext() as CanvasRenderingContext2D

    // Draw "PONG?" text
    ctx.font = 'bold 120px Arial'
    ctx.fillStyle = '#F0B90B'
    ctx.textAlign = 'center'
    ctx.fillText('PONG?', 512, 140)

    headerTexture.update()

    const headerPlane = BABYLON.MeshBuilder.CreatePlane('headerPlane', { width: 6, height: 1.2 }, scene)
    headerPlane.position.y = 3.2 // Better positioning for perfect frame
    headerPlane.billboardMode = BABYLON.Mesh.BILLBOARDMODE_ALL

    const headerMaterial = new BABYLON.StandardMaterial('headerMat', scene)
    headerMaterial.diffuseTexture = headerTexture
    headerMaterial.emissiveTexture = headerTexture
    headerMaterial.opacityTexture = headerTexture
    headerMaterial.backFaceCulling = false
    headerPlane.material = headerMaterial

    // ==== CREATE 3 INTERACTIVE TIER CARDS (HORIZONTAL LAYOUT) ====

    const cardSpacing = 3.2 // Tighter spacing for better framing
    const cards: BABYLON.Mesh[] = []
    const glowLayers: BABYLON.GlowLayer[] = []
    const cardContainers: BABYLON.TransformNode[] = []
    const borders: BABYLON.Mesh[] = []
    const cardParticleSystems: BABYLON.ParticleSystem[] = []

    PAYMENT_TIERS.forEach((tier, index) => {
      // Create container for card animations
      const container = new BABYLON.TransformNode(`container${tier.usd1}`, scene)
      container.position.x = (index - 1) * cardSpacing // Better spacing
      container.position.y = 0
      container.position.z = 0
      cardContainers.push(container)

      // Create card (slightly larger for better visibility)
      const card = BABYLON.MeshBuilder.CreateBox(
        `tier${tier.usd1}`,
        { width: 2.6, height: 3.6, depth: 0.3 },
        scene
      )

      card.parent = container
      card.position.y = 0

      // Initial state - middle card is selected
      if (index === 1) {
        container.position.y = 0.3 // Lift selected card
        card.scaling = new BABYLON.Vector3(1.1, 1.1, 1.1)
      }

      // Material
      const cardMaterial = new BABYLON.StandardMaterial(`cardMat${tier.usd1}`, scene)
      const color = BABYLON.Color3.FromHexString(tier.color)
      cardMaterial.diffuseColor = color
      cardMaterial.specularColor = new BABYLON.Color3(1, 1, 1)
      cardMaterial.emissiveColor = color.scale(0.2)
      cardMaterial.specularPower = 32
      card.material = cardMaterial

      // Save card reference
      cards.push(card)

      // Glow layer - with selection indicators
      const glowLayer = new BABYLON.GlowLayer('glow' + tier.usd1, scene)
      glowLayer.addIncludedOnlyMesh(card)
      glowLayer.intensity = index === 1 ? 2 : 0.3 // Middle card starts selected

      // Save glow layer reference
      glowLayers.push(glowLayer)

      // Selection border (frame around card)
      const border = BABYLON.MeshBuilder.CreateBox(
        `border${tier.usd1}`,
        { width: 2.7, height: 3.7, depth: 0.35 },
        scene
      )
      border.parent = container
      border.position.y = 0
      border.position.z = 0

      const borderMat = new BABYLON.StandardMaterial(`borderMat${tier.usd1}`, scene)
      borderMat.diffuseColor = new BABYLON.Color3(240 / 255, 185 / 255, 11 / 255) // Gold
      borderMat.emissiveColor = new BABYLON.Color3(240 / 255, 185 / 255, 11 / 255)
      borderMat.alpha = index === 1 ? 0.8 : 0 // Visible only when selected
      border.material = borderMat
      border.isPickable = false // Don't interfere with card picking

      // Save border reference
      borders.push(border)

      // ==== BLANĂ EFFECTS: Particule aurii/colorate pentru card ====
      const cardParticles = new BABYLON.ParticleSystem(`cardParticles${tier.usd1}`, 100, scene)

      // Particle emitter around card
      cardParticles.emitter = card
      cardParticles.minEmitBox = new BABYLON.Vector3(-1.3, -1.8, -0.2)
      cardParticles.maxEmitBox = new BABYLON.Vector3(1.3, 1.8, 0.2)

      // Create sparkle texture
      const sparkleTexture = new BABYLON.Texture('https://raw.githubusercontent.com/BabylonJS/Babylon.js/master/packages/tools/playground/public/textures/flare.png', scene)
      cardParticles.particleTexture = sparkleTexture

      // Color based on tier
      const particleColor = BABYLON.Color3.FromHexString(tier.color)
      cardParticles.color1 = new BABYLON.Color4(particleColor.r, particleColor.g, particleColor.b, 1)
      cardParticles.color2 = new BABYLON.Color4(240/255, 185/255, 11/255, 0.8) // Gold
      cardParticles.colorDead = new BABYLON.Color4(particleColor.r, particleColor.g, particleColor.b, 0)

      cardParticles.minSize = 0.05
      cardParticles.maxSize = 0.15

      cardParticles.minLifeTime = 0.5
      cardParticles.maxLifeTime = 1.5

      cardParticles.emitRate = 50

      // Outward burst effect
      cardParticles.direction1 = new BABYLON.Vector3(-0.5, -0.5, -0.3)
      cardParticles.direction2 = new BABYLON.Vector3(0.5, 0.5, 0.3)

      cardParticles.minEmitPower = 0.5
      cardParticles.maxEmitPower = 1.5
      cardParticles.updateSpeed = 0.02

      cardParticles.blendMode = BABYLON.ParticleSystem.BLENDMODE_ADD
      cardParticles.gravity = new BABYLON.Vector3(0, -0.5, 0)

      // Only show particles on selected card (start stopped)
      if (index !== 1) {
        cardParticles.stop()
      }

      cardParticleSystems.push(cardParticles)

      // Create text on card with gradient and better design
      const cardTexture = new BABYLON.DynamicTexture(
        `cardTexture${tier.usd1}`,
        { width: 512, height: 640 },
        scene
      )
      const cardCtx = cardTexture.getContext() as CanvasRenderingContext2D

      // Gradient background
      const gradient = cardCtx.createLinearGradient(0, 0, 0, 640)
      gradient.addColorStop(0, tier.color)
      gradient.addColorStop(1, '#000000')
      cardCtx.fillStyle = gradient
      cardCtx.fillRect(0, 0, 512, 640)

      // Top badge
      cardCtx.fillStyle = 'rgba(0, 0, 0, 0.4)'
      cardCtx.fillRect(0, 0, 512, 80)
      cardCtx.fillStyle = '#FFFFFF'
      cardCtx.font = 'bold 32px Arial'
      cardCtx.textAlign = 'center'
      cardCtx.fillText(tier.label, 256, 52)

      // Main amount - huge and bold
      cardCtx.fillStyle = '#FFFFFF'
      cardCtx.font = 'bold 140px Arial'
      cardCtx.textAlign = 'center'
      cardCtx.fillText(`${tier.usd1}`, 256, 220)

      // USD1 label
      cardCtx.font = '32px Arial'
      cardCtx.fillStyle = 'rgba(255, 255, 255, 0.8)'
      cardCtx.fillText('USD1', 256, 260)

      // Divider line
      cardCtx.strokeStyle = 'rgba(255, 255, 255, 0.3)'
      cardCtx.lineWidth = 2
      cardCtx.beginPath()
      cardCtx.moveTo(100, 300)
      cardCtx.lineTo(412, 300)
      cardCtx.stroke()

      // Arrow
      cardCtx.font = '40px Arial'
      cardCtx.fillStyle = 'rgba(255, 255, 255, 0.6)'
      cardCtx.fillText('⬇', 256, 360)

      // PONG amount - prominent
      cardCtx.font = 'bold 70px Arial'
      cardCtx.fillStyle = '#FFFFFF'
      cardCtx.fillText(`${tier.pong.toLocaleString()}`, 256, 450)

      // PONG label
      cardCtx.font = 'bold 36px Arial'
      cardCtx.fillStyle = '#F0B90B'
      cardCtx.fillText('PONG?', 256, 500)

      // Rate info at bottom
      cardCtx.font = '22px Arial'
      cardCtx.fillStyle = 'rgba(255, 255, 255, 0.5)'
      cardCtx.fillText('4,000 per USD1', 256, 580)

      // Hover instruction
      if (index === 1) {
        cardCtx.font = 'bold 20px Arial'
        cardCtx.fillStyle = 'rgba(255, 255, 255, 0.9)'
        cardCtx.fillText('Press ENTER ⏎', 256, 620)
      }

      cardTexture.update()

      const overlayMat = new BABYLON.StandardMaterial(`overlayMat${tier.usd1}`, scene)
      overlayMat.diffuseTexture = cardTexture
      overlayMat.emissiveTexture = cardTexture
      overlayMat.backFaceCulling = false

      const overlay = BABYLON.MeshBuilder.CreatePlane(
        `overlay${tier.usd1}`,
        { width: 2.5, height: 3.5 },
        scene
      )
      overlay.parent = card
      overlay.position.z = -0.16
      overlay.material = overlayMat

      // Hover animation - Add action manager to OVERLAY (clickable front)
      let hovered = false
      overlay.actionManager = new BABYLON.ActionManager(scene)

      overlay.actionManager.registerAction(
        new BABYLON.ExecuteCodeAction(BABYLON.ActionManager.OnPointerOverTrigger, () => {
          if (!hovered) {
            hovered = true
            setKeyboardSelected(index) // Update keyboard selection on hover
            if (canvasRef.current) {
              canvasRef.current.style.cursor = 'pointer'
            }
          }
        })
      )

      overlay.actionManager.registerAction(
        new BABYLON.ExecuteCodeAction(BABYLON.ActionManager.OnPointerOutTrigger, () => {
          if (hovered) {
            hovered = false
            if (canvasRef.current) {
              canvasRef.current.style.cursor = 'default'
            }
          }
        })
      )

      // Click handler - triggers MetaMask payment
      overlay.actionManager.registerAction(
        new BABYLON.ExecuteCodeAction(BABYLON.ActionManager.OnPickTrigger, () => {
          handlePayment(tier.usd1)
        })
      )
    })

    // Save references for keyboard navigation
    cardsRef.current = cards
    glowLayersRef.current = glowLayers
    containersRef.current = cardContainers
    bordersRef.current = borders
    particlesRef.current = cardParticleSystems

    // Animate cards floating among clouds
    let cardTime = 0
    const selectedIndexTracker = { value: 1 } // Track selected index in closure

    // Update selected index from React state
    const updateSelectedIndex = (newIndex: number) => {
      selectedIndexTracker.value = newIndex
    }

    // Store update function for access from React
    ;(window as any).__updateCardSelection = updateSelectedIndex

    scene.registerBeforeRender(() => {
      cardTime += 0.005
      cardContainers.forEach((container, index) => {
        const offset = index * 2
        // Gentle floating motion with selection lift
        const baseY = index === selectedIndexTracker.value ? 0.4 : 0
        container.position.y = baseY + Math.sin(cardTime + offset) * 0.12

        // Subtle sway with extra emphasis on selected
        const swayMultiplier = index === selectedIndexTracker.value ? 1.5 : 1
        container.rotation.y = Math.sin(cardTime * 0.8 + offset) * 0.04 * swayMultiplier
        container.rotation.x = Math.cos(cardTime * 0.6 + offset) * 0.03 * swayMultiplier
      })

      // BLANĂ: Pulsing glow effect on selected card
      if (glowLayers.length === 3) {
        glowLayers.forEach((glow, index) => {
          if (index === selectedIndexTracker.value) {
            // Pulsating glow
            glow.intensity = 2.5 + Math.sin(cardTime * 3) * 0.5
          }
        })
      }
    })

    // Render loop
    engine.runRenderLoop(() => {
      scene.render()
    })

    // Resize handler
    const handleResize = () => {
      engine.resize()
    }
    window.addEventListener('resize', handleResize)

    // Cleanup
    return () => {
      window.removeEventListener('resize', handleResize)
      scene.dispose()
      engine.dispose()
    }
  }, [])

  const handlePayment = async (tierAmount: number) => {
    if (loading) return

    setLoading(true)
    setSelectedTier(tierAmount)
    setStatus('🔄 Connecting to wallet...')

    const tierEndpoints: Record<number, string> = {
      1: '/pong1',
      5: '/pong5',
      10: '/pong10',
    }
    const endpoint = tierEndpoints[tierAmount]

    try {
      if (!window.ethereum) {
        throw new Error('MetaMask not found!')
      }

      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' })
      const signingAccount = accounts[0]?.toLowerCase()

      if (!signingAccount) {
        throw new Error('No account found')
      }

      // Check chain
      const chainId = await window.ethereum.request({ method: 'eth_chainId' })
      if (chainId !== EXPECTED_CHAIN_ID) {
        setStatus('⚠️ Switching to BNB Chain...')
        await window.ethereum.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: EXPECTED_CHAIN_ID }],
        })
      }

      // Request challenge
      setStatus('🔄 Requesting EIP-2612 Permit...')
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
      setStatus('✅ Challenge received')

      // Sign with viem
      setStatus('🔏 Requesting signature...')
      const { createWalletClient, custom } = await import('viem')
      const { bsc } = await import('viem/chains')

      const walletClient = createWalletClient({
        account: signingAccount as `0x${string}`,
        chain: bsc,
        transport: custom(window.ethereum),
      })

      const typedData = {
        domain: challenge.domain,
        types: challenge.types,
        primaryType: challenge.primaryType as 'Permit',
        message: challenge.values,
      }

      const signature = await walletClient.signTypedData(typedData)
      setStatus('✅ Signature obtained')

      // Settle
      setStatus('⚡ Settling on-chain...')
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
        throw new Error(err.error || 'Settlement failed')
      }

      const result = await settleRes.json()
      setStatus(`🎉 Success! ${result.allocationPONG.toLocaleString()} PONG? allocated!`)
    } catch (error: any) {
      setStatus(`❌ Error: ${error.message}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={styles.container}>
      {/* Back button */}
      <div style={styles.topNav}>
        <Link href="/" style={styles.backButton}>
          ← Back to Main
        </Link>
      </div>

      {/* BabylonJS Canvas */}
      <canvas ref={canvasRef} style={styles.canvas} />

      {/* Status overlay */}
      {status && (
        <div style={styles.statusOverlay}>
          <div style={styles.statusBox}>
            <p style={styles.statusText}>{status}</p>
          </div>
        </div>
      )}

      {/* Info Panel - Left Side */}
      <div style={styles.infoPanel}>
        <div className="info-panel-content" style={styles.infoPanelContent}>
          {/* Title with Logo */}
          <div style={styles.infoPanelHeader}>
            <div style={styles.logoContainer}>
              <img src="/pong_logo.png" alt="PONG?" style={styles.logo} />
              <div>
                <h2 style={styles.infoPanelTitle}>PONG? Alpha</h2>
                <p style={styles.infoPanelSubtitle}>Gasless x402 Payments on BSC</p>
              </div>
            </div>
          </div>

          {/* Controls Section */}
          <div style={styles.infoSection}>
            <h3 style={styles.infoSectionTitle}>🎮 Controls</h3>
            <div style={styles.controlsList}>
              <div className="control-item" style={styles.controlItem}>
                <span style={styles.controlKey}>← →</span>
                <span style={styles.controlDesc}>Navigate tiers</span>
              </div>
              <div className="control-item" style={styles.controlItem}>
                <span style={styles.controlKey}>ENTER</span>
                <span style={styles.controlDesc}>Purchase selected</span>
              </div>
              <div className="control-item" style={styles.controlItem}>
                <span style={styles.controlKey}>CLICK</span>
                <span style={styles.controlDesc}>Purchase directly</span>
              </div>
              <div className="control-item" style={styles.controlItem}>
                <span style={styles.controlKey}>DRAG</span>
                <span style={styles.controlDesc}>Rotate scene</span>
              </div>
              <div className="control-item" style={styles.controlItem}>
                <span style={styles.controlKey}>SCROLL</span>
                <span style={styles.controlDesc}>Zoom in/out</span>
              </div>
            </div>
          </div>

          {/* x402 Process */}
          <div style={styles.infoSection}>
            <h3 style={styles.infoSectionTitle}>⚡ x402 Process</h3>
            <div style={styles.processList}>
              <div style={styles.processStep}>
                <div style={styles.stepNumber}>1</div>
                <div style={styles.stepContent}>
                  <div style={styles.stepTitle}>Select Tier</div>
                  <div style={styles.stepDesc}>Choose 1, 5, or 10 USD1</div>
                </div>
              </div>
              <div style={styles.processStep}>
                <div style={styles.stepNumber}>2</div>
                <div style={styles.stepContent}>
                  <div style={styles.stepTitle}>Sign Permit</div>
                  <div style={styles.stepDesc}>EIP-2612 signature (no gas)</div>
                </div>
              </div>
              <div style={styles.processStep}>
                <div style={styles.stepNumber}>3</div>
                <div style={styles.stepContent}>
                  <div style={styles.stepTitle}>Auto Settlement</div>
                  <div style={styles.stepDesc}>Backend submits transaction</div>
                </div>
              </div>
              <div style={styles.processStep}>
                <div style={styles.stepNumber}>4</div>
                <div style={styles.stepContent}>
                  <div style={styles.stepTitle}>Receive PONG?</div>
                  <div style={styles.stepDesc}>4,000 PONG? per USD1</div>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Facts */}
          <div style={styles.infoSection}>
            <h3 style={styles.infoSectionTitle}>📊 Quick Facts</h3>
            <div style={styles.factsList}>
              <div style={styles.factItem}>
                <span style={styles.factLabel}>Protocol:</span>
                <span style={styles.factValue}>x402 + EIP-2612</span>
              </div>
              <div style={styles.factItem}>
                <span style={styles.factLabel}>Network:</span>
                <span style={styles.factValue}>BNB Chain</span>
              </div>
              <div style={styles.factItem}>
                <span style={styles.factLabel}>Gas Fee:</span>
                <span style={styles.factValue}>$0 (gasless)</span>
              </div>
              <div style={styles.factItem}>
                <span style={styles.factLabel}>Rate:</span>
                <span style={styles.factValue}>4,000/USD1</span>
              </div>
            </div>
          </div>

          {/* Link to main */}
          <div style={styles.infoFooter}>
            <Link href="/" className="info-link" style={styles.infoLink}>
              📄 Learn more about x402 →
            </Link>
            <Link href="/about" className="info-link" style={styles.infoLink}>
              ℹ️ About & Disclaimer →
            </Link>
          </div>
        </div>
      </div>

      {/* Alpha badge */}
      <div style={styles.alphaBadge}>ALPHA</div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    width: '100vw',
    height: '100vh',
    margin: 0,
    padding: 0,
    overflow: 'hidden',
    background: 'linear-gradient(135deg, #0B0E11 0%, #1a1a2e 100%)',
    position: 'relative',
  },
  canvas: {
    width: '100%',
    height: '100%',
    display: 'block',
    outline: 'none',
  },
  topNav: {
    position: 'absolute',
    top: '20px',
    left: '20px',
    zIndex: 100,
  },
  backButton: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    background: 'rgba(11, 14, 17, 0.8)',
    backdropFilter: 'blur(10px)',
    border: '1px solid rgba(240, 185, 11, 0.3)',
    color: '#F0B90B',
    textDecoration: 'none',
    padding: '12px 24px',
    borderRadius: '12px',
    fontSize: '14px',
    fontWeight: 600,
    transition: 'all 0.3s ease',
    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)',
  },
  statusOverlay: {
    position: 'absolute',
    bottom: '40px',
    left: '50%',
    transform: 'translateX(-50%)',
    zIndex: 100,
  },
  statusBox: {
    background: 'rgba(11, 14, 17, 0.95)',
    backdropFilter: 'blur(20px)',
    border: '1px solid rgba(240, 185, 11, 0.3)',
    borderRadius: '16px',
    padding: '16px 32px',
    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)',
  },
  statusText: {
    margin: 0,
    fontSize: '16px',
    fontWeight: 600,
    color: '#F0B90B',
    textAlign: 'center',
  },
  instructions: {
    position: 'absolute',
    bottom: '20px',
    right: '20px',
    zIndex: 100,
  },
  instructionsText: {
    margin: '4px 0',
    fontSize: '12px',
    color: 'rgba(255, 255, 255, 0.5)',
    fontFamily: 'Monaco, "Courier New", monospace',
  },
  alphaBadge: {
    position: 'absolute',
    top: '20px',
    right: '20px',
    background: 'linear-gradient(135deg, #F0B90B 0%, #FF6B6B 100%)',
    color: '#000',
    padding: '8px 20px',
    borderRadius: '20px',
    fontSize: '14px',
    fontWeight: 900,
    letterSpacing: '2px',
    boxShadow: '0 4px 20px rgba(240, 185, 11, 0.4)',
    zIndex: 100,
  },
  infoPanel: {
    position: 'absolute',
    left: '20px',
    top: '80px',
    bottom: '20px',
    width: '340px',
    zIndex: 100,
    pointerEvents: 'auto',
  },
  infoPanelContent: {
    background: 'rgba(11, 14, 17, 0.92)',
    backdropFilter: 'blur(20px)',
    border: '1px solid rgba(240, 185, 11, 0.2)',
    borderRadius: '16px',
    padding: '18px',
    height: '100%',
    overflowY: 'auto',
    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.6)',
  },
  infoPanelHeader: {
    marginBottom: '16px',
    paddingBottom: '14px',
    borderBottom: '2px solid rgba(240, 185, 11, 0.2)',
  },
  logoContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  logo: {
    width: '48px',
    height: '48px',
    objectFit: 'contain',
    filter: 'drop-shadow(0 0 8px rgba(240, 185, 11, 0.3))',
  },
  infoPanelTitle: {
    margin: '0 0 4px 0',
    fontSize: '22px',
    fontWeight: 900,
    color: '#FFFFFF',
  },
  infoPanelSubtitle: {
    margin: 0,
    fontSize: '11px',
    color: 'rgba(255, 255, 255, 0.5)',
    fontWeight: 600,
    letterSpacing: '0.5px',
  },
  infoSection: {
    marginBottom: '18px',
  },
  infoSectionTitle: {
    margin: '0 0 10px 0',
    fontSize: '14px',
    fontWeight: 700,
    color: '#F0B90B',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  controlsList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  controlItem: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '8px 10px',
    background: 'rgba(240, 185, 11, 0.05)',
    border: '1px solid rgba(240, 185, 11, 0.15)',
    borderRadius: '6px',
    transition: 'all 0.2s ease',
  },
  controlKey: {
    fontFamily: 'Monaco, "Courier New", monospace',
    fontSize: '11px',
    fontWeight: 700,
    color: '#F0B90B',
    background: 'rgba(240, 185, 11, 0.15)',
    padding: '3px 8px',
    borderRadius: '4px',
    minWidth: '60px',
    textAlign: 'center',
  },
  controlDesc: {
    fontSize: '12px',
    color: 'rgba(255, 255, 255, 0.7)',
    fontWeight: 500,
  },
  processList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  processStep: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '10px',
  },
  stepNumber: {
    width: '24px',
    height: '24px',
    borderRadius: '50%',
    background: 'linear-gradient(135deg, #F0B90B 0%, #FF9500 100%)',
    color: '#000',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '12px',
    fontWeight: 900,
    flexShrink: 0,
  },
  stepContent: {
    flex: 1,
  },
  stepTitle: {
    fontSize: '13px',
    fontWeight: 700,
    color: '#FFFFFF',
    marginBottom: '2px',
  },
  stepDesc: {
    fontSize: '11px',
    color: 'rgba(255, 255, 255, 0.5)',
    lineHeight: '1.4',
  },
  factsList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  factItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '6px 10px',
    background: 'rgba(14, 203, 129, 0.05)',
    border: '1px solid rgba(14, 203, 129, 0.15)',
    borderRadius: '6px',
  },
  factLabel: {
    fontSize: '11px',
    color: 'rgba(255, 255, 255, 0.5)',
    fontWeight: 600,
  },
  factValue: {
    fontSize: '12px',
    color: '#0ECB81',
    fontWeight: 700,
    fontFamily: 'Monaco, "Courier New", monospace',
  },
  infoFooter: {
    marginTop: '18px',
    paddingTop: '14px',
    borderTop: '1px solid rgba(240, 185, 11, 0.1)',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  infoLink: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: '12px',
    color: '#F0B90B',
    textDecoration: 'none',
    fontWeight: 600,
    padding: '8px 12px',
    background: 'rgba(240, 185, 11, 0.08)',
    border: '1px solid rgba(240, 185, 11, 0.2)',
    borderRadius: '8px',
    transition: 'all 0.2s ease',
  },
}

declare global {
  interface Window {
    ethereum?: any
  }
}
