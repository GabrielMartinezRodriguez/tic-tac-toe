import { ethers } from "hardhat"

export default async function deployTicTacToe() {
  const ticTacToeFactory = await ethers.getContractFactory("TicTacToe")
  const contract = await ticTacToeFactory.deploy()

  await contract.waitForDeployment()

  console.log(`TicTacToe deployed to: ${await contract.getAddress()}`)
}
