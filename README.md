# tangle-payouts

A Simple script that will do a batch call of all of the eras in a range and payout the rewards to the stash account.

## Installation

1. Install Deno from https://deno.land/
2. Clone the repository
3. Set up the environment file

```bash
cp .env.example .env
```

4. Edit the .env file with your SURI, this account does not need to be the validator account, it can be any account that has some TNT to pay 
for the transaction fees.

## Usage

```bash
deno run -A main.ts --help
```

## Example

```bash
deno run -A main.ts tgD9wRg4oaSwzZjFjM32cHM7BM9YgDeKnyDhQMYaCpe2eRmPV --rpc wss://rpc.tangle.tools --from-era 0 --to-era 100
```
