#!/usr/bin/env node

const { Keypair } = require('@solana/web3.js');
const bs58Module = require('bs58');
const fs = require('fs');
const path = require('path');
const bs58 = bs58Module.default ?? bs58Module;

// Generate keypair
const keypair = Keypair.generate();
const pubKey = keypair.publicKey.toBase58();
const secKey = bs58.encode(keypair.secretKey);

// Read .env
const envPath = path.join(__dirname, '..', '.env');
let envContent = fs.readFileSync(envPath, 'utf-8');

// Update SOLANA_KEYPAIR line
envContent = envContent.replace(/^SOLANA_KEYPAIR=.*$/m, `SOLANA_KEYPAIR=${secKey}`);

// Update SOLANA_ENABLED line  
envContent = envContent.replace(/^SOLANA_ENABLED=.*$/m, `SOLANA_ENABLED=true`);

// Write back
fs.writeFileSync(envPath, envContent, 'utf-8');

// Write keypair info to a log file for reference
const logPath = path.join(__dirname, 'solana-keypair.txt');
fs.writeFileSync(logPath, `Generated: ${new Date().toISOString()}\nPublic Key: ${pubKey}\nSecret Key: ${secKey}\nRPC: https://api.devnet.solana.com\nExplorer: https://explorer.solana.com/address/${pubKey}?cluster=devnet\n`, 'utf-8');

console.log('✓ Solana setup complete!');
console.log(`Public Key: ${pubKey}`);
console.log(`Keypair info saved to: scripts/solana-keypair.txt`);
console.log(`\nNext steps:`);
console.log(`1. Run: npm run dev`);
console.log(`2. Run: npx tsx scripts/test-solana.ts --chain`);
console.log(`3. Monitor on devnet explorer: https://explorer.solana.com/address/${pubKey}?cluster=devnet`);
