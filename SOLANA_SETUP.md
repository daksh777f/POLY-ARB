# Solana Verification Setup Guide

## ✅ What's Been Configured

1. **Enabled Solana in .env**
   - `SOLANA_ENABLED=true`
   - `SOLANA_RPC_URL=https://api.devnet.solana.com` (devnet configured)
   - `SOLANA_KEYPAIR` is set (placeholder - needs real value)

2. **Code Integration**
   - Commitment system in `src/solana/commitment.ts`
   - Test scripts ready in `scripts/test-solana.ts`
   - Automatic on-chain commit on signal generation (when enabled)

## 🔧 Next Steps: Generate Your Keypair

Run **one** of these commands to generate a fresh Solana devnet keypair:

### Option A: Using the setup script (Recommended)
```bash
node scripts/solana-setup.js
```

### Option B: Manual generation with Node
```bash
node -e "
const {Keypair} = require('@solana/web3.js');
const bs58 = require('bs58');
const kp = Keypair.generate();
const fs = require('fs');
const sec = bs58.encode(kp.secretKey);
fs.writeFileSync('.env.solana', 'SOLANA_KEYPAIR=' + sec + '\\nPUBLIC_KEY=' + kp.publicKey.toString());
console.log('✓ Keypair saved to .env.solana');
console.log('Public Key:', kp.publicKey.toString());
console.log('Paste SOLANA_KEYPAIR value into your .env file');
"
```

### Option C: Using solana-cli (if installed)
```bash
solana-keygen new --outfile solana_keypair.json
# Then base58 encode the bytes and paste into .env
```

## 💰 Fund Your Keypair on Devnet

Once you have your keypair, request a devnet airdrop:

```bash
node -e "const {Connection, PublicKey, LAMPORTS_PER_SOL}=require('@solana/web3.js'); const pubKey=new PublicKey('CTUGDNhJ7yfRQddJiDMfWdFcL8b3CfumXVtVubBe9jLa'); const conn=new Connection('https://api.devnet.solana.com'); conn.requestAirdrop(pubKey,2*LAMPORTS_PER_SOL).then(sig=>console.log('Airdrop requested:',sig)).catch(e=>console.log('May be rate-limited. Explorer:','https://explorer.solana.com/address/'+pubKey.toBase58()+'?cluster=devnet','Error:',e.message));"
```

Important: Do not paste labels like "Public Key:" into the JavaScript command.

## 🧪 Test the Commitment System

### Offline Tests (no SOL needed)
```bash
npx tsx scripts/test-solana.ts
```

This will verify:
- ✓ Payload construction
- ✓ Hashing (deterministic)
- ✓ Verification logic
- ✓ Memo format

### On-Chain Tests (requires funded keypair)
```bash
npx tsx scripts/test-solana.ts --chain
```

This will:
- ✓ Generate a test signal
- ✓ Create a commit transaction (hash) on devnet
- ✓ Create a reveal transaction (full payload) on devnet
- ✓ Print Solana explorer links

## 📊 View Results

### Check Your Account
- Replace `YOUR_PUBLIC_KEY` with your actual public key
- Devnet Explorer: `https://explorer.solana.com/address/YOUR_PUBLIC_KEY?cluster=devnet`

### Integration Test
Once running, signals will automatically commit to Solana:

```bash
curl http://localhost:3000/api/signals
# Will include commitTxSignature, commitHash, revealTxSignature when available
```

## 🚀 Full Flow

The system now works as:

1. **Signal Generation** (from orchestrator)
   - Event Pod analyzes market + news
   - Generates signal if EV threshold met
   - Signal stored in SQLite

2. **Solana Commit** (if SOLANA_ENABLED=true)
   - Signal commitment TX: stores hash on-chain
   - Reveals full payload in second TX
   - Both memos stored on SPL Memo program

3. **Verification**
   - On-chain proof: https://explorer.solana.com/tx/SIGNATURE?cluster=devnet
   - Prevents tampering of signals after-the-fact
   - Proof of Alpha for validator/investor confidence

## 📝 Environment Variables Reference

```env
# Solana on-chain commitments (Proof of Alpha)
SOLANA_RPC_URL=https://api.devnet.solana.com
SOLANA_KEYPAIR=<YOUR_BS58_ENCODED_SECRET_KEY_HERE>
SOLANA_ENABLED=true
```

## ⚠️ Troubleshooting

### "SOLANA_KEYPAIR not configured"
- Run one of the keypair generation commands above
- Copy the secret key it outputs
- Paste into .env as `SOLANA_KEYPAIR=...`
- Restart the app

### "Airdrop rate-limited"
- Check balance on devnet explorer
- Wait a moment and try again
- Or use an existing amount of devnet SOL if you have it

### "Connection failed"
- Devnet may be temporarily down
- Try mainnet-beta RPC as alternative (but won't create testable states)
- Check: https://status.solana.com

## ✅ Verification Checklist

- [ ] Keypair generated (private key in .env)
- [ ] SOLANA_ENABLED=true
- [ ] App restarted (npm run dev)
- [ ] npm run dev output shows "orchestrator" running
- [ ] npx tsx scripts/test-solana.ts passes  
- [ ] npx tsx scripts/test-solana.ts --chain succeeds
- [ ] Signals show up in http://localhost:3000/api/signals
- [ ] Commit/reveal TX signatures appear in signal data
- [ ] Explorer shows memos on https://explorer.solana.com/address/YOUR_KEY?cluster=devnet
