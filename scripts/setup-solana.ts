/**
 * Setup script for Solana devnet verification.
 * Generates a fresh keypair, requests devnet airdrop, validates, and saves to .env
 */

import { Keypair, Connection, LAMPORTS_PER_SOL } from '@solana/web3.js'
import bs58Import from 'bs58'
import fs from 'fs'
import path from 'path'

const bs58 = (bs58Import as unknown as { default?: { encode: (data: Uint8Array) => string }; encode?: (data: Uint8Array) => string }).default
  ?? (bs58Import as unknown as { encode: (data: Uint8Array) => string })

const DEVNET_RPC = 'https://api.devnet.solana.com'

async function main() {
  console.log('🔧 Solana Devnet Setup\n')

  // 1. Generate keypair
  console.log('1️⃣ Generating fresh keypair...')
  const keypair = Keypair.generate()
  const publicKey = keypair.publicKey
  const publicKeyBase58 = publicKey.toBase58()
  const secretKey = bs58.encode(keypair.secretKey)
  
  console.log(`   Public Key: ${publicKeyBase58}`)
  console.log(`   Secret Key: ${secretKey.slice(0, 20)}...`)

  // 2. Connect to devnet
  console.log('\n2️⃣ Connecting to Solana devnet...')
  const connection = new Connection(DEVNET_RPC, 'confirmed')
  const version = await connection.getVersion()
  console.log(`   RPC Version: ${version['solana-core']}`)

  // 3. Request airdrop
  console.log('\n3️⃣ Requesting devnet airdrop (2 SOL)...')
  try {
    // Use modern airdrop method if available
    const airdropSig = await connection.requestAirdrop(publicKey, 2 * LAMPORTS_PER_SOL)
    console.log(`   Airdrop tx: ${airdropSig}`)
    
    // Wait for confirmation
    const latestBlockhash = await connection.getLatestBlockhash('confirmed')
    await connection.confirmTransaction(
      {
        signature: airdropSig,
        blockhash: latestBlockhash.blockhash,
        lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
      },
      'confirmed'
    )
    console.log('   ✓ Airdrop confirmed')
  } catch (e) {
    console.log(`   ⚠️ Airdrop may not be available (this is OK): ${e instanceof Error ? e.message : String(e)}`)
  }

  // 4. Check balance
  console.log('\n4️⃣ Checking balance...')
  const balance = await connection.getBalance(publicKey)
  const solBalance = balance / LAMPORTS_PER_SOL
  console.log(`   Balance: ${solBalance} SOL`)
  console.log(`   Status: ${solBalance > 0 ? '✓ Ready' : '⚠️ No balance (airdrop may be rate-limited)'}`)

  // 5. Update .env
  console.log('\n5️⃣ Updating .env...')
  const envPath = path.join(process.cwd(), '.env')
  let envContent = fs.readFileSync(envPath, 'utf-8')

  // Replace or add SOLANA_KEYPAIR
  if (envContent.includes('SOLANA_KEYPAIR=')) {
    envContent = envContent.replace(/SOLANA_KEYPAIR=.*/, `SOLANA_KEYPAIR=${secretKey}`)
  } else {
    envContent += `\nSOLANA_KEYPAIR=${secretKey}`
  }

  // Replace or add SOLANA_ENABLED
  if (envContent.includes('SOLANA_ENABLED=')) {
    envContent = envContent.replace(/SOLANA_ENABLED=.*/, `SOLANA_ENABLED=true`)
  } else {
    envContent += `\nSOLANA_ENABLED=true`
  }

  fs.writeFileSync(envPath, envContent, 'utf-8')
  console.log('   ✓ .env updated')

  // 6. Summary
  console.log('\n✅ Setup complete!\n')
  console.log('Next steps:')
  console.log('   1. Restart your app (npm run dev)')
  console.log('   2. Run: npx tsx scripts/test-solana.ts --chain')
  console.log(`   3. Monitor devnet: https://explorer.solana.com/address/${publicKeyBase58}?cluster=devnet\n`)
}

main().catch((e) => {
  console.error('❌ Setup failed:', e.message)
  process.exit(1)
})
