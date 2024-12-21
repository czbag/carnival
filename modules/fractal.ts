import {getProxy, sleep} from "../utils/common";
import axios from "axios";
import {log} from "../utils/logger";
import {IProxy} from "../utils/wallet";
import {CookieJar} from "tough-cookie";
import fetchCookie from "fetch-cookie";
import {projectConfig} from "../data/project.config";


export async function makeCarnivalAuth(
    address: string,
    challenge: string,
    sign: string,
    message: string,
    proxies: IProxy | boolean,
    attempts: number = 0
) {
    log("info", `Try authorize wallet on Carnival | ${address}`);

    const jar = new CookieJar();

    // Оборачиваем node-fetch в fetchCookie, чтобы автоматически управлять куками
    // (парсить Set-Cookie и вставлять их в CookieJar, а также отправлять Cookie при запросах)
    const fetchWithCookies = fetchCookie(fetch, jar);

    // Устанавливаем нужную куку (cf_clearance) до запроса,
    // чтобы она уже была в CookieJar
    await jar.setCookie(
        projectConfig.cookie,
        "https://carnival.fractalbitcoin.io" // указываем URL (или домен) для записи куки
    );

    // Формируем URL с нужными query-параметрами
    const url =
        "https://arqpxbuvataljinkotnj.supabase.co/auth/v1/authorize"
        + "?provider=keycloak"
        + "&redirect_to=https://carnival.fractalbitcoin.io/auth/callback"
        + `&code_challenge=${challenge}`
        + "&code_challenge_method=s256"
        + `&message_b64=${message}`
        + `&signature=${sign}`
        + `&address=${address}`;

    // Формируем опции для fetch
    // node-fetch позволяет передать кастомный агент (например, для прокси)
    // в опцию `agent`.
    const requestOptions = {
        method: 'GET',
        headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                + "AppleWebKit/537.36 (KHTML, like Gecko) "
                + "Chrome/131.0.0.0 Safari/537.36"
        },
        // Если getProxy(...) вернёт что-то отличное от undefined, node-fetch
        // будет отправлять запрос через этот агент (HTTP, HTTPS, SOCKS и т.д.)
        agent: getProxy(proxies),
    };

    // Выполняем запрос
    const response = await fetchWithCookies(url, requestOptions);

    // Проверяем статус
    if (!response.ok) {
        throw new Error(`Request failed with status ${response.status} - ${response.statusText}`);
    }

    const cookies = await jar.getCookies("https://carnival.fractalbitcoin.io")

    const supabaseCookie = cookies.find(cookie => cookie.key === "supabase-auth-code");

    if (supabaseCookie) {
        return supabaseCookie.value;
    } else {
        throw new Error(`Failed get auth data`);
    }
}


export async function getUserData(address: string, auth: string, verifier: string, proxy: IProxy | boolean, attempts: number = 0) {
    log("info", `Try get user data on Carnival | ${address}`)

    const axiosConfig: any = {
        httpsAgent: getProxy(proxy),
        httpAgent: getProxy(proxy),
        headers: {
            "Cookie": projectConfig.cookie,
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
            "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFycXB4YnV2YXRhbGppbmtvdG5qIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzM1NDY3ODAsImV4cCI6MjA0OTEyMjc4MH0.XBTbi1vAlaHNTHjQN_0YvKBz3SmQMApWyJ0PHXq1yYc",
            "apikey": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFycXB4YnV2YXRhbGppbmtvdG5qIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzM1NDY3ODAsImV4cCI6MjA0OTEyMjc4MH0.XBTbi1vAlaHNTHjQN_0YvKBz3SmQMApWyJ0PHXq1yYc",
        }
    };

    return await axios.post(
        `https://arqpxbuvataljinkotnj.supabase.co/auth/v1/token?grant_type=pkce`,
        {
            "auth_code": auth,
            "code_verifier": verifier
        },
        axiosConfig
    )
}


export async function checkIn(address: string, auth: string, userId: string, proxy: IProxy | boolean, attempts: number = 0) {
    log("info", `Try check in on Carnival | ${address}`)

    const now = new Date();
    const isoDate = now.toISOString();
    const formattedDate = now.toISOString().slice(0, 10);

    const axiosConfig: any = {
        httpsAgent: getProxy(proxy),
        httpAgent: getProxy(proxy),
        headers: {
            "Cookie": projectConfig.cookie,
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
            "Authorization": `Bearer ${auth}`,
            "apikey": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFycXB4YnV2YXRhbGppbmtvdG5qIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzM1NDY3ODAsImV4cCI6MjA0OTEyMjc4MH0.XBTbi1vAlaHNTHjQN_0YvKBz3SmQMApWyJ0PHXq1yYc",
        }
    };

    return await axios.post(
        `https://arqpxbuvataljinkotnj.supabase.co/rest/v1/daily_check_ins`,
        {
            "user_id": userId,
            "wallet_address": address,
            "check_in_date": formattedDate,
            "check_in_time": isoDate
        },
        axiosConfig
    )
}


export async function getStampStats(address: string, auth: string, userId: string, proxy: IProxy | boolean, attempts: number = 0) {
    log("info", `Check qunatity stamps on Carnival | ${address}`)

    const axiosConfig: any = {
        httpsAgent: getProxy(proxy),
        httpAgent: getProxy(proxy),
        headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
            "Authorization": `Bearer ${auth}`,
            "apikey": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFycXB4YnV2YXRhbGppbmtvdG5qIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzM1NDY3ODAsImV4cCI6MjA0OTEyMjc4MH0.XBTbi1vAlaHNTHjQN_0YvKBz3SmQMApWyJ0PHXq1yYc",
        }
    };

    return await axios.get(
        `https://arqpxbuvataljinkotnj.supabase.co/rest/v1/daily_check_ins?select=*&user_id=eq.${userId}`,
        axiosConfig
    )
}