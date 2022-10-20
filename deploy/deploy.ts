import {BigNumber} from "ethers";
import {task, types} from "hardhat/config";
import * as Helpers from './helpers';

async function deployContract(ethers: any, name: string, ...params: any[]) {
    const Contract = await ethers.getContractFactory(name);
    const contract = await Contract.deploy(...params);
    await contract.deployed();
    console.log(`${name}: ${contract.address}`);
}

require('dotenv').config();


const fs = require('fs');

const filename = process.env.DIRNAME + "/deployed_storage.json";

let deployed_storage: any = {};
try {
  deployed_storage = JSON.parse(fs.readFileSync(filename).toString().trim());
  console.log(deployed_storage);
} catch (err) {
  console.log("No ", filename, ' Let\'s deploy contracts');
}


task("deploy", "Deploy Staking Contracts")
  .setAction(async (taskArgs, { ethers, run }) => {
    const wulx = JSON.parse(fs.readFileSync(filename).toString().trim())["tokens"]["wULX"];
    
    const xulx = await run("xulx", { wulx: wulx });
    const acelab = await run("acelab", {xulx: xulx});
    const brewulx = await run("brewulx", {xulx: xulx, wulx: wulx});

    deployed_storage['tokens']["xULX"] = xulx;
    deployed_storage['functional_contracts']["acelab"] = acelab;
    deployed_storage["brewulx"] = brewulx;
    fs.writeFileSync(filename, JSON.stringify(deployed_storage));
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

        const factoryAddress = JSON.parse(fs.readFileSync(filename).toString().trim())["UniswapV2Factory"];
        const route1Address = JSON.parse(fs.readFileSync(filename).toString().trim())["uUSDT"]; // usdt
        const route2Address = JSON.parse(fs.readFileSync(filename).toString().trim())["uUSDC"]; // usdc

        const brewUlxFactory = await ethers.getContractFactory("BrewULX", signer);
        const brewUlx = await (await brewUlxFactory.deploy(factoryAddress, taskArgs.xulx, taskArgs.wulx, route1Address, route2Address)).deployed();
        console.log(`BrewULX: \u001b[1;34m${brewUlx.address}\u001b[0m`);    

        return brewUlx.address;
  });

task("add-tokens", "Adding tokens to aceLab")
  .setAction(async (taskArgs, { ethers, run }) => { 
    const signer = (await ethers.getSigners())[0];

    const aceLabAddress = JSON.parse(fs.readFileSync(filename).toString().trim())["acelab"];
    const aceLab = await ethers.getContractAt("AceLab", aceLabAddress, signer);
    
    const treasuryAddress = signer.address;

    const wbtc  = JSON.parse(fs.readFileSync(filename).toString().trim())["tokens"]["wBTC"];
    const weth  = JSON.parse(fs.readFileSync(filename).toString().trim())["tokens"]["wETH"];
    const bnb   = JSON.parse(fs.readFileSync(filename).toString().trim())["tokens"]["BNB"];
    const avax  = JSON.parse(fs.readFileSync(filename).toString().trim())["tokens"]["AVAX"];
    const busd  = JSON.parse(fs.readFileSync(filename).toString().trim())["tokens"]["BUSD"];
    const shib  = JSON.parse(fs.readFileSync(filename).toString().trim())["tokens"]["SHIB"];
    const matic = JSON.parse(fs.readFileSync(filename).toString().trim())["tokens"]["MATIC"];
    const ftm   = JSON.parse(fs.readFileSync(filename).toString().trim())["tokens"]["FTM"];
    const dai   = JSON.parse(fs.readFileSync(filename).toString().trim())["tokens"]["DAI"];
    const link  = JSON.parse(fs.readFileSync(filename).toString().trim())["tokens"]["LINK"];
    const usdt  = JSON.parse(fs.readFileSync(filename).toString().trim())["tokens"]["uUSDT"];
    const usdc  = JSON.parse(fs.readFileSync(filename).toString().trim())["tokens"]["uUSDC"];
    const wulx  = JSON.parse(fs.readFileSync(filename).toString().trim())["tokens"]["wULX"];

    const dateNow = Math.floor(Date.now() / 1000);
    const tokens = [usdc, avax, dai, wulx, shib];
    const rewardPerSecond = ethers.utils.parseEther("0.000001");
    for(let i:number = 0; i < tokens.length; i++) {
        await aceLab.add(rewardPerSecond, tokens[i], BigNumber.from(dateNow).sub(1000), BigNumber.from(dateNow).mul(2), treasuryAddress, { gasLimit: 3000000 });
        console.log(`POOL ${i} | ${tokens[i]} | ${rewardPerSecond}`);
        
    }
  });

task("change-owner-aceLab", "Transfer ownership on Acelab contract")
  .setAction(async (taskArgs, {ethers}) => {
      const signer = (await ethers.getSigners())[0];

      const aceLabAddress = '0xa7cF49a0C559414d51ae607ccc1563D292ECf23A';
      const aceLab = await ethers.getContractAt("AceLab", aceLabAddress, signer);
  
      const owner = '0x4CE535D6E2D47690e33CA646972807BeB264dFBf';

      await aceLab.transferOwnership(owner);
      
      console.log(await aceLab.owner())
  });

task("change-owner-auth", "Transfer ownership and adds auth on BrewUlx contract")
  .setAction(async (taskArgs, {ethers}) => {
      const signer = (await ethers.getSigners())[0];

      const brewUlxAddress = '0xD98878B704431d566bdB47c6aAA34E4deAFC5A52';
      const brewUlx = await ethers.getContractAt("BrewUlx", brewUlxAddress, signer);

      const owner = '0x4CE535D6E2D47690e33CA646972807BeB264dFBf';
      
      await brewUlx.addAuth(owner);
      
      console.log(`IsModerator ${owner} = ${await brewUlx.isAuth(owner)}`);

      await brewUlx.transferOwnership(owner);
      
      console.log(await brewUlx.owner())
  });
