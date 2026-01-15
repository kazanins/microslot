# 🎰 MicroSlot - Tempo Micropayments Demo

A slot machine demo that illustrates micropayments on Tempo testnet (Moderato) using the HTTP Payment authentication specification with access keys.

## 🌟 Features

- **Passkey Authentication**: Sign up and login using WebAuthn passkeys (biometric authentication)
- **Automatic Funding**: New accounts receive $1000 AlphaUSD from faucet
- **Access Key Deposits**: Add funds ($10/$20/$50) via Tempo access keys
- **HTTP Payment Auth**: Implements draft-ietf-httpauth-payment specification
- **Micropayments**: $1 per spin with on-chain verification
- **Real-time Activity Log**: View all payment flows, challenges, and transactions
- **Winning System**: ~14% win probability with $10 AlphaUSD prizes
- **Tempo Explorer Integration**: All transactions link to Tempo block explorer

## 🏗️ Architecture

### Frontend
- **Next.js 15** with App Router
- **React 19** with TypeScript
- **Tailwind CSS** for styling
- **Wagmi v3** for Tempo blockchain integration
- **Viem** for EVM interactions

### Backend
- **Next.js API Routes** for backend logic
- **HTTP Payment Authentication** with 402 status codes
- **Access Key Management** via Tempo protocol
- **In-memory Session Store** (demo purposes)

### Blockchain
- **Network**: Tempo Testnet (Moderato)
- **Chain ID**: 42431
- **RPC**: https://rpc.moderato.tempo.xyz
- **Token**: AlphaUSD (0x20c0...0001)
- **Explorer**: https://explore.tempo.xyz

## 🚀 Getting Started

### Prerequisites
- Node.js 20+ and npm
- A browser with WebAuthn support (Chrome, Safari, Firefox, Edge)
- Biometric authentication (Face ID, Touch ID, fingerprint) or PIN

### Installation

1. **Clone and navigate to the project**:
   ```bash
   cd microslot
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Environment is already configured** in `.env.local`:
   - Tempo RPC URL and Chain ID
   - AlphaUSD token address
   - Casino wallet (pre-generated)
   - Faucet URL

4. **Fund the casino wallet** (optional, for prize payouts):
   ```bash
   # Visit the faucet and fund the casino address:
   # Casino Address: 0x54F1c80f538178930568039b2976F49a4a356c12
   # Faucet: https://tiny-faucet.up.railway.app/
   ```

5. **Start the development server**:
   ```bash
   npm run dev
   ```

6. **Open the app**:
   ```
   http://localhost:3000
   ```

## 🎮 How to Play

### 1. Sign Up
- Click the "✨ Sign Up" button
- Create a passkey when prompted (Face ID, Touch ID, fingerprint, or PIN)
- Your Tempo account is created instantly
- Account is automatically funded with $1000 AlphaUSD via faucet

### 2. Add Funds to Machine
- Click any of the "+$10", "+$20", or "+$50" buttons
- Sign the access key authorization with your passkey
- Funds are now deposited into the slot machine

### 3. Spin!
- Click the "🎰 SPIN ($1)" button
- Each spin costs $1 AlphaUSD
- Watch the activity log for payment flow details

### 4. Win Prizes
- Match 3 symbols to win!
- Win probability: ~14% (high!)
- Prize: $10 AlphaUSD sent to your account

### 5. Continue Playing
- Keep spinning until balance runs out
- Add more funds anytime with the +$ buttons
- Login/logout freely - your session is preserved

## 📖 HTTP Payment Authentication Flow

This demo implements the `draft-ietf-httpauth-payment` specification:

### Initial Spin (No Access Key)
```
1. Client: GET /api/spin
2. Server: 402 Payment Required
   WWW-Authenticate: Payment
     id="challenge_id"
     realm="microslot-casino"
     method="tempo"
     intent="approval"
     request="<base64url_authorization_structure>"
```

### Access Key Creation
```
3. User signs access key authorization with passkey
4. Client: GET /api/spin
   Authorization: Payment <base64url_credential>
5. Server verifies signature and stores access key
```

### Subsequent Spins
```
6. Server uses stored access key to deduct funds
7. Server: 200 OK
   Payment-Receipt: <base64url_receipt>
   Body: { combination, isWin, txHash, remainingBalance }
```

## 🔑 Access Keys Explained

Access keys on Tempo allow users to authorize specific spending limits:

- **User creates** an access key from their root account
- **Casino receives** the access key to deduct funds
- **Spending limits** enforce max amount (e.g., $10/$20/$50)
- **No expiration** - keys remain valid until funds depleted
- **On-chain enforced** - protocol validates all transactions

This enables seamless micropayments without user interaction per transaction!

## 📁 Project Structure

```
microslot/
├── app/
│   ├── api/
│   │   ├── auth/signup/route.ts    # Faucet funding
│   │   ├── access-key/route.ts     # Access key storage
│   │   ├── spin/route.ts           # HTTP Payment auth + spin logic
│   │   └── prize/route.ts          # Prize distribution
│   ├── layout.tsx                  # Root layout
│   ├── page.tsx                    # Main game page
│   └── globals.css                 # Tailwind styles
├── components/
│   ├── Providers.tsx               # Wagmi + QueryClient
│   ├── GamePanel.tsx               # Left panel (game)
│   ├── ActivityLog.tsx             # Right panel (logs)
│   ├── AuthButtons.tsx             # Sign up/login/logout
│   ├── SlotMachine.tsx             # Slot display
│   └── AddFundsButtons.tsx         # Deposit buttons
├── lib/
│   ├── wagmi.ts                    # Wagmi config
│   ├── tempo.ts                    # Tempo helpers
│   ├── payment-auth.ts             # HTTP Payment auth
│   ├── casino-wallet.ts            # Server wallet
│   └── session-store.ts            # In-memory storage
├── types/
│   └── index.ts                    # TypeScript types
└── .env.local                      # Environment config
```

## 🎨 Slot Machine Symbols

| Symbol | Probability | Win Chance (3x match) |
|--------|-------------|----------------------|
| 🍒     | 30%         | 2.7%                |
| 🍋     | 25%         | 1.56%               |
| 🍊     | 20%         | 0.8%                |
| 🍇     | 15%         | 0.34%               |
| 💎     | 8%          | 0.05%               |
| 7️⃣      | 2%          | 0.0008%             |

**Total Win Probability**: ~14.3%

## 🛠️ Technical Implementation Details

### Passkey Integration
- Uses Wagmi's `webAuthn` connector with `KeyManager.localStorage()`
- Passkeys are stored securely in browser's secure enclave
- Sign-up uses `capabilities: { type: 'sign-up' }`
- Login uses `capabilities: { type: 'sign-in' }`

### Access Key Authorization Structure
```typescript
{
  chainId: "0xa5bd",           // Tempo testnet
  keyId: "<casino_address>",   // Authorized spender
  keyType: "0x00",             // secp256k1
  expiry: "0x00",              // No expiration
  limits: [{
    token: "0x20c0...0001",    // AlphaUSD
    amount: "0x..."            // Deposit amount in hex
  }]
}
```

### Game Logic
- Random combination generator with weighted probabilities
- Win detection: all three symbols must match
- Balance tracking: off-chain for UX, on-chain for verification
- Prize distribution: automatic on win detection

## 🔒 Security Considerations

### Production Checklist
- [ ] Use persistent session storage (Redis, Database)
- [ ] Implement proper signature verification for access keys
- [ ] Add rate limiting on API endpoints
- [ ] Use secure key manager (not localStorage)
- [ ] Implement challenge replay protection
- [ ] Add CORS headers appropriately
- [ ] Monitor and log security events
- [ ] Test with security audit tools
- [ ] Implement proper error handling
- [ ] Add transaction confirmation waiting

## 📚 Resources

- [Tempo Documentation](https://docs.tempo.xyz/)
- [HTTP Payment Auth Spec](/Users/jev/Desktop/draft-ietf-httpauth-payment_txt.txt)
- [Wagmi Tempo Integration](https://wagmi.sh/tempo)
- [Viem Tempo Support](https://viem.sh/tempo)
- [Tempo Explorer](https://explore.tempo.xyz)
- [Tempo Faucet](https://tiny-faucet.up.railway.app/)

## 📝 License

This is a demo project for educational purposes.

## 🙏 Acknowledgments

- Built on [Tempo](https://tempo.xyz/) blockchain
- Implements [HTTP Payment Authentication](https://datatracker.ietf.org/doc/draft-ietf-httpauth-payment/) draft spec
- Uses [Wagmi](https://wagmi.sh/) and [Viem](https://viem.sh/) for blockchain interactions
- Styled with [Tailwind CSS](https://tailwindcss.com/)

---

**Casino Address**: `0x54F1c80f538178930568039b2976F49a4a356c12`

Made with ❤️ for Tempo micropayments demo
