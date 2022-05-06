wulx = "0x841FAD6EAe12c286d1Fd18d1d525DFfA75C7EFFE"
factory = "0x152eE697f2E276fA89E96742e9bB9aB1F2E61bE3"
xulx = "0xa48d959AE2E88f1dAA7D5F611E01908106dE7598"

let factory, UlxMirrorWorld, BrewULX

async function main() {
    accounts = await ethers.getSigners();

    factory = await hre.ethers.getContractFactory("UlxMirrorWorld");
    UlxMirrorWorld = await factory.deploy(wulx);
    await UlxMirrorWorld.deployTransaction.wait()
    console.log("UlxMirrorWorld deployed to:", UlxMirrorWorld.address);

    factory = await hre.ethers.getContractFactory("BrewULX");
    BrewULX = await factory.deploy(factory, UlxMirrorWorld.address, wulx);
    await BrewULX.deployTransaction.wait()
    console.log("BrewULX deployed to:", BrewULX.address);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
