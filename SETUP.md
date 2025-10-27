# PONG Setup Guide

## Super Simple Setup! 🚀

**USD1 Token și Treasury sunt hardcoded - nu mai trebuie configurate!**

### 1. Creează `.env.local` (doar 1 linie!)

```bash
cp .env.example .env.local
nano .env.local  # sau code .env.local
```

Adaugă doar **FACILITATOR_PK**:

```env
FACILITATOR_PK=0xYourPrivateKeyHere
```

Asta e tot! ✅

### 2. Verificări

#### FACILITATOR_PK trebuie să aibă BNB pentru gas
- Wallet-ul cu acest private key va plăti gas-ul pentru toate tranzacțiile
- Asigură-te că are măcar **0.1 BNB**
- Asta NU e wallet-ul user-ului - e un wallet server-side care submitează tranzacții

#### Hardcoded (nu trebuie configurate):
- **USD1_TOKEN**: `0x8d0D000Ee44948FC98c9B98A4FA4921476f08B0d`
- **TREASURY**: `0x8676532800bEF0c69F8Af0A989dBf3943B1b408A`
- **Decimals**: 18 (toate calculele sunt automate)

### 4. Testează configurația

```bash
npm install
npm run dev
```

Apoi vizitează: http://localhost:3000/api/diagnostic

Ar trebui să vezi:
```json
{
  "status": "ok",
  "env": {
    "TREASURY": "0xYourAddress",
    "USD1_TOKEN": "0x8d0D000Ee44948FC98c9B98A4FA4921476f08B0d",
    "FACILITATOR_PK": "SET"
  },
  "checks": {
    "contractExists": true,
    "canReadContract": true,
    "hasGas": true,
    "facilitatorBalanceBNB": "X.XXXX BNB"
  },
  "ready": true
}
```

### 5. Probleme comune

#### "value: 1000000" în logs (în loc de "1000000000000000000")
- Ai PRICE_MINOR greșit în .env.local
- Trebuie să fie `10000000000000000000` (nu `10000000`)

#### "from" și "to" sunt aceeași adresă
- TREASURY e setat la adresa ta de wallet personal
- Trebuie să fie o adresă diferită

#### "Contract execution reverted"
- Verifică că user-ul are USD1 în wallet
- Verifică că FACILITATOR wallet-ul are BNB pentru gas
- Verifică că USD1_TOKEN e adresa corectă

### 6. Verifică logs

Când faci o tranzacție, uită-te în **terminal** (unde rulează `npm run dev`):

```
[Challenge] Tier amount: 1 Price minor: 1000000000000000000  ✅ CORECT
[Challenge] Response values: { value: '1000000000000000000' }  ✅ CORECT

[Settle] Received request: { value: '1000000000000000000' }  ✅ CORECT
[Settle] Transaction args: [..., 1000000000000000000, ...]  ✅ CORECT
```

Dacă vezi `value: 1000000` sau alt număr mic = PROBLEM LA CONFIG!

## Quick Start

```bash
# 1. Install
npm install

# 2. Configure (edit with your values!)
cp .env.example .env.local
nano .env.local  # or code .env.local

# 3. Check config
npm run dev
curl http://localhost:3000/api/diagnostic

# 4. Test
# Open http://localhost:3000
# Connect wallet, pay 1 USD1
# Check terminal logs!
```

## Deploy to Vercel

```bash
vercel
```

Apoi adaugă toate variabilele din `.env.local` în Vercel Dashboard:
Settings → Environment Variables

**IMPORTANT:** Nu uita să adaugi `FACILITATOR_PK` și `TREASURY`!
