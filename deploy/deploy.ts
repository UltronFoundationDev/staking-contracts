import { subtask, task, types } from "hardhat/config";

async function deployContract(ethers: any, name: string, ...params: any[]) {
    const Contract = await ethers.getContractFactory(name);
    const contract = await Contract.deploy(...params);
    await contract.deployed();
    console.log(`${name}: ${contract.address}`);
}

task("deploy", "Deploy Staking Contracts")
  .setAction(async (taskArgs, { ethers, run }) => {
    const wulx = '0xE2619ab40a445526B0AaDff944F994971d2EAc05';
    
    const xulx = await run("xulx", { wulx: wulx });

    const acelab = await run("acelab", { xulx: xulx });

    const brewulx = await run("brewulx", { xulx: xulx, wulx: wulx });
  });

task("xulx", "The contract xulx is deployed")
  .addParam("wulx", "wulx address", "", types.string)
  .setAction(async (taskArgs, { ethers, network }) => {
        const signer = (await ethers.getSigners())[0];

        const xUlxFactory = await ethers.getContractFactory("ULXMirrorWorld", signer);
        const xUlx = await (await xUlxFactory.deploy(taskArgs.wulx)).deployed();
        console.log(`xULX: \u001b[1;34m${xUlx.address}\u001b[0m`);    

        return xUlx.address;
  });

task("acelab", "The contract AceLab is deployed")
  .addParam("xulx", "xulx address", "", types.string)
  .setAction(async (taskArgs, { ethers, network }) => {
        const signer = (await ethers.getSigners())[0];

        const acelabFactory = await ethers.getContractFactory("AceLab", signer);
        const acelab = await (await acelabFactory.deploy(taskArgs.xulx)).deployed();
        console.log(`AceLab: \u001b[1;34m${acelab.address}\u001b[0m`);    

        return acelab.address;
  });

task("brewulx", "The contract BrewUlx is deployed")
  .addParam("xulx", "xulx address", "", types.string)
  .addParam("wulx", "wulx address", "", types.string)
  .setAction(async (taskArgs, { ethers, network }) => {
        const signer = (await ethers.getSigners())[0];

        const factoryAddress = '0x58e103F46b99014e1A28113C7434fDB05e84Fb2a';
        const route1Address = '0x9d40F4A04C737887a79902Caa7cE8003197D8B1C'; // dai
        const route2Address = '0xFac94031AA8f09e2858F93974178fd70F276EAD1'; // usdc

        const brewUlxFactory = await ethers.getContractFactory("BrewULX", signer);
        const brewUlx = await (await brewUlxFactory.deploy(factoryAddress, taskArgs.xulx, taskArgs.wulx, route1Address, route2Address)).deployed();
        console.log(`BrewULX: \u001b[1;34m${brewUlx.address}\u001b[0m`);    

        return brewUlx.address;
  });

task("add-tokens", "Adding tokens to aceLab")
  .setAction(async (taskArgs, { ethers, run }) => { 
    const signer = (await ethers.getSigners())[0];

    const aceLabAddress = '0x72423ce6F8240D60094371b177F50B476Ca9d7cf';
    const aceLab = await ethers.getContractAt("AceLab", aceLabAddress, signer);
    
    const treasuryuAddress = "0x68CbD167CB4a15f2400b4B3913252B6D9D9d7613";

    const usdc = '0xFac94031AA8f09e2858F93974178fd70F276EAD1';
    const avax = '0xA066a85923dFB145B947EB4A74c6e0ad7CEAE193';
    const dai = '0x9d40F4A04C737887a79902Caa7cE8003197D8B1C';
    const wulx = '0xE2619ab40a445526B0AaDff944F994971d2EAc05';
    const shib = '0x29263214978Db13A1b1cA0381f58Ca7b2054588c';

    const dateNow = Date.now();
    const tokens = [usdc, avax, dai, wulx, shib];
    const rewardPerSecond = 1000;
    for(let i:number = 0; i< tokens.length; i++) {
        await aceLab.add(rewardPerSecond, tokens[i], dateNow - 10, dateNow * 2, treasuryuAddress);
        console.log(`Added ${tokens[i]} ${rewardPerSecond}`)
    }
  });
