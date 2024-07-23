import { HardhatUserConfig } from "hardhat/config"
import "@nomicfoundation/hardhat-toolbox"
import '@openzeppelin/hardhat-upgrades';
import "hardhat-deploy"

const config: HardhatUserConfig = {
  solidity: "0.8.26",
  defaultNetwork: "hardhat",
  networks: {
    hardhat: {}
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts"
  }
}

export default config
