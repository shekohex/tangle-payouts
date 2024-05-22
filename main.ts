import { ArgumentValue, Command, Type, ValidationError } from "@cliffy/command";
import { ApiPromise, WsProvider } from "@polkadot/api";
import { decodeAddress, Keyring } from "@polkadot/keyring";
import { formatBalance } from "@polkadot/util";

class AccountType extends Type<string> {
  complete(): Array<string> {
    return ["tgD9wRg4oaSwzZjFjM32cHM7BM9YgDeKnyDhQMYaCpe2eRmPV"];
  }

  parse(type: ArgumentValue): string {
    try {
      return decodeAddress(type.value);
    } catch (error) {
      throw new ValidationError(error.message);
    }
  }
}

function formatTNT(value: string): string {
  return formatBalance(value, {
    decimals: 18,
    withUnit: true,
    forceUnit: "TNT",
    withSi: true,
  });
}

// parse the command line arguments
await new Command()
  .name("tangle-payouts")
  .version("0.1.0")
  .description("Simple CLI to payouts on tangle network")
  .type("account", new AccountType())
  .option("--rpc <rpc:string>", "RPC Url (must support dryRuns).")
  .option("-f, --from-era <era:number>", "From which era.", {
    default: 0,
  })
  .option("-t, --to-era <era:number>", "To which era.", {
    default: -1,
  })
  .arguments("<stash:account>")
  .action(async (options, ...args) => {
    let { fromEra, toEra, rpc } = options;
    const provider = new WsProvider(rpc);
    const api = await ApiPromise.create({ provider, noInitWarn: true });
    console.log(`connecting to ${rpc}`);
    await api.isReady;
    console.log(`API connected to ${rpc}`);
    // READ the signer SURI from the environment
    const signer = Deno.env.get("SIGNER_KEY");
    if (!signer) {
      throw new ValidationError("SIGNER_KEY environment variable is not set.");
    }
    const [stash] = args;
    const keyring = new Keyring({ type: "sr25519" });
    const signerPair = keyring.addFromUri(signer);
    const signerAddress = signerPair.address;
    console.log(`Signer address: ${signerAddress}`);
    // Check if the signer has enough balance
    const { data: balance } = await api.query.system.account(signerAddress);
    console.log(
      `Signer balance: ${formatTNT(balance.free)}`,
    );
    if (balance.free.eq(0)) {
      throw new ValidationError("Signer has no balance.");
    }
    if (fromEra < 0) {
      fromEra = await api.query.staking.currentEra();
    }
    if (toEra < 0) {
      toEra = await api.query.staking.currentEra();
    }
    console.log(`Payouts from era ${fromEra} to era ${toEra}`);
    const erasToPayout = [];
    // loop through the eras and make payouts as dry-run
    for (let era = fromEra; era <= toEra; era++) {
      const tx = api.tx.staking.payoutStakers(stash, era);
      const dryRunResult = await tx.dryRun(signerPair);
      if (dryRunResult.isErr) {
        console.error(`Error in era ${era}: ${dryRunResult.error.toHuman()}`);
        continue;
      }
      const innerResult = dryRunResult.asOk;
      if (innerResult.isErr) {
        console.error(`Error in era ${era}:`, innerResult.asErr.toHuman());
        continue;
      }
      erasToPayout.push(era);
    }

    if (erasToPayout.length === 0) {
      console.log("No eras to payout.");
      return;
    }
    console.log(`Eras to payout: ${erasToPayout.join(", ")}`);
    // Create a batch transaction to payout all the eras
    const txs = erasToPayout.map((era) =>
      api.tx.staking.payoutStakers(stash, era)
    );
    console.log(`Total transactions: ${txs.length}`);
    // split the txs into 20 txs per batch
    const batches = [];
    while (txs.length > 0) {
      batches.push(txs.splice(0, 20));
    }
    console.log(`Total batches: ${batches.length}`);
    for (const batch of batches) {
      const batchTx = api.tx.utility.batch(batch);
      console.log("Submitting batch transaction to payout eras...");
      await new Promise((resolve, reject) => {
        batchTx.signAndSend(signerPair, ({ status }) => {
          if (status.isInBlock) {
            console.log(
              `Transaction included at block hash ${status.asInBlock}`,
            );
          } else if (status.isFinalized) {
            console.log(
              `Transaction finalized at block hash ${status.asFinalized}`,
            );
            resolve(0);
          } else if (status.isDropped) {
            console.log(`Transaction dropped.`);
          } else if (status.isInvalid) {
            console.log(`Transaction invalid.`);
            reject(status.asInvalid);
          } else if (status.isBroadcast) {
            console.log(`Transaction broadcasted.`);
          }
        });
      });
    }
    await api.disconnect();
    Deno.exit(0);
  })
  .parse(Deno.args);
