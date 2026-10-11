'use strict';

const FIREBASE_KEY = 'AIzaSyBasXmgMDRPnI5suMIzk2vyFx8MJMjIz9E';
const FIREBASE_SIGNUP = `https://www.googleapis.com/identitytoolkit/v3/relyingparty/signupNewUser?key=${FIREBASE_KEY}`;
const API_BASE = 'https://xty1kppqp0.execute-api.eu-central-1.amazonaws.com/Prod';

const FIREBASE_HEADERS = {
    'Content-Type': 'application/json',
    'X-Android-Package': 'ai.onmusic.app',
    'X-Android-Cert': '21C43B18DB08FBBE59D247923BA5A8B4F6AA3C29',
    'Accept-Language': 'en-US',
    'X-Client-Version': 'Android/Fallback/X23002001/FirebaseCore-Android',
    'X-Firebase-GMPID': '1:162323175591:android:e390852c016caa478be382',
    'X-Firebase-Client': 'H4sIAAAAAAAAAKtWykhNLCpJSk0sKVayio7VUSpLLSrOzM9TslIyUqoFAFyivEQfAAAA',
    'User-Agent': 'Dalvik/2.1.0 (Linux; U; Android 10; Pixel Build/NHG47O)',
    'Accept-Encoding': 'gzip'
};

const FIRST_NAMES = [
    'Arjun', 'Rahul', 'Priya', 'Aarav', 'Ananya', 'Vikram', 'Sneha', 'Rohan',
    'Ishaan', 'Diya', 'Kabir', 'Anaya', 'Aditya', 'Meera', 'Karan', 'Neha',
    'Ravi', 'Pooja', 'Rehan', 'Simran', 'Nikhil', 'Sahil', 'Tanvi', 'Varun',
    'Kavya', 'Mohit', 'Riya', 'Abhishek', 'Sanya', 'Ishita', 'Yash', 'Tanya',
    'Kunal', 'Dev', 'Pranav', 'Vivaan', 'Ira'
];
const LAST_NAMES = [
    'Sharma', 'Verma', 'Kumar', 'Singh', 'Gupta', 'Yadav', 'Patel', 'Mehta',
    'Iyer', 'Nair', 'Rao', 'Bose', 'Das', 'Bhat', 'Desai', 'Shah', 'Pandey',
    'Mishra', 'Arora', 'Kapoor', 'Malhotra', 'Chauhan', 'Pillai', 'Menon',
    'Sahu', 'Rana'
];
const DOMAINS = ['gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com', 'icloud.com', 'zoho.com', 'aol.com'];

const pick = values => values[Math.floor(Math.random() * values.length)];
const randomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

async function fetchWithTimeout(url, options = {}, timeoutMs = 90000) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
        return await fetch(url, { ...options, signal: controller.signal });
    } finally {
        clearTimeout(timer);
    }
}

function makeAccountDetails() {
    const first = pick(FIRST_NAMES).toLowerCase();
    const last = pick(LAST_NAMES).toLowerCase();
    const username = `${first}.${last}${randomInt(10, 999)}`;
    return {
        email: `${username}@${pick(DOMAINS)}`,
        password: `N${randomInt(10000000, 99999999)}m#Ei`
    };
}

async function createAccount() {
    const details = makeAccountDetails();
    const response = await fetchWithTimeout(FIREBASE_SIGNUP, {
        method: 'POST',
        headers: FIREBASE_HEADERS,
        body: JSON.stringify({
            email: details.email,
            password: details.password,
            clientType: 'CLIENT_TYPE_ANDROID'
        }),
    }, 40000);
    const body = await response.json().catch(() => ({}));
    if (!response.ok || !body.idToken) {
        throw new Error(`account signup failed (${response.status})`);
    }
    return { token: body.idToken };
}

function apiHeaders(token) {
    return {
        'user-agent': 'Dart/3.12 (dart:io)',
        'x-brand': 'on-music-ai',
        authorization: `Bearer ${token}`,
        'x-client-platform': 'mobile',
        'accept-encoding': 'identity',
        'Content-Type': 'application/json'
    };
}

async function apiRequest(token, method, path, payload) {
    const response = await fetchWithTimeout(`${API_BASE}${path}`, {
        method,
        headers: apiHeaders(token),
        body: payload === undefined ? undefined : JSON.stringify(payload),
    }, 90000);
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
        throw new Error(`music API ${response.status}: ${body.message || body.error || 'request failed'}`);
    }
    return body;
}

async function submitSong(token, prompt, durationSeconds, vocals) {
    return apiRequest(token, 'POST', '/music/generate', {
        tier: 'pro',
        prompt,
        durationSeconds,
        idempotencyKey: require('crypto').randomUUID(),
        displayContext: {
            vocalsEnabled: vocals,
            activeTab: 'prompt',
            sourcePrompt: prompt
        }
    });
}

async function waitForSong(token, jobId) {
    // The provider normally completes within a few minutes. Keep the command
    // bounded so a stuck provider job cannot leave a WhatsApp command hanging.
    for (let attempt = 0; attempt < 150; attempt += 1) {
        const job = await apiRequest(token, 'GET', `/music/jobs/${encodeURIComponent(jobId)}`);
        const status = String(job.status || '').toUpperCase();
        if (status === 'COMPLETED') return job;
        if (['FAILED', 'ERROR', 'REJECTED', 'CANCELLED', 'FAILURE', 'REFUNDED', 'EXPIRED', 'DELETED'].includes(status)) {
            throw new Error(job.error || job.message || job.failureReason || `job ${status.toLowerCase()}`);
        }
        await sleep(4000);
    }
    throw new Error('generation timed out');
}

function parseRequest(args, quotedText) {
    const input = Array.isArray(args) ? [...args] : [];
    let durationSeconds = 120;
    let vocals = true;
    const promptParts = [];

    for (const arg of input) {
        const value = String(arg);
        if (/^--?(30|60|120)s?$/i.test(value)) {
            durationSeconds = Number(value.replace(/\D/g, ''));
        } else if (/^--?(?:instrumental|novocals?)$/i.test(value)) {
            vocals = false;
        } else {
            promptParts.push(value);
        }
    }

    const prompt = (promptParts.join(' ') || quotedText || '').replace(/\s+/g, ' ').trim();
    return { prompt, durationSeconds, vocals };
}

module.exports = {
    name: 'makemusic',
    alias: ['makesong'],
    desc: 'Generate an AI song and send it as an MP3',
    category: 'Audio',
    usage: '.makemusic <description> [--30|--60|--120] [--instrumental]',

    execute: async (sock, m, { args, reply, quoted }) => {
        const quotedText = quoted?.text || m.quoted?.text || '';
        const { prompt, durationSeconds, vocals } = parseRequest(args, quotedText);

        if (prompt.length < 3) {
            return reply(
                '🎵 Describe the song you want.\n\n' +
                'Example: .makemusic warm afrobeat about friendship --120\n' +
                'Use --instrumental for no vocals, or reply to a message with .makemusic.'
            );
        }
        if (prompt.length > 500) {
            return reply('✘ Song description is too long. Keep it under 500 characters.');
        }

        try {
            await sock.sendPresenceUpdate('composing', m.chat);
            await reply(`🎼 Creating your ${durationSeconds}-second song...\n_${prompt}_`);

            let lastError;
            // Rotate temporary provider accounts on failed submissions/jobs.
            for (let attempt = 1; attempt <= 3; attempt += 1) {
                try {
                    const account = await createAccount();
                    const submitted = await submitSong(account.token, prompt, durationSeconds, vocals);
                    const jobId = submitted.jobId || submitted.id;
                    if (!jobId) throw new Error('music API did not return a job ID');

                    const result = await waitForSong(account.token, jobId);
                    const audioUrl = result.audioUrl || result.audioURL || result.url;
                    if (!audioUrl) throw new Error('completed song did not include an audio URL');

                    const audioResponse = await fetchWithTimeout(audioUrl, {}, 120000);
                    if (!audioResponse.ok) throw new Error(`audio download failed (${audioResponse.status})`);
                    const audio = Buffer.from(await audioResponse.arrayBuffer());
                    if (audio.length < 1000) throw new Error('downloaded audio was empty');

                    const title = String(result.title || 'CODY AI Song').slice(0, 80);
                    await sock.sendMessage(m.chat, {
                        audio,
                        mimetype: 'audio/mpeg',
                        fileName: `${title.replace(/[^\w\s-]/g, '').trim() || 'cody-song'}.mp3`,
                        ptt: false
                    }, { quoted: m });
                    return;
                } catch (error) {
                    lastError = error;
                    console.warn(`[MAKEMUSIC] attempt ${attempt}/3 failed:`, error.message);
                    if (attempt < 3) await sleep(1500);
                }
            }
            throw lastError || new Error('generation failed');
        } catch (error) {
            console.error('[MAKEMUSIC ERROR]', error);
            return reply(`✘ Could not generate the song: ${error.message || 'provider error'}`);
        }
    }
};
