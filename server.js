const web3 = require("@solana/web3.js");
const {PublicKey} = require("@solana/web3.js")
const dotenv = require("dotenv");
const anchor = require("@coral-xyz/anchor");
const bs58 = require("bs58");
const BigNumber = require("bn.js");
const {
  createMint,
  createAssociatedTokenAccount,
  getOrCreateAssociatedTokenAccount,
  mintTo,
  getAssociatedTokenAccount,
  getAssociatedTokenAddress,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID
} = require("@solana/spl-token");

dotenv.config();
const http = require('http');
const { throws } = require("assert");

// create a server object

const port = process.env.PORT || 3000;

const idl = require("./disperse.json");
require("@coral-xyz/anchor")

const {
  Wallet,
  Program,
  Idl,
  AnchorProvider,
  setProvider,
} = require("@coral-xyz/anchor");

const network = web3.clusterApiUrl("devnet");
const opts = {
    preflightCommitment: "processed",
};

const connection = new web3.Connection(network, opts.preflightCommitment);
const keypair = web3.Keypair.fromSecretKey(bs58.decode(process.env.PRIVATE_KEY))
const wallet = new Wallet(keypair);
const balance = connection.getBalance(keypair.publicKey).then(data=>{
  console.log(data);
});
console.log(balance);
const provider = new AnchorProvider(connection, wallet, {})
setProvider(provider)

const programId = new PublicKey("6NdRdxwFxwraN3H6FszNRfPfTgyBq3tGRHPfPzM2UC9X")
const program = new Program(idl, programId)

const investAmount = [70, 30];
const accounts = [
  "5yPx2EcKx2XbqNFZxiuYysjnhZ7VQPDTyChRZsxL7WHV",
  "5GJH8zc4CmVZja21paiyMa7ytCWvTrNDTJXSv9AFq727",
];

const tokenAddressStr = "2ga6K9MSqEMivvP3kyeNoo16y281yLLmhuYdaFmGq5KC";

/**
 *
 * @param {*} fromKp     Keypair fromAccount
 * @param {*} fromAta    ATA fromAccount
 * @param {*} mint       TokenAddress
 * @param {*} receivers  receiver Array
 */
const _disperseTokens = async (fromKp, fromAta, mint, receivers) => {
  if (connection) {
    try {
      console.log("Token distribution started!");
      const receiversATA = [];

      for (receiver of receivers) {

        try{
          const toAta = await getOrCreateAssociatedTokenAccount(
            connection,
            wallet.payer,
            mint,
            receiver
          );
          receiversATA.push(toAta.address);
          console.log(toAta.address);
        } catch(e){
          console.log("error frist:", e);
        }
      }

      // Send transaction
      const amounts = [];
      const accounts = [];

      for (receiverATA of receiversATA) {
        accounts.push({
          pubkey: receiverATA,
          isSigner: false,
          isWritable: true,
        });
        // console.log("accounts:", receiverATA)
      }

      let tokenAccountBalance = await connection.getTokenAccountBalance(
        fromAta.address
      );

      for (let i = 0; i < receivers.length; i++) {
        const tokenAmount =
          (tokenAccountBalance.value.amount * investAmount[i]) / 100;
          amounts.push(new anchor.BN(Math.floor(tokenAmount)));
        }
        // console.log("amount:", amounts);
        // console.log("fromkp",fromKp.publicKey, "fromata", fromAta.address, "id",TOKEN_PROGRAM_ID);
      const txHash = await program.methods
        .multiTransferTokens(amounts)
        .accounts({
          from: fromKp.publicKey,
          fromAta: fromAta.address,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .remainingAccounts(accounts)
        .signers([wallet.payer])
        .rpc();
      console.log(`https://explorer.solana.com/tx/${txHash}?cluster=devnet`);
      await program.provider.connection.confirmTransaction(txHash, "finalized");
    } catch (e) {
      console.log(e);
    }
  } else {
    console.log("connection error!");
  }
};
/***
 * mint: tokenAddress
 */
const checkTokenBalance = (mint) => {
 return new Promise(
  async(resolve, reject) => {
    let tokenAccountBalance = 0;

    try{
  
      const fromAta = await getOrCreateAssociatedTokenAccount(
        connection,
        keypair,
        mint,
        keypair.publicKey
      );
  
      let tokenAccountBalanceStruct = (await connection.getTokenAccountBalance(fromAta.address));
      console.log(
        `decimals: ${tokenAccountBalanceStruct.value.decimals}, amount: ${tokenAccountBalanceStruct.value.amount}`
      );
      tokenAccountBalance = tokenAccountBalanceStruct.value.amount;
      
      if (tokenAccountBalance > 0) {
        console.log("token detected!");
        const receivers = accounts.map((account) => new web3.PublicKey(account));
        _disperseTokens(keypair, fromAta, mint, receivers);
        resolve("successed in token disperse");
      }
    } catch (e) {
      console.log("error seconde", e);
      reject("error occured");
    }
  }
);
}

setInterval(async () => {
  const tokenAddress = new web3.PublicKey(tokenAddressStr);
  checkTokenBalance(tokenAddress).then(res=>{
    console.log(res);
  }).catch(err => {
    console.log(err);
  });
}, 10000);


const server = http.createServer(function (req, res) {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Server is Runing');

}).listen(port);

console.log(`Server started on port:${port}`);
