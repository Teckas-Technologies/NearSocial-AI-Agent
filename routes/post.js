const express = require('express');
const router = express.Router();
const { format } = require('near-api-js').utils;
const { uploadIPFS } = require('../utils/imageUtils');
const { getAvailableStorage, calculateTextSizeInBytes,StorageCostPerByte, estimateDataSize, calculateNearAmount } = require('../utils/utils');
const Big = require('big.js');

const MinStorageBalance = StorageCostPerByte.mul(2000);
const InitialAccountStorageBalance = StorageCostPerByte.mul(500);
const ExtraStorageBalance = StorageCostPerByte.mul(500);
const StorageForPermission = StorageCostPerByte.mul(500);
const CustomStorage = StorageCostPerByte.mul(500);

router.post("/", async (req, res) => {
    try {
        const body = req.body;
        console.log("body >>", body);

        const { accountId, accountID, content, imageUrl } = body;
        const account = accountId || accountID;
        if (!account || !content) {
            console.log("Missing accountId or content");
            return res.status(400).json({ error: "Missing accountId or content" });
        }

        let imageCid;

        // if (imageUrl) {
        //     imageCid = await uploadIPFS(imageUrl);
        // }

        const postData = {
            main: {}
        };

        // if (imageUrl) postData.main.image = { ipfs_cid: imageCid };
        if (content) {
            postData.main.type = "md";
            postData.main.text = content;
        }

        const data = {
            [account]: {
                post: {
                    main: JSON.stringify(postData.main)
                },
                index: {
                    post: JSON.stringify({
                        key: "main",
                        value: {
                            type: "md"
                        }
                    })
                }
            },
        };

        const storage = await getAvailableStorage(account);
        const availableBytes = Big(storage?.available_bytes || '0');

        let currentData = {};

        const expectedDataBalance = StorageCostPerByte?.mul(
            estimateDataSize(data, currentData)
        )
            .add(storage ? Big(0) : InitialAccountStorageBalance)
            .add(true ? Big(0) : StorageForPermission)
            .add(ExtraStorageBalance)
            .add(CustomStorage);

        const totalSize = (expectedDataBalance?.toFixed() * 100000 / 10 ** 24).toFixed()

        let amount = 0;
        if (totalSize > availableBytes) {
            // Calculate NEAR amount if the total size exceeds the available storage
            const extraSize = totalSize - availableBytes;
            amount = calculateNearAmount(extraSize);
        }
        console.log(`amt:${amount},size:${totalSize},availBytes:${availableBytes},data:${JSON.stringify(data)},`);

        const contractId = "social.near";
        const method = 'set';
        const args = {
            data: data
        };
        const gas = '300000000000000';
        const deposit = format.parseNearAmount(amount.toString());

        const transactionData = [{
            receiverId: contractId,
            actions: [{
                type: 'FunctionCall',
                params: {
                    methodName: method,
                    args: args,
                    gas: gas,
                    deposit: deposit
                }
            }]
        }];

        const transactionsData = encodeURIComponent(JSON.stringify(transactionData));
        const callbackUrl = encodeURIComponent(`https://near.social/mob.near/widget/ProfilePage?accountId=${account}`);

        console.log("Transaction Data: ", transactionData);
        console.log("Callback URL: ", callbackUrl);

        const postUrl = `https://wallet.bitte.ai/sign-transaction?transactions_data=${transactionsData}&callback_url=${callbackUrl}`;
        console.log("Post Url: ", decodeURIComponent(postUrl));
        res.json({ postUrl: postUrl });

    } catch (error) {
        console.error("Error >> ", error);
        return res.status(500).json({ error: 'An error occurred while generating the post URL.' });
    }
});

module.exports = router;