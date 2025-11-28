import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer } = await hre.getNamedAccounts();
  const { deploy } = hre.deployments;

  const deployedDrive = await deploy("ObscuraDrive", {
    from: deployer,
    log: true,
  });

  console.log(`ObscuraDrive contract: `, deployedDrive.address);
};
export default func;
func.id = "deploy_obscura_drive"; // id required to prevent reexecution
func.tags = ["ObscuraDrive"];
