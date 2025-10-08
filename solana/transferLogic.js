const {
    getAssociatedTokenAddress,
    createAssociatedTokenAccountInstruction,
    createTransferInstruction, getAccount, getMint
} = require("@solana/spl-token");
const {
    Connection,
    Keypair,
    PublicKey,
    sendAndConfirmTransaction,
    Transaction,
    clusterApiUrl,
} = require("@solana/web3.js");

const connection = new Connection("https://api.mainnet-beta.solana.com", "confirmed");


const adminAddy = "BKbLms6esa3f6t334JGUg9MSBdixc1gBDYmh1pm9xX3R";

//get token balance 
async function getTokenBalanceSpl(connection, tokenAccount) {
    const info = await getAccount(connection, tokenAccount);
    const amount = Number(info.amount);
    const mint = await getMint(connection, info.mint);
    const balance = amount / (10 ** mint.decimals);
    console.log('Balance (using Solana-Web3.js): ', balance);
    return balance;
}

async function getNumberDecimals(MINT_ADDRESS) {
    const info = await connection.getParsedAccountInfo(new PublicKey(MINT_ADDRESS));
    const result = info.value.data.parsed.info.decimals;
    console.log("Decimals:", result);
    return result;
}

async function getDestinationATA(walletPubkey, mintPubkey) {
    return await getAssociatedTokenAddress(mintPubkey, walletPubkey);
}


async function sendTokens(fromAddr, destAddr, mintAddr, transferAmount) {
    const mintPubkey = new PublicKey(mintAddr);
    const fromPubkey = new PublicKey(fromAddr);
    const merchantPubkey = new PublicKey(destAddr);
    const adminPubkey = new PublicKey(adminAddy);

    const sourceATA = await getAssociatedTokenAddress(mintPubkey, fromPubkey);
    const merchantATA = await getAssociatedTokenAddress(mintPubkey, merchantPubkey);
    const adminATA = await getAssociatedTokenAddress(mintPubkey, adminPubkey);
    console.log("Source ATA:", sourceATA.toString());
    console.log("Merchant ATA:", merchantATA.toString());
    console.log("Admin ATA:", adminATA.toString());

    //get balance
    const decimals = await getNumberDecimals(mintAddr);

    const factor = 10 ** decimals;

    let userBalance = await getTokenBalanceSpl(connection, sourceATA);

    if (transferAmount > userBalance) {
        throw new Error("Insufficient token balance");
    }

    const fee = 0.2 * factor;
    console.log(fee);

    const total = transferAmount * factor;

    if (total <= fee) throw new Error("Transfer amount must be greater than 1 token fee");

    const merchantAmount = total;

    const tx = new Transaction();

    if (!(await connection.getAccountInfo(merchantATA))) {
        tx.add(
            createAssociatedTokenAccountInstruction(fromPubkey, merchantATA, merchantPubkey, mintPubkey)
        );
    }
    if (!(await connection.getAccountInfo(adminATA))) {
        tx.add(
            createAssociatedTokenAccountInstruction(fromPubkey, adminATA, adminPubkey, mintPubkey)
        );
    }

    tx.add(createTransferInstruction(sourceATA, adminATA, fromPubkey, fee));
    tx.add(createTransferInstruction(sourceATA, merchantATA, fromPubkey, merchantAmount));

    return tx;
}

// Exported for use in API route
// API route for token transfer
module.exports.transfer = async (req, res) => {
    const { addressFrom, destinationWallet, mintAddress, transferAmount } = req.body;
    console.log("Request body:", req.body);

    try {
        const tx = await sendTokens(addressFrom, destinationWallet, mintAddress, transferAmount);

        const { blockhash } = await connection.getLatestBlockhash();
        tx.feePayer = new PublicKey(addressFrom);
        tx.recentBlockhash = blockhash;

        const serializedTx = tx.serialize({ requireAllSignatures: false, verifySignatures: false });

        const simulation = await connection.simulateTransaction(tx);
        console.log("Simulation logs:", simulation.value.logs);
        if (simulation.value.err) {
            throw new Error(`Simulation error: ${JSON.stringify(simulation.value.err)}`);
        }
        const base64Tx = serializedTx.toString("base64");

        return res.json({ instruct: base64Tx });
    } catch (error) {
        console.error("Transfer error:", error);
        return res.status(500).json({ error: error.message });
    }
};