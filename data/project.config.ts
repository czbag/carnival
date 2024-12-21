export const projectConfig = {
    useProxy: false,
    retryCount: 20,
    sleep: [1, 1],
    batchCount: 20, // Number of wallets in batch, example: 10 wallets, 3 batchCount = [5, 10, 1], [4, 3, 6], [7, 2, 9], [8]
    batchSleep: [30, 60], // Sleep before start new batch
    cookie: "cf_clearance=FARWogChZkPPG9wfxDTWVUNWmPOG7xBpsesnUM2DwUU..."
}
