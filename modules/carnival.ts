import {IProxy, Wallet} from "../utils/wallet";
import {checkIn, getStampStats, getUserData, makeCarnivalAuth} from "./fractal";
import axios, {AxiosError} from "axios";
import {projectConfig} from "../data/project.config";
import {log} from "../utils/logger";
import {sleep} from "../utils/common";


// Функция для генерации случайного code_verifier
function generateCodeVerifier() {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~";
    const length = 56;
    let codeVerifier = "";

    if (typeof crypto !== "undefined" && crypto.getRandomValues) {
        // Генерация случайных символов с использованием WebCrypto API
        const randomValues = new Uint8Array(length);
        crypto.getRandomValues(randomValues);
        for (let i = 0; i < length; i++) {
            codeVerifier += chars[randomValues[i] % chars.length];
        }
    } else {
        // Fallback, если WebCrypto недоступен
        for (let i = 0; i < length; i++) {
            codeVerifier += chars.charAt(Math.floor(Math.random() * chars.length));
        }
    }

    return codeVerifier;
}

// Функция для создания code_challenge из code_verifier
async function generateCodeChallenge(codeVerifier: string) {
    if (typeof crypto !== "undefined" && crypto.subtle) {
        // Кодирование строки в массив байтов
        const encoder = new TextEncoder();
        const data = encoder.encode(codeVerifier);

        // Хэширование с использованием SHA-256
        const hashBuffer = await crypto.subtle.digest("SHA-256", data);

        // Преобразование хэша в base64url
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return btoa(String.fromCharCode.apply(null, hashArray))
            .replace(/\+/g, "-")
            .replace(/\//g, "_")
            .replace(/=+$/, "");
    } else {
        // Если WebCrypto недоступен, вернуть code_verifier как есть
        return codeVerifier;
    }
}


export async function carnivalModule(walletProxyMap: { [wallet: string]: IProxy | boolean }): Promise<void> {
    for (const walletData in walletProxyMap) {
        const wallet = new Wallet({seed: walletData, proxy: walletProxyMap[walletData]});

        const codeVerifier = generateCodeVerifier();
        const codeChallenge = await generateCodeChallenge(codeVerifier);


        await claimStamp(wallet, codeVerifier, codeChallenge)

        // await stampStats(wallet, codeVerifier, codeChallenge);
    }
}

async function getAuthToken(wallet: Wallet, codeChallenge: string, attempts: number = 0) {
    try {
        const uuid: string = crypto.randomUUID();

        const msg = `Welcome to Fractal Christmas Market\n\nWallet address:\n${wallet.address}\n\nNonce:\n${uuid}`
        const sign = wallet.signMessage(msg)

        return await makeCarnivalAuth(wallet.address, codeChallenge, sign, btoa(msg), wallet.proxy)
    } catch (error) {
        if (attempts < projectConfig.retryCount) {
            log("error", `Attempt [${attempts + 1}/${projectConfig.retryCount}] failed: ${(error as Error).message}. Retrying...`);
            return getAuthToken(wallet, codeChallenge, attempts + 1)
        } else {
            log("error", `Failed to claim stamp after [${attempts + 1}/${projectConfig.retryCount}] attempts.`);
        }
    }
}

async function claimStamp(wallet: Wallet, codeVerifier: string, codeChallenge: string, attempts: number = 0) {
    try {

        const auth = await getAuthToken(wallet, codeChallenge)

        if (typeof auth === "string") {
            await sleep([5, 5])

            const status = await getUserData(wallet.address, auth, codeVerifier, wallet.proxy)

            await sleep([5, 5])

            try {
                await checkIn(wallet.address, status.data.access_token, status.data.user.id, wallet.proxy)
            } catch (error) {
                if (axios.isAxiosError(error)) {
                    if (error?.response?.status === 409) {
                        log("info", `Stamp already claimed today! | ${wallet.address}`);
                    } else {
                        throw error;
                    }
                } else {
                    throw error;
                }

            }

            await sleep([5, 5])

            log("info", `Successfully claim stamp! | ${wallet.address}`)
        }

    } catch (error) {
        if (attempts < projectConfig.retryCount) {
            log("error", `Attempt [${attempts + 1}/${projectConfig.retryCount}] failed: ${(error as Error).message}. Retrying...`);
            return claimStamp(wallet, codeVerifier, codeChallenge, attempts + 1)
        } else {
            log("error", `Failed to claim stamp after [${attempts + 1}/${projectConfig.retryCount}] attempts.`);
        }
    }
}


async function stampStats(wallet: Wallet, codeVerifier: string, codeChallenge: string, attempts: number = 0) {
    try {
        let codeAuth
        const uuid: string = crypto.randomUUID();

        const msg = `Welcome to Fractal Christmas Market\n\nWallet address:\n${wallet.address}\n\nNonce:\n${uuid}`
        const sign = wallet.signMessage(msg)

        try {
            const test = await makeCarnivalAuth(wallet.address, codeChallenge, sign, btoa(msg), wallet.proxy)
            console.log(test)
        } catch (error) {
            if (axios.isAxiosError(error)) {
                codeAuth = error.request.path.split('=')[1]
            }

        }

        const status = await getUserData(wallet.address, codeAuth, codeVerifier, wallet.proxy)

        const stats = await getStampStats(wallet.address, codeAuth, status.data.user.id, wallet.proxy)

        console.log(stats)
    } catch (error) {
        if (attempts < projectConfig.retryCount) {
            log("error", `Attempt [${attempts + 1}/${projectConfig.retryCount}] failed: ${(error as Error).message}. Retrying...`);
            return stampStats(wallet, codeVerifier, codeChallenge, attempts + 1)
        } else {
            log("error", `Failed to get stamps count after [${attempts + 1}/${projectConfig.retryCount}] attempts.`);
        }
    }
}

