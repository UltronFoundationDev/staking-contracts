import {ethers} from "hardhat";
import { AceLab, AceLab__factory, ERC20Mock, ERC20Mock__factory, NewWETH, NewWETH__factory, Swapper, Swapper__factory, ULXMirrorWorld, ULXMirrorWorld__factory, UniswapDAO, UniswapDAO__factory, UniswapV2Factory, UniswapV2Factory__factory, UniswapV2Router02, UniswapV2Router02__factory } from "../typechain-types";
import {expect} from "chai";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { BigNumber } from "ethers";
import * as Helpers from './helpers';

describe("AceLab tests", () => {
    const zeroAddress = "0x0000000000000000000000000000000000000000";
    const someAddress = "0xcafecafecafecafecafecafecafecafecafecafe";
    let provider: any;

    let owner: SignerWithAddress;
    let treasuryAccount: SignerWithAddress;
    let account: SignerWithAddress;

    let factory: UniswapV2Factory;
    let dao: UniswapDAO;
    let router: UniswapV2Router02;
    let weth: NewWETH;
    let swapper: Swapper;
    let xUlx: ULXMirrorWorld;
    let aceLab: AceLab;

    let token0: ERC20Mock;
    let token1: ERC20Mock;
    let lp: ERC20Mock;

    beforeEach(async () => {
        provider = ethers.provider;

        [ owner, treasuryAccount, account ] = await ethers.getSigners();

        const totalSupply = ethers.utils.parseEther("1000000");
        token0 = await (await new ERC20Mock__factory(owner).deploy("MyToken1", "MYT1", totalSupply)).deployed();
        token1 = await (await new ERC20Mock__factory(owner).deploy("MyToken2", "MYT2", totalSupply)).deployed();

        factory = await (await new UniswapV2Factory__factory(owner).deploy(owner.address, treasuryAccount.address)).deployed();

        dao = await (await new UniswapDAO__factory(owner).deploy(factory.address)).deployed();

        await expect(factory.connect(treasuryAccount).setDAOContractInitial(dao.address)).revertedWith("not daoSetter");
        await expect(factory.connect(owner).setDAOContractInitial(zeroAddress)).revertedWith("zero address");
        await expect(factory.connect(owner).setDAOContractInitial(owner.address)).revertedWith("EOA");
        await factory.connect(owner).setDAOContractInitial(dao.address);

        weth = await (await new NewWETH__factory(owner).deploy()).deployed();

        router = await (await new UniswapV2Router02__factory(owner).deploy(factory.address, weth.address)).deployed();
        
        await dao.connect(owner).newRouterChangeRequest(router.address);
        await factory.connect(owner).setRouterAddress(1);

        swapper = await (await new Swapper__factory(owner).deploy()).deployed();

        xUlx = await (await new ULXMirrorWorld__factory(owner).deploy(weth.address));

        await owner.sendTransaction({
            to: weth.address,
            value: ethers.utils.parseEther("100"),
        });

        aceLab = await (await new AceLab__factory(owner).deploy(xUlx.address)).deployed();

        const amountXUlx = ethers.utils.parseUnits("25", 18);
        await weth.connect(owner).approve(xUlx.address, amountXUlx);
        await xUlx.connect(owner).enter(amountXUlx);

        lp = await (await new ERC20Mock__factory(owner).deploy("LP", "LP", ethers.utils.parseEther("1000"))).deployed();
    });

    it("add lp token to pools\n", async () => {
        await expect(aceLab.connect(account).add(100, lp.address, Date.now() - 10, Date.now() * 365, owner.address)).revertedWith("Ownable: caller is not the owner");
        await aceLab.connect(owner).add(100, lp.address, Date.now() - 10, Date.now() * 365, owner.address);
        await expect(aceLab.connect(owner).add(100, lp.address, Date.now() - 10, Date.now() * 365, owner.address)).to.be.reverted;

        expect(1).equals(await aceLab.poolLength());
    });

    it("add load of lp tokens to pools\n", async () => {
        const tokensCount = 10;
        for(let i: number = 0; i < tokensCount; i++) {
            const tokenLp = await (await new ERC20Mock__factory(owner).deploy("LP", "LP", ethers.utils.parseEther("100"))).deployed();
            await aceLab.connect(owner).add(100, tokenLp.address, Date.now() - 10, Date.now() * 365, owner.address);
        }

        expect(tokensCount).equals(await aceLab.poolLength());
    });

    it("add lp token to pools and change reward per second\n", async () => {
        await expect(aceLab.connect(account).add(100, lp.address, Date.now() - 10, Date.now() * 365, owner.address)).revertedWith("Ownable: caller is not the owner");
        await aceLab.connect(owner).add(100, lp.address, Date.now() - 10, Date.now() * 365, owner.address);

        await expect(aceLab.connect(account).setRewardPerSecond(0, ethers.utils.parseEther("1"))).revertedWith("Ownable: caller is not the owner");
        await aceLab.connect(owner).setRewardPerSecond(0, 1000);

        await expect(aceLab.connect(owner).add(1000, lp.address, Date.now() - 10, Date.now() * 365, owner.address)).to.be.reverted;
        expect(1).equals(await aceLab.poolLength());
    });

    it("add lp token to pools and change End Time\n", async () => {
        const dateNow = Date.now();
        await expect(aceLab.connect(account).add(100, lp.address, dateNow - 10, dateNow, owner.address)).revertedWith("Ownable: caller is not the owner");
        await aceLab.connect(owner).add(100, lp.address, dateNow - 10, dateNow, owner.address);

        await expect(aceLab.connect(account).changeEndTime(0, 10)).revertedWith("Ownable: caller is not the owner");
        await aceLab.connect(owner).changeEndTime(0, 1000);

        await expect(aceLab.connect(owner).add(1000, lp.address, dateNow - 10, dateNow, owner.address)).to.be.reverted;
        expect(1).equals(await aceLab.poolLength());
        expect((await aceLab.poolInfo(0)).endTime).equals(dateNow + 1000);
    });

    it("add lp token to pools and stop reward\n", async () => {
        const dateNow = Date.now();
        await expect(aceLab.connect(account).add(100, lp.address, dateNow - 10, dateNow, owner.address)).revertedWith("Ownable: caller is not the owner");
        await aceLab.connect(owner).add(100, lp.address, dateNow - 10, dateNow, owner.address);

        await expect(aceLab.connect(account).stopReward(0)).revertedWith("Ownable: caller is not the owner");
        await aceLab.connect(owner).stopReward(0);

        await expect(aceLab.connect(owner).add(1000, lp.address, dateNow - 10, dateNow + 1000, owner.address)).to.be.reverted;
        expect(1).equals(await aceLab.poolLength());
        expect((await aceLab.poolInfo(0)).endTime).equals(BigNumber.from('11095107'));
    });

    it("add lp token to pools and change Pool UserLimit EndTime\n", async () => {
        const dateNow = Date.now();
        await expect(aceLab.connect(account).add(100, lp.address, dateNow - 10, dateNow, owner.address)).revertedWith("Ownable: caller is not the owner");
        await aceLab.connect(owner).add(100, lp.address, dateNow - 10, dateNow, owner.address);

        await expect(aceLab.connect(account).changePoolUserLimitEndTime(0, dateNow + 100)).revertedWith("Ownable: caller is not the owner");
        await aceLab.connect(owner).changePoolUserLimitEndTime(0, dateNow + 100);

        await expect(aceLab.connect(owner).add(1000, lp.address, dateNow - 10, dateNow + 1000, owner.address)).to.be.reverted;
        expect(1).equals(await aceLab.poolLength());
        expect((await aceLab.poolInfo(0)).userLimitEndTime).equals(dateNow + 100);
    });

    it("change UserLimit\n", async () => {
        await expect(aceLab.connect(account).changeUserLimit(5)).revertedWith("Ownable: caller is not the owner");
        await aceLab.connect(owner).changeUserLimit(5);

        expect(await aceLab.baseUserLimit()).equals(5);
    });

    it("change BaseUserLimitTime\n", async () => {
        await expect(aceLab.connect(account).changeBaseUserLimitTime(86400)).revertedWith("Ownable: caller is not the owner");
        await aceLab.connect(owner).changeBaseUserLimitTime(86400);

        expect(await aceLab.baseUserLimitTime()).equals(86400);
    });

    it("recoverWrongTokens\n", async () => {
        const dateNow = await Helpers.latest();
        await expect(aceLab.connect(account).recoverWrongTokens(lp.address)).revertedWith("Ownable: caller is not the owner");
        await expect(aceLab.connect(owner).recoverWrongTokens(xUlx.address)).revertedWith("recoverWrongTokens: Cannot be xULX");
        await aceLab.connect(owner).add(100, lp.address, dateNow.sub(10), dateNow.add(1000000), owner.address);
        await expect( aceLab.connect(owner).recoverWrongTokens(lp.address)).revertedWith("checkForToken: reward token provided");
        
        const transferAmount = ethers.utils.parseEther("10");
        await token0.connect(owner).transfer(aceLab.address, transferAmount);
        await aceLab.connect(owner).recoverWrongTokens(token0.address);

        expect(await token0.connect(owner).totalSupply()).equals(await token0.connect(owner).balanceOf(owner.address));
    });

    it("deposit\n", async () => {
        const dateNow = await Helpers.latest();
        await expect(aceLab.connect(account).add(100, lp.address, dateNow.sub(10), dateNow, owner.address)).revertedWith("Ownable: caller is not the owner");
        await aceLab.connect(owner).add(100, lp.address, dateNow.sub(10), dateNow.add(1000000), owner.address);

        const transferAmount = ethers.utils.parseEther("10");
        await lp.connect(owner).transfer(aceLab.address, transferAmount);
        expect(transferAmount).equals(await lp.balanceOf(aceLab.address))
        await xUlx.connect(owner).transfer(account.address, transferAmount);
        await xUlx.connect(account).approve(aceLab.address, transferAmount)
        const log1 = await aceLab.connect(account).deposit(0, transferAmount);
        await Helpers.advanceTimeAndBlock(100000);
        const log2 = await aceLab.massUpdatePools();

        const time1 = await Helpers.timestamp(log1.blockNumber)
        const time2 = await Helpers.timestamp(log2.blockNumber)

        const expected = ((await aceLab.poolInfo(0)).RewardPerSecond).mul(time2 - time1).sub(100)
        expect(transferAmount).equals(await xUlx.balanceOf(aceLab.address))
        expect(expected).equals(await aceLab.connect(account).pendingReward(0, account.address))
    }); 

    it("deposit with user deposit cap\n", async () => {
        const dateNow = await Helpers.latest();
        await expect(aceLab.connect(account).add(100, lp.address, dateNow.sub(10), dateNow, owner.address)).revertedWith("Ownable: caller is not the owner");
        await aceLab.connect(owner).add(100, lp.address, dateNow.sub(10), dateNow.add(1000000), owner.address);

        const transferAmount = ethers.utils.parseEther("10");
        await lp.connect(owner).transfer(aceLab.address, transferAmount);
        expect(transferAmount).equals(await lp.balanceOf(aceLab.address))
        await xUlx.connect(owner).transfer(account.address, transferAmount);
        await xUlx.connect(account).approve(aceLab.address, transferAmount)
        const log1 = await aceLab.connect(account).deposit(0, transferAmount);
        await Helpers.advanceTimeAndBlock(100000);
        const log2 = await aceLab.massUpdatePools();

        const time1 = await Helpers.timestamp(log1.blockNumber)
        const time2 = await Helpers.timestamp(log2.blockNumber)

        const expected = ((await aceLab.poolInfo(0)).RewardPerSecond).mul(time2 - time1).sub(100)
        expect(transferAmount).equals(await xUlx.balanceOf(aceLab.address))
        expect(expected).equals(await aceLab.connect(account).pendingReward(0, account.address))

        await aceLab.connect(owner).changeUserLimit(transferAmount);
        await xUlx.connect(owner).transfer(account.address, transferAmount);
        await xUlx.connect(account).approve(aceLab.address, transferAmount)
        await expect(aceLab.connect(account).deposit(0, transferAmount)).revertedWith("deposit: user has hit deposit cap");
    }); 

    it("deposit and instant withdraw\n", async () => {
        const dateNow = await Helpers.latest();
        await expect(aceLab.connect(account).add(100, lp.address, dateNow.sub(10), dateNow, owner.address)).revertedWith("Ownable: caller is not the owner");
        await aceLab.connect(owner).add(100, lp.address, dateNow.sub(10), dateNow.add(1000000), owner.address);

        const transferAmount = ethers.utils.parseEther("10");
        await lp.connect(owner).transfer(aceLab.address, transferAmount);
        expect(transferAmount).equals(await lp.balanceOf(aceLab.address))
        await xUlx.connect(owner).transfer(account.address, transferAmount);
        await xUlx.connect(account).approve(aceLab.address, transferAmount)
        const log1 = await aceLab.connect(account).deposit(0, transferAmount);
        expect(transferAmount).equals(await xUlx.balanceOf(aceLab.address))
        const log2 = await aceLab.connect(account).withdraw(0, transferAmount);

        const time1 = await Helpers.timestamp(log1.blockNumber);
        const time2 = await Helpers.timestamp(log2.blockNumber);

        const expected = ((await aceLab.poolInfo(0)).RewardPerSecond).mul(time2 - time1).sub((await aceLab.poolInfo(0)).RewardPerSecond)
        expect(expected).equals(0);
    }); 

    it("deposit and withdraw after waiting\n", async () => {
        const dateNow = await Helpers.latest();
        await expect(aceLab.connect(account).add(100, lp.address, dateNow.sub(10), dateNow, owner.address)).revertedWith("Ownable: caller is not the owner");
        await aceLab.connect(owner).add(100, lp.address, dateNow.sub(10), dateNow.add(1000000), owner.address);

        const transferAmount = ethers.utils.parseEther("10");
        await lp.connect(owner).transfer(aceLab.address, transferAmount);
        expect(transferAmount).equals(await lp.balanceOf(aceLab.address))
        await xUlx.connect(owner).transfer(account.address, transferAmount);
        await xUlx.connect(account).approve(aceLab.address, transferAmount)
        const log1 = await aceLab.connect(account).deposit(0, transferAmount);
        await Helpers.advanceTimeAndBlock(100000);
        const log2 = await aceLab.massUpdatePools();

        const time1 = await Helpers.timestamp(log1.blockNumber)
        const time2 = await Helpers.timestamp(log2.blockNumber)

        const expected = ((await aceLab.poolInfo(0)).RewardPerSecond).mul(time2 - time1).sub(100)
        expect(transferAmount).equals(await xUlx.balanceOf(aceLab.address))
        expect(expected).equals(await aceLab.connect(account).pendingReward(0, account.address))

        const log3 = await aceLab.connect(account).withdraw(0, transferAmount);
        await Helpers.advanceTimeAndBlock(100000);
        const log4 = await aceLab.massUpdatePools();

        const time3 = await Helpers.timestamp(log3.blockNumber)
        const time4 = await Helpers.timestamp(log4.blockNumber)
  
        const expectedWithdraw = ((await aceLab.poolInfo(0)).RewardPerSecond).mul(time4 - time3).sub((await aceLab.poolInfo(0)).RewardPerSecond);
        expect(expectedWithdraw).equals(await lp.balanceOf(account.address));
    }); 

    it("deposit and emergency withdraw\n", async () => {
        const dateNow = await Helpers.latest();
        await expect(aceLab.connect(account).add(100, lp.address, dateNow.sub(10), dateNow, owner.address)).revertedWith("Ownable: caller is not the owner");
        await aceLab.connect(owner).add(100, lp.address, dateNow.sub(10), dateNow.add(1000000), owner.address);

        const transferAmount = ethers.utils.parseEther("10");
        await lp.connect(owner).transfer(aceLab.address, transferAmount);
        expect(transferAmount).equals(await lp.balanceOf(aceLab.address))
        await xUlx.connect(owner).transfer(account.address, transferAmount);
        await xUlx.connect(account).approve(aceLab.address, transferAmount)
        await aceLab.connect(account).deposit(0, transferAmount);
        await aceLab.connect(account).emergencyWithdraw(0);

        expect(transferAmount).equals(await xUlx.balanceOf(account.address));
        expect(0).equals(await lp.balanceOf(account.address));
    });
    
    it("deposit and emergencyRewardWithdraw after waiting\n", async () => {
        const dateNow = await Helpers.latest();
        await expect(aceLab.connect(account).add(100, lp.address, dateNow.sub(10), dateNow, owner.address)).revertedWith("Ownable: caller is not the owner");
        await aceLab.connect(owner).add(100, lp.address, dateNow.sub(10), dateNow.add(1000000), treasuryAccount.address);

        const transferAmount = ethers.utils.parseEther("10");
        await lp.connect(owner).transfer(aceLab.address, transferAmount);
        expect(transferAmount).equals(await lp.balanceOf(aceLab.address))
        await xUlx.connect(owner).transfer(account.address, transferAmount);
        await xUlx.connect(account).approve(aceLab.address, transferAmount)
        const log1 = await aceLab.connect(account).deposit(0, transferAmount);
        await Helpers.advanceTimeAndBlock(100000);
        const log2 = await aceLab.massUpdatePools();

        const time1 = await Helpers.timestamp(log1.blockNumber)
        const time2 = await Helpers.timestamp(log2.blockNumber)

        const expected = ((await aceLab.poolInfo(0)).RewardPerSecond).mul(time2 - time1).sub(100)
        expect(transferAmount).equals(await xUlx.balanceOf(aceLab.address))
        expect(expected).equals(await aceLab.connect(account).pendingReward(0, account.address))

        await aceLab.connect(owner).emergencyRewardWithdraw(0, transferAmount);
        await Helpers.advanceTimeAndBlock(100000);
        await aceLab.massUpdatePools();
  
        expect(transferAmount).equals(await lp.balanceOf(treasuryAccount.address));
    }); 

    // it("two deposits and harvest all\n", async () => {
    //     await masterChef.connect(owner).add(100, lp.address);

    //     const tokenLp = await (await new ERC20Mock__factory(owner).deploy("LP", "LP", ethers.utils.parseEther("100"))).deployed();
    //     await masterChef.connect(owner).add(100, tokenLp.address);

    //     const transferAmount = ethers.utils.parseEther("10");
    //     await lp.connect(owner).transfer(someAccount.address, transferAmount);
    //     await lp.connect(someAccount).approve(masterChef.address, transferAmount)
    //     await tokenLp.connect(owner).transfer(someAccount.address, transferAmount);
    //     await tokenLp.connect(someAccount).approve(masterChef.address, transferAmount)
    //     await masterChef.connect(someAccount).deposit(0, transferAmount);    
    //     const log1 = await masterChef.connect(someAccount).deposit(1, transferAmount);
    //     await helpers.advanceTimeAndBlock(100);
    //     const log2 = await masterChef.connect(someAccount).harvestAll();
        
    //     const time1 = await helpers.timestamp(log1.blockNumber)
    //     const time2 = await helpers.timestamp(log2.blockNumber)
    //     const expected = (await masterChef.wULXPerSecond()).mul(time2 - time1).add((await masterChef.wULXPerSecond()).div(2))
    //     expect(expected).equals(await weth.balanceOf(someAccount.address));
    // }); 

});