/* 
This javascripts purpose is to send a transaction bundle to the Flashbot validators so that it guarantees the execution of every transaction in the bundle. 
This will help you recover tokens from a hacked address which has an account drainer. 
An account drainer is when you send ETH to an address so you can perform transactions, but a bot automatically transfers that ETH to another address before you have
time to perform your transactions. The Flashbot method allows you to perform all transactions in a single block so it doesnt give time for an account drainer to take your ETH.

The benefits of Flashbots are that they dont cost anything if the transaction reverts. 

WARNING: Use this script at your own risk and I accept no liability for its misuse or any mistakes caused. 
Read all the comments in the code to understand what each step does and what things you need to change. 
The transactions below contain example data and you need to update them with data that is relevant to your situation. 

You are expected to have some javascript coding knowledge to understand this and modify it. The below steps rely on your already having the NPM package manager and NODEJS installed. 
If you dont then you will need to google how to install them for your operating system. 

Step 1. Install the necessary packages. 
npm install @flashbots/ethers-provider-bundle
npm install ethers

Step 2. Update the code below with your private keys for the hacked wallet and a safe wallet

Step 3. Update all the transactions with the necessary data for what you are trying to recover. The below data is an example of how to recover a Hex stake, but
you may want to do something different, so the transactions will need to be updated to correspond to this. 

Step 4. Run the script with 'node FlashbotRecovery.js'

Below is an example successful execution. You may also see that it was not included in a block. If this happens then you can just keep retrying as the service may be busy, 
or you can increase the PRIORITY_FEE.

========= NOTICE =========
Request-Rate Exceeded  (this message will not be repeated)

The default API keys for each service are provided as a highly-throttled,
community resource for low-traffic projects and early prototyping.

While your application will continue to function, we highly recommended
signing up for your own API keys to improve performance, increase your
request rate/limit and enable other perks, such as metrics and advanced APIs.

For more details: https://docs.ethers.io/api-keys/
==========================
0
Congrats, included in 19079235
*/


const { FlashbotsBundleProvider, FlashbotsBundleResolution } = require('@flashbots/ethers-provider-bundle');
const { providers, Wallet, BigNumber, utils } = require('ethers');

async function main() {

    const provider = new providers.getDefaultProvider();

    var hackedWallet = new Wallet("Add your hacked wallet private key here", provider);
    var safeWallet = new Wallet("Add your new safe wallet private key here", provider);

    var bundleSigner = Wallet.createRandom();   // Signer of the bundle, does not send or receive funds. You dont need to care about the wallets address or private key.

    const GWEI = BigNumber.from(10).pow(9);
    const PRIORITY_FEE = GWEI.mul(3);  // Change this value to TIP the Flashbot validator to include your transactions. At the time of writing 3 was usually sufficient.

    const flashbotsProvider = await FlashbotsBundleProvider.create(provider, bundleSigner);
    const targetBlockNumber = (await provider.getBlockNumber()) + 2;
    const block = await provider.getBlock(targetBlockNumber - 2);
    const maxBaseFeeInFutureBlock = FlashbotsBundleProvider.getMaxBaseFeeInFutureBlock(block.baseFeePerGas, 1);

    const hackedWalletNonce = await wallet.getNonce();
  
    // Transaction 1 transfers some funds to your hacked wallet so that it can perform the subsequent transactions. 
    const ethTransferTransaction1 = {
        from: safeWallet.address,   // The address of the safewallet who is sending the funds
        to: hackedWallet.address,
        value: utils.parseEther('0.03'),    // replace with enough eth for endstake and transfer. You can work this out by attempting each transaction in metamask and adding up the total cost. 
        chainId: 1,  // Chain 1 is ethereum. At the time of writing only Ethereum is supported. 
        type: 2,
        maxFeePerGas: PRIORITY_FEE.add(maxBaseFeeInFutureBlock),
        maxPriorityFeePerGas: PRIORITY_FEE,
        gasLimit: 21000  // 21000 is the gasLimit for a simple funds transfer
    }

    // Subsequent transactions are dependant on what it is you want to do. 
    const endStakeTransaction2 = {
        from: hackedWallet.address, // The address of the hacked wallet who owns the hex
        to: "0x2b591e99afE9f32eAA6214f7B7629768c40Eeb39",    // The Hex smart contract address
        data: "0x343009a2000000000000000000000000000000000000000000000000000000000000000400000000000000000000000000000000000000000000000000000000000b4065",  // Transaction Data to end the stake. You can get this from Metamask
        nonce: hackedWalletNonce,
        chainId: 1,
        type: 2,
        maxFeePerGas: PRIORITY_FEE.add(maxBaseFeeInFutureBlock),
        maxPriorityFeePerGas: PRIORITY_FEE,
        gasLimit: 1007053  // Replace with the necessary gas limit for your transaction. You can get this value by attempting the transaction in metamask and checking the gasLimit value. 
    }

    const transferHexTransaction3 = {
        from: hackedWallet.address, // The address of the hacked wallet that holds the unstaked hex
        to: "0x2b591e99afE9f32eAA6214f7B7629768c40Eeb39", 
        data: "0xa9059cbb000000000000000000000000fb6f400c3b9313a720ea642422e5eee907e4cd2b00000000000000000000000000000000000000000000000000000c29576db500", // Hex transfer data for 133717 hex. Replace with your data. You can get this from metamask.
        nonce: hackedWalletNonce + 1,
        chainId: 1,
        type: 2,
        maxFeePerGas: PRIORITY_FEE.add(maxBaseFeeInFutureBlock),
        maxPriorityFeePerGas: PRIORITY_FEE,
        gasLimit: 50000   // Replace with the necessary gas limit for your transaction. You can get this value by attempting the transaction in metamask and checking the gasLimit value.  
    }

    const transactionBundle = [
        {
            signer: safeWallet,
            transaction: ethTransferTransaction1
        },
        {
            signer: hackedWallet,
            transaction: endStakeTransaction2
        },
        {
            signer: hackedWallet,
            transaction: transferHexTransaction3
        }
    ]

    const signedTransactions = await flashbotsProvider.signBundle(transactionBundle);
    const simulation = await flashbotsProvider.simulate(signedTransactions, targetBlockNumber);
    console.log(JSON.stringify(simulation, null, 2));

    if ("error" in simulation) {
        console.log(simulation.error.message);
        return;
    }
  
    console.log("Submitting Transaction");
    const submittedBundle = await flashbotsProvider.sendBundle(transactionBundle, targetBlockNumber);
    console.log(JSON.stringify(submittedBundle));

    if ("error" in submittedBundle) {
        console.log(submittedBundle.error.message);
        return;
      }
  
      const resolution = await submittedBundle.wait();
      console.log(resolution);
      if (resolution === FlashbotsBundleResolution.BundleIncluded) {
        console.log(`Congrats, included in ${targetBlockNumber}`);
        exit(0);
      } else if (
        resolution === FlashbotsBundleResolution.BlockPassedWithoutInclusion
      ) {
        console.log(`Not included in ${targetBlockNumber}`);
      } else if (resolution === FlashbotsBundleResolution.AccountNonceTooHigh) {
        console.log("Nonce too high, bailing");
      }
}

main();
