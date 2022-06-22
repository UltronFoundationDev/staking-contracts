import { subtask, task, types } from "hardhat/config";

task("deploy", "Deploy MasterChef")
  .addParam("contracts", "Sting with names deploy contracts")
  .addOptionalParam("wulx", "wULX address")
  .addOptionalParam("xulx", "xULX address")
  .addOptionalParam("factory", "Factory address")
  .addOptionalParam("r1", "Router1 for brewULX address")
  .addOptionalParam("r2", "Router2 for brewULX address")
  .setAction(async (taskArgs, { ethers, run }) => {
  let xUlxAddress: string = taskArgs.xulx
    const contracts = taskArgs.contracts.split(" ");
    if (contracts.includes("xulx")) {
        const xULX = await ethers.getContractFactory("ULXMirrorWorld");
        const xUlxContract = await xULX.deploy(taskArgs.wulx);
        await xUlxContract.deployed();
        xUlxAddress = xUlxContract.address
        console.log("xULX deployed to:", xUlxContract.address);
    };
    if (contracts.includes("acelab")) {
        const AceLab = await ethers.getContractFactory("AceLab");
        const aceLab = await AceLab.deploy(xUlxAddress);
        await aceLab.deployed();
        console.log("AceLab deployed to:", aceLab.address);
    };
    if (contracts.includes("brewulx")) {
        const BrewULX = await ethers.getContractFactory("BrewULX");
        const brewULX = await BrewULX.deploy(taskArgs.factory, xUlxAddress, taskArgs.wulx, taskArgs.r1, taskArgs.r2);
        await brewULX.deployed();
        console.log("BrewULX deployed to:", brewULX.address);
    };
  });