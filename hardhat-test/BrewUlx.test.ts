import {ethers} from "hardhat";
import { BrewULX, BrewULX__factory, ERC20Mock, ERC20Mock__factory, NewWETH, NewWETH__factory, Swapper, Swapper__factory, ULXMirrorWorld, ULXMirrorWorld__factory, UniswapDAO, UniswapDAO__factory, UniswapV2Factory, UniswapV2Factory__factory, UniswapV2Router02, UniswapV2Router02__factory } from "../typechain-types";
import {expect} from "chai";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

describe("BrewULX tests", () => {
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
    let xUlx: ULXMirrorWorld;
    let brewUlx: BrewULX;

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

        xUlx = await (await new ULXMirrorWorld__factory(owner).deploy(weth.address));

        await owner.sendTransaction({
            to: weth.address,
            value: ethers.utils.parseEther("100"),
        });

        brewUlx = await (await new BrewULX__factory(owner).deploy(factory.address, xUlx.address, weth.address, token0.address, weth.address));
    });

    it("setBridgeRoute", async () => {
        await expect(brewUlx.connect(owner).setBridgeRoute(2, token1.address)).revertedWith("first 3 bridge tokens are immutable")
        await expect(brewUlx.connect(owner).setBridgeRoute(4, token1.address)).revertedWith("index too large, use next free slot")
        await brewUlx.connect(owner).setBridgeRoute(3, token1.address)
        expect(await brewUlx.connect(owner).bridgeRoute(3)).equals(token1.address);
    });

    it("addAuth", async () => {
        await expect(brewUlx.connect(account).addAuth(account.address)).to.be.reverted;
        await brewUlx.connect(owner).addAuth(account.address);
        expect(await brewUlx.connect(owner).isAuth(account.address)).equals(true);
    });

    it("revokeAuth", async () => {
        await expect(brewUlx.connect(account).addAuth(account.address)).to.be.reverted;
        await brewUlx.connect(owner).addAuth(account.address);
        expect(await brewUlx.connect(owner).isAuth(account.address)).equals(true);
        await expect(brewUlx.connect(account).revokeAuth(account.address)).to.be.reverted;
        await brewUlx.connect(owner).revokeAuth(account.address);
        expect(await brewUlx.connect(owner).isAuth(account.address)).equals(false);
    });

    it("overrideSlippage", async () => {
        await expect(brewUlx.connect(account).overrideSlippage(token0.address)).to.be.reverted;
        await brewUlx.connect(owner).overrideSlippage(token0.address);
    });

    it("setSlippage", async () => {
        await expect(brewUlx.connect(account).setSlippage(10)).to.be.reverted;
        await brewUlx.connect(owner).setSlippage(10);
    });

    it("setBridge", async () => {
        await expect(brewUlx.connect(account).setBridge(weth.address, token1.address)).to.be.reverted;
        await expect(brewUlx.connect(owner).setBridge(token1.address, token1.address)).to.be.reverted;
        await brewUlx.connect(owner).setBridge(token0.address, token1.address);
        expect(await brewUlx.connect(owner).lastRoute(token0.address)).equals(token1.address);
    });

    it("convertMultiple", async () => {
        await expect(brewUlx.connect(weth.address).convertMultiple([xUlx.address], [weth.address], [])).to.be.reverted;
        await expect(brewUlx.connect(owner).convertMultiple([xUlx.address], [weth.address], [])).revertedWith('BrewUlx: Invalid pair');

        const amountADesired = ethers.utils.parseUnits("25", 18);
        const amountBDesired = ethers.utils.parseUnits("25", 18);
        
        const amountAMin = ethers.utils.parseUnits("20", 18);
        const amountBMin = ethers.utils.parseUnits("20", 18);

        await weth.connect(owner).approve(xUlx.address, amountADesired);
        await xUlx.connect(owner).enter(amountADesired);

        await xUlx.connect(owner).approve(router.address, amountADesired);
        await token0.connect(owner).approve(router.address, amountBDesired);
        await router.connect(owner).addLiquidity(xUlx.address, token0.address, amountADesired, amountBDesired, amountAMin, amountBMin, owner.address, Date.now() + 20, { gasLimit: 3045000 });

        await token0.connect(owner).approve(router.address, amountADesired);
        await router.connect(owner).addLiquidityETH(token0.address, amountADesired, amountAMin, amountBMin, owner.address, Date.now() + 20, { gasLimit: 3045000, value: amountAMin });

        const pairAddress0 = await factory.connect(owner).getPair(xUlx.address, token0.address);
        const pair0 = await ethers.getContractAt("UniswapV2Pair", pairAddress0, owner);
        const pairBalance0 = await pair0.connect(owner).balanceOf(owner.address);

        const pairAddress1 = await factory.connect(owner).getPair(token0.address, weth.address);
        const pair1 = await ethers.getContractAt("UniswapV2Pair", pairAddress1, owner);
        const pairBalance1 = await pair1.connect(owner).balanceOf(owner.address);

        await expect(brewUlx.connect(owner).convertMultiple([pair0.address], [pair1.address], [])).revertedWith('no LP allowed');
        await expect(brewUlx.connect(owner).convertMultiple([xUlx.address], [weth.address], [ethers.utils.parseEther("0.005")])).revertedWith('BrewUlx: Invalid pair');
        
        await pair0.connect(owner).approve(brewUlx.address, pairBalance0);
        await pair1.connect(owner).approve(brewUlx.address, pairBalance1);
        await pair0.connect(owner).transfer(brewUlx.address, pairBalance0);
        await pair1.connect(owner).transfer(brewUlx.address, pairBalance1);

        expect(await token0.balanceOf(owner.address)).equals(ethers.utils.parseEther('999950'))
        expect(await xUlx.balanceOf(owner.address)).equals(0)
        expect(await weth.balanceOf(owner.address)).equals(ethers.utils.parseEther('75'))

        await brewUlx.connect(owner).convertMultiple([xUlx.address], [token0.address], [ethers.utils.parseEther("0.005")]);
        expect(await token0.balanceOf(owner.address)).equals(ethers.utils.parseEther('999950'))
        expect(await xUlx.balanceOf(owner.address)).equals(0)
        expect(await weth.balanceOf(owner.address)).equals(ethers.utils.parseEther('75.000007960072189270'))

        await brewUlx.connect(owner).convertMultiple([token0.address], [weth.address], [ethers.utils.parseEther("0.005")]);
        expect(await token0.balanceOf(owner.address)).equals(ethers.utils.parseEther('999950'))
        expect(await xUlx.balanceOf(owner.address)).equals(0)
        expect(await weth.balanceOf(owner.address)).equals(ethers.utils.parseEther('75.000016886379564631'))

        await brewUlx.connect(owner).convertMultiple([xUlx.address, token0.address], [token0.address, weth.address], [ethers.utils.parseEther("0.005"), ethers.utils.parseEther("0.005")]);
        expect(await token0.balanceOf(owner.address)).equals(ethers.utils.parseEther('999950'))
        expect(await xUlx.balanceOf(owner.address)).equals(0)
        expect(await weth.balanceOf(owner.address)).equals(ethers.utils.parseEther('75.000033755748272295'))

    });

});