const {Keypair} = require('@solana/web3.js');
const bs58Module = require('bs58');
const bs58 = bs58Module.default ?? bs58Module;

const kp = Keypair.generate();
const pubKey = kp.publicKey.toBase58();
const secKey = bs58.encode(kp.secretKey);

console.log('=============================');
console.log('SOLANA DEVNET KEYPAIR');
console.log('=============================');
console.log('');
console.log('PUBLIC KEY:');
console.log(pubKey);
console.log('');
console.log('SECRET KEY (paste into .env as SOLANA_KEYPAIR=):');
console.log(secKey);
console.log('');
console.log('Explorer:');
console.log('https://explorer.solana.com/address/' + pubKey + '?cluster=devnet');
console.log('');  
console.log('Next:');
console.log('1. Copy the SECRET KEY above');
console.log('2. Open .env and set: SOLANA_KEYPAIR=' + secKey);
console.log('3. Request airdrop: https://faucet.solana.com');
console.log('4. Run: npx tsx scripts/test-solana.ts --chain');
