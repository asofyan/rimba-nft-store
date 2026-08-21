// Deploy RimbaNFT via Hardhat.
// Pakai: npx hardhat run scripts/deploy.js --network ganache
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { network } from 'hardhat';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function main() {
  const { ethers } = await network.create();

  const [deployer] = await ethers.getSigners();
  console.log('Deploying with account:', deployer.address);

  const rimba = await ethers.deployContract('RimbaNFT');
  await rimba.waitForDeployment();

  const address = await rimba.getAddress();
  console.log('RimbaNFT deployed to:', address);

  // Tulis alamat ke .env di root backend agar mudah disalin
  const envPath = path.resolve(__dirname, '../../.env');
  if (fs.existsSync(envPath)) {
    let env = fs.readFileSync(envPath, 'utf8');
    const line = `CONTRACT_ADDRESS=${address}`;
    if (/^CONTRACT_ADDRESS=.*$/m.test(env)) {
      env = env.replace(/^CONTRACT_ADDRESS=.*$/m, line);
    } else {
      env += `\n${line}\n`;
    }
    fs.writeFileSync(envPath, env);
    console.log('.env updated with new CONTRACT_ADDRESS');
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
