import { ethers, run } from "hardhat"

const wulx = "0x841FAD6EAe12c286d1Fd18d1d525DFfA75C7EFFE"
const factory = "0x152eE697f2E276fA89E96742e9bB9aB1F2E61bE3"
const xulx = "0xa48d959AE2E88f1dAA7D5F611E01908106dE7598"

async function main() {
    const brewUlx = await ethers.getContractFactory("BrewBooV2");
    const BrewULX = await brewUlx.deploy(factory, xboo, boo, wftm);
    await BrewULX.deployed()
    console.log("BrewULX deployed to:", BrewBoo.address);

    await run("verify:verify", {
      address: BrewBoo.address,
      constructorArguments: [factory, xulx, wulx],
  })
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
