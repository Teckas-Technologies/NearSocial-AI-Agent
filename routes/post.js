const express = require('express');
const router = express.Router();
const { format } = require('near-api-js').utils;
const { uploadIPFS } = require('../utils/imageUtils');
const { getAvailableStorage, calculateTextSizeInBytes, calculateNearAmount } = require('../utils/utils');

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

        // const mainValueSize = calculateTextSizeInBytes(data[accountId].post.main);
        // const indexPostValueSize = calculateTextSizeInBytes(data[accountId].index.post);
        const contentSize = calculateTextSizeInBytes(content);
        const imageSize = calculateTextSizeInBytes(imageCid);
        const accountSize = calculateTextSizeInBytes(account);

        const totalSize = contentSize + imageSize + accountSize;

        const availableStorage = await getAvailableStorage(account);
        const availableBytes = availableStorage?.available_bytes || 0;
        let amount = 0;
        if (totalSize > availableBytes) {
            // Calculate NEAR amount if the total size exceeds the available storage
            const extraSize = totalSize - availableBytes;
            amount = calculateNearAmount(extraSize);
        }

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
        console.log("Transactions Data Encoded: ", transactionsData);
        console.log("Callback URL: ", callbackUrl);

        const postUrl = `https://wallet.bitte.ai/sign-transaction?transactions_data=${transactionsData}&callback_url=${callbackUrl}`;
        res.json({ postUrl: postUrl });

    } catch (error) {
        console.error("Error >> ", error);
        return res.status(500).json({ error: 'An error occurred while generating the post URL.' });
    }
});

module.exports = router;