const { Keypair } = require('@solana/web3.js');
const bs58 = require('bs58');

const keypair = Keypair.generate();
console.log('PUBLIC_KEY=' + keypair.publicKey.toString());
console.log('SECRET_KEY_BS58=' + bs58.encode(keypair.secretKey));
