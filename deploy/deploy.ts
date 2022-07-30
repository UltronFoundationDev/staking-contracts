import { BigNumber } from "ethers";
import { subtask, task, types } from "hardhat/config";
import * as Helpers from './helpers';

async function deployContract(ethers: any, name: string, ...params: any[]) {
    const Contract = await ethers.getContractFactory(name);
    const contract = await Contract.deploy(...params);
    await contract.deployed();
    console.log(`${name}: ${contract.address}`);
}

task("deploy", "Deploy Staking Contracts")
  .setAction(async (taskArgs, { ethers, run }) => {
    const wulx = '0x3a4F06431457de873B588846d139EC0d86275d54';
    
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

        const factoryAddress = '0xe1F0D4a5123Fd0834Be805d84520DFDCd8CF00b7';
        const route1Address = '0x97FDd294024f50c388e39e73F1705a35cfE87656'; // usdt
        const route2Address = '0x3c4E0FdeD74876295Ca36F62da289F69E3929cc4'; // usdc

        const brewUlxFactory = await ethers.getContractFactory("BrewULX", signer);
        const brewUlx = await (await brewUlxFactory.deploy(factoryAddress, taskArgs.xulx, taskArgs.wulx, route1Address, route2Address)).deployed();
        console.log(`BrewULX: \u001b[1;34m${brewUlx.address}\u001b[0m`);    

        return brewUlx.address;
  });

task("add-tokens", "Adding tokens to aceLab")
  .setAction(async (taskArgs, { ethers, run }) => { 
    const signer = (await ethers.getSigners())[0];

    const aceLabAddress = '0xa7cF49a0C559414d51ae607ccc1563D292ECf23A';
    const aceLab = await ethers.getContractAt("AceLab", aceLabAddress, signer);
    
    const treasuryAddress = "0xD60e1D7CCf2Bb8E2052079914c333c92D687B965";

    const wbtc  = '0xd2b86a80A8f30b83843e247A50eCDc8D843D87dD';
    const weth  = '0x2318Bf5809a72AaBAdd15a3453A18e50Bbd651Cd';
    const bnb   = '0x169ac560852ed79af3D97A8977DCf2EBA54A0488';
    const avax  = '0x6FE94412953D373Ef464b85637218EFA9EAB8e97';
    const busd  = '0xc7cAc85C1779d2B8ADA94EFfff49A4754865e2E4';
    const shib  = '0xb5Bb1911cf6C83C1a6E439951C40C2949B0d907f';
    const matic = '0x6094a1e3919b302E236B447f45c4eb2DeCE9D9F4';
    const ftm   = '0xE8Ef8A6FE387C2D10951a63ca8f37dB6B8fA02C1';
    const dai   = '0x045F0f2DE758743c84b756B1Fca735a0dDf0b8f4';
    const link  = '0xc8Fb7999d62072E12fE8f3EDcd7821204FCa0344';
    const usdt  = '0x97FDd294024f50c388e39e73F1705a35cfE87656';
    const usdc  = '0x3c4E0FdeD74876295Ca36F62da289F69E3929cc4';
    const wulx  = '0x3a4F06431457de873B588846d139EC0d86275d54';

    const dateNow = Math.floor(Date.now() / 1000);
    const tokens = [usdc, avax, dai, wulx, shib];
    const rewardPerSecond = ethers.utils.parseEther("0.000001");
    for(let i:number = 0; i < tokens.length; i++) {
        await aceLab.add(rewardPerSecond, tokens[i], BigNumber.from(dateNow).sub(1000), BigNumber.from(dateNow).mul(2), treasuryAddress, { gasLimit: 3000000 });
        console.log(`POOL ${i} | ${tokens[i]} | ${rewardPerSecond}`);
        Helpers.delay(4000);
    }
    for(let i:number = 0; i < tokens.length; i++) {
      console.log(await aceLab.poolInfo(i));
    }
  });

task("change-owner-aceLab", "Transfer ownership on Acelab contract")
  .setAction(async (taskArgs, {ethers}) => {
      const signer = (await ethers.getSigners())[0];

      const aceLabAddress = '0xa7cF49a0C559414d51ae607ccc1563D292ECf23A';
      const aceLab = await ethers.getContractAt("AceLab", aceLabAddress, signer);
  
      const owner = '0x4CE535D6E2D47690e33CA646972807BeB264dFBf';

      await aceLab.transferOwnership(owner);
      await Helpers.delay(4000);
      console.log(await aceLab.owner())
  });

task("change-owner-auth", "Transfer ownership and adds auth on BrewUlx contract")
  .setAction(async (taskArgs, {ethers}) => {
      const signer = (await ethers.getSigners())[0];

      const brewUlxAddress = '0xD98878B704431d566bdB47c6aAA34E4deAFC5A52';
      const brewUlx = await ethers.getContractAt("BrewUlx", brewUlxAddress, signer);

      const owner = '0x4CE535D6E2D47690e33CA646972807BeB264dFBf';
      
      await brewUlx.addAuth(owner);
      await Helpers.delay(4000);
      console.log(`IsModerator ${owner} = ${await brewUlx.isAuth(owner)}`);

      await brewUlx.transferOwnership(owner);
      await Helpers.delay(4000);
      console.log(await brewUlx.owner())
  });
