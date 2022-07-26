import {ethers} from "hardhat";
import { ERC20Mock, ERC20Mock__factory, NewWETH, NewWETH__factory, Swapper, Swapper__factory, UniswapDAO, UniswapDAO__factory, UniswapV2Factory, UniswapV2Factory__factory, UniswapV2Router02, UniswapV2Router02__factory } from "../typechain-types";
import {expect} from "chai";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

describe("Swapper tests", () => {
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

    let token0: ERC20Mock;
    let token1: ERC20Mock;

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
    });

    it("Set Slippage", async () => {
        await expect(swapper.connect(owner).setSlippage(21)).revertedWith("slippage setting too high");
        await swapper.connect(owner).setSlippage(19);
        expect(await swapper.connect(owner).slippage()).equals(19);
    });

    it("Override slippage", async () => {
        await swapper.connect(owner).overrideSlippage(token0.address);
        expect(await swapper.slippageOverrode(token0.address)).equals(true);
    });

    it("Swap", async () => {
        const amountIn = ethers.utils.parseEther("10");
        await expect(swapper.swap(token0.address, zeroAddress, amountIn)).revertedWith("BrewUlx: Cannot convert");
        
        const amountADesired = ethers.utils.parseUnits("25", 18);
        const amountBDesired = ethers.utils.parseUnits("25", 18);
        
        const amountAMin = ethers.utils.parseUnits("20", 18);
        const amountBMin = ethers.utils.parseUnits("20", 18);

        await token0.connect(owner).approve(router.address, amountADesired);
        await token1.connect(owner).approve(router.address, amountBDesired);
        await router.connect(owner).addLiquidity(token0.address, token1.address, amountADesired, amountBDesired, amountAMin, amountBMin, owner.address, Date.now() + 20, { gasLimit: 3045000 });
            
        const pairAddress = await factory.connect(owner).getPair(token0.address, token1.address);
        const pair = await ethers.getContractAt("UniswapV2Pair", pairAddress, owner);

        await token0.connect(owner).approve(swapper.address, amountIn);
        await token0.connect(owner).approve(pair.address, amountIn);
        await expect(swapper.connect(owner).swap(token0.address, pair.address, amountIn)).revertedWith("slippage too high");
        
        await swapper.connect(owner).overrideSlippage(token0.address);
        await token0.connect(owner).transfer(account.address, amountIn);
        expect(await token0.balanceOf(account.address)).equals(amountIn);

        await token0.connect(account).approve(swapper.address, amountIn);
        await token0.connect(account).approve(pair.address, amountIn);
        await swapper.connect(account).swap(token0.address, pair.address, amountIn);

        expect(await token1.balanceOf(account.address)).equals(ethers.BigNumber.from('7127537889619674006'));
    });

});