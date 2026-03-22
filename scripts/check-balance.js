const { Connection, PublicKey, LAMPORTS_PER_SOL } = require('@solana/web3.js');
const fs = require('fs');
const path = require('path');

const OUTPUT_PATH = path.join(__dirname, '..', 'balance-result.txt');

async function main() {
  const address = process.argv[2] || 'CTUGDNhJ7yfRQddJiDMfWdFcL8b3CfumXVtVubBe9jLa';
  const conn = new Connection('https://api.devnet.solana.com', 'confirmed');
  const pubKey = new PublicKey(address);
  const balanceLamports = await conn.getBalance(pubKey);
  const balanceSol = balanceLamports / LAMPORTS_PER_SOL;

  const output = [
    `address=${pubKey.toBase58()}`,
    `lamports=${balanceLamports}`,
    `sol=${balanceSol}`,
  ].join('\n');

  fs.writeFileSync(OUTPUT_PATH, output, 'utf8');
}

main().catch((e) => {
  fs.writeFileSync(OUTPUT_PATH, `error=${e.message}`, 'utf8');
  process.exit(1);
});
