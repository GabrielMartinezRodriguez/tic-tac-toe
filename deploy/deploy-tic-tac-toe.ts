import { ethers, upgrades } from "hardhat";

export default async function deployTicTacToe() {
  const TicTacToeFactory = await ethers.getContractFactory("TicTacToe");

  const ticTacToeProxy = await upgrades.deployProxy(TicTacToeFactory, {
    kind: "transparent"
  });

  await ticTacToeProxy.waitForDeployment();

  const proxyAddress = await ticTacToeProxy.getAddress();
  console.log("Proxy deployed to:", proxyAddress);

  const implementationAddress = await upgrades.erc1967.getImplementationAddress(proxyAddress);

  console.log("Implementation deployed to:", implementationAddress);
}
