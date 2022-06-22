import { subtask, task, types } from "hardhat/config";

let xUlxAddress: string

async function deployContract(ethers: any, name: string, ...params: any[]) {
    const Contract = await ethers.getContractFactory(name);
    const contract = await Contract.deploy(...params);
    await contract.deployed();
    if (name === "ULXMirrorWorld") {
        xUlxAddress = contract.address
    }
    console.log(`${name} deployed to: ${contract.address}`);
}

task("deploy", "Deploy Staking Contracts")
  .addParam("contracts", "Sting with names deploy contracts")
  .addOptionalParam("wulx", "wULX address")
  .addOptionalParam("xulx", "xULX address")
  .addOptionalParam("factory", "Factory address")
  .addOptionalParam("r1", "Router1 for brewULX address")
  .addOptionalParam("r2", "Router2 for brewULX address")
  .setAction(async (taskArgs, { ethers, run }) => {
  xUlxAddress = taskArgs.xulx
    const contracts = taskArgs.contracts.split(" ");
    if (contracts.includes("xulx")) {
        await deployContract(ethers, "ULXMirrorWorld", taskArgs.wulx)
    };
    if (contracts.includes("acelab")) {
        await deployContract(ethers, "AceLab", xUlxAddress)

    };
    if (contracts.includes("brewulx")) {
        await deployContract(ethers, "BrewULX", taskArgs.factory, xUlxAddress, taskArgs.wulx, taskArgs.r1, taskArgs.r2)
    };
  });