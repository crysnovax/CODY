const a0_0x55c1c2=a0_0x108e;(function(_0x4e0c3e,_0x20d3b3){const _0xe5227d=a0_0x108e,_0x88df41=_0x4e0c3e();while(!![]){try{const _0x2a340d=-parseInt(_0xe5227d(0x227))/0x1+-parseInt(_0xe5227d(0x1bf))/0x2+parseInt(_0xe5227d(0x229))/0x3*(parseInt(_0xe5227d(0x1b2))/0x4)+parseInt(_0xe5227d(0x21c))/0x5*(parseInt(_0xe5227d(0x22f))/0x6)+-parseInt(_0xe5227d(0x197))/0x7*(-parseInt(_0xe5227d(0x1f6))/0x8)+-parseInt(_0xe5227d(0x213))/0x9*(parseInt(_0xe5227d(0x1c5))/0xa)+parseInt(_0xe5227d(0x1a2))/0xb;if(_0x2a340d===_0x20d3b3)break;else _0x88df41['push'](_0x88df41['shift']());}catch(_0x2ef26b){_0x88df41['push'](_0x88df41['shift']());}}}(a0_0x1c19,0x19b35));const fs=require('fs'),path=require(a0_0x55c1c2(0x1ca)),crypto=require(a0_0x55c1c2(0x19a)),FormData=require('form-data'),fetch=require(a0_0x55c1c2(0x220)),{promisify}=require(a0_0x55c1c2(0x1b9)),exec=promisify(require('child_process')[a0_0x55c1c2(0x1fc)]),playdl=require(a0_0x55c1c2(0x1ff)),yts=require(a0_0x55c1c2(0x20d)),axios=require('axios'),{ACR_CLOUD}=require('../Core/•.js'),activeShazamSessions=new Map(),FALLBACK_APIS=_0x427e05=>['https://apiskeith.top/download/audio?url='+encodeURIComponent(_0x427e05),'https://api.siputzx.my.id/api/d/ytmp3?url='+encodeURIComponent(_0x427e05),'https://api.davidcyriltech.my.id/download/ytmp3?url='+encodeURIComponent(_0x427e05),a0_0x55c1c2(0x1bb)+encodeURIComponent(_0x427e05)],FALLBACK_VIDEO_APIS=_0x19b6fd=>['https://apiskeith.top/download/video?url='+encodeURIComponent(_0x19b6fd),a0_0x55c1c2(0x1dd)+encodeURIComponent(_0x19b6fd),a0_0x55c1c2(0x1e6)+encodeURIComponent(_0x19b6fd)];// ── RapidAPI key-rotation downloader (youtube-mp36) — FIX08-07-26 ──────────
// Shazam identification works, but the old download path produced no audio.
// This is the exact working method: 3 keys, round-robin, auto-retry, and the
// audio is fetched directly from the API link with browser headers.
const RAPID_API_KEYS = [
    '26326ad4e2msha67982d35518d98p1f16aejsn2758906787c6',
    'f33faab7b9msh7debbd81b2366c6p10e535jsn94995ebe4cbe',
    'bebbe34903msh5b866dbc4eeee83p1015f4jsnfa9f6d69aca9'
];
const RAPID_API_HOST = 'youtube-mp36.p.rapidapi.com';
const SONG_COUNTER_FILE = path.join(__dirname, '../../song_counter.json');

function getCounter() {
    try {
        if (fs.existsSync(SONG_COUNTER_FILE)) {
            const data = JSON.parse(fs.readFileSync(SONG_COUNTER_FILE, 'utf8'));
            return data.index || 0;
        }
    } catch {}
    return 0;
}

function saveCounter(index) {
    try {
        fs.writeFileSync(SONG_COUNTER_FILE, JSON.stringify({ index: index }, null, 2));
    } catch {}
}

function getCurrentApiKey() {
    const counter = getCounter();
    const apiKey = RAPID_API_KEYS[counter % RAPID_API_KEYS.length];
    return { apiKey, counter };
}

function nextKey() {
    const counter = getCounter();
    const nextIndex = counter + 1;
    saveCounter(nextIndex);
    return RAPID_API_KEYS[nextIndex % RAPID_API_KEYS.length];
}

async function getRapidAudioBuffer(videoId, retryCount = 0) {
    const { apiKey, counter } = getCurrentApiKey();
    const keyNumber = (counter % RAPID_API_KEYS.length) + 1;

    console.log(`[SHAZAM] Using key ${keyNumber}/${RAPID_API_KEYS.length}`);

    try {
        const dlRes = await axios.get('https://youtube-mp36.p.rapidapi.com/dl', {
            params: { id: videoId },
            headers: {
                'x-rapidapi-key': apiKey,
                'x-rapidapi-host': RAPID_API_HOST
            },
            timeout: 30000
        });

        const data = dlRes.data;

        if (data?.status === 'processing') {
            await new Promise(r => setTimeout(r, 3000));
            return await getRapidAudioBuffer(videoId, retryCount);
        }

        if (data?.status !== 'ok' || !data?.link) {
            throw new Error('Download failed');
        }

        const audioRes = await axios.get(data.link, {
            responseType: 'arraybuffer',
            timeout: 60000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
                'Referer': 'https://youtube-mp36.p.rapidapi.com/'
            }
        });

        nextKey();
        return { buffer: Buffer.from(audioRes.data), title: data.title };

    } catch (error) {
        if (retryCount < RAPID_API_KEYS.length) {
            console.log(`[SHAZAM] Key ${keyNumber} failed, trying next...`);
            nextKey();
            return await getRapidAudioBuffer(videoId, retryCount + 1);
        }
        throw error;
    }
}

async function downloadAudio(_0xe2925b){
    // 1) RapidAPI youtube-mp36 (working method) — FIX08-07-26
    try {
        const _0vid = String(_0xe2925b || '').match(/[?&]v=([\w-]{6,})/)?.[1] || String(_0xe2925b || '').split('/').pop();
        if (_0vid && _0vid.length >= 6) {
            const _0rapid = await getRapidAudioBuffer(_0vid);
            if (_0rapid && _0rapid.buffer && _0rapid.buffer.length > 1000) {
                console.log('[SHAZAM] rapidapi audio OK');
                return _0rapid.buffer;
            }
        }
    } catch (_0e) {
        console.log('[SHAZAM] rapidapi failed:', _0e.message);
    }

    // 2) play-dl
    try {
        const _0stream = await playdl.stream(_0xe2925b, { quality: 2 });
        if (!_0stream?.stream) throw new Error('Empty stream');
        const _0chunks = [];
        for await (const _0c of _0stream.stream) _0chunks.push(_0c);
        if (_0chunks.length) {
            console.log('[SHAZAM] play-dl audio OK');
            return Buffer.concat(_0chunks);
        }
    } catch (_0e) {
        console.log('[SHAZAM] play-dl failed:', _0e.message);
    }

    // 3) fallback APIs
    for (const _0api of FALLBACK_APIS(_0xe2925b)) {
        try {
            const { data } = await axios.get(_0api, { timeout: 20000, headers: { 'User-Agent': 'Mozilla/5.0' } });
            const _0dl = data?.result?.downloadUrl || data?.result?.url || data?.result || data?.download || data?.url || data?.link;
            if (!_0dl) continue;
            const _0buf = await axios.get(_0dl, { responseType: 'arraybuffer', timeout: 60000, headers: { 'User-Agent': 'Mozilla/5.0' } });
            console.log('[SHAZAM] fallback audio OK:', _0api);
            return Buffer.from(_0buf.data);
        } catch (_0e) {
            console.log('[SHAZAM] fallback failed:', _0e.message);
        }
    }
    return null;
}function a0_0x1c19(){const _0x56006a=['audio/mpeg','10xwpicu','│\x20⚉\x20Reply\x20to\x20a\x20voice\x20note,\x20audio\x20file,\x0a','\x22\x20-y','contextInfo','timestamp','path','toLowerCase','from','ytUrl','createHmac','external_metadata','cover','status','│\x20✘\x20*No\x20match\x20found*\x0a│\x0a','key','stream','startsWith','│\x20✘\x20*Error*\x0a│\x0a','mtimeMs','[SHAZAM]\x20play-dl\x20audio\x20OK','metadata','│\x20\x20\x20⎙\x20','mkdirSync','sample.mp3','https://api.siputzx.my.id/api/d/ytmp4?url=','concat','videoMessage','music','includes','audio/','data','│\x20⚉\x20Song\x20not\x20in\x20database\x0a','`✘\x20YouTube\x20link\x20not\x20available`','https://api.davidcyriltech.my.id/download/ytmp4?url=','append','find','quoted','`⚉\x20Downloading\x20video...`','[SHAZAM]\x20video\x20URL\x20OK:','writeFileSync','Empty\x20stream','mimetype','log','signature_version','findaudio','chat','Download\x20method\x20not\x20available','extendedTextMessage','│\x20✘\x20*Could\x20not\x20identify*\x0a│\x0a','16AhVSvA','│\x20❏♪⁠\x20*Released:*\x20','map','statSync','stanzaId','download','exec','catch','File\x20system\x20error','play-dl','Downloaded\x20stream\x20is\x20empty','[SHAZAM]\x20audio\x20fallback\x20failed:','duration_ms','│\x20\x20\x20or\x20video\x20with\x20sound\x0a','url','../../../tmp','[SHAZAM]\x20video\x20fallback\x20failed:','shazam','data_type','│\x20✘\x20*Must\x20be\x20audio\x20or\x20video*\x0a│\x0a','vid','text','unlinkSync','yt-search','album','│\x20\x20\x202\x20→\x20download\x20video\x0a','message','access_key','youtube','1493244pngnLi','.mp3','│\x20☬\x20*Duration:*\x20','artists','video','base64','get','identifyaudio','sample_bytes','32750Zkfyzn','│\x20㉨⁠\x20*Title:*\x20\x20\x20\x20','\x20-t\x20','mp3','node-fetch','`⚉\x20Reply\x201\x20for\x20audio\x20or\x202\x20for\x20video`','\x0a│\x0a','[SHAZAM]\x20YT\x20search\x20error:','sendMessage','sample','trim','148794eacZXl','readdirSync','33JbZcIK','forEach','spotify','length','join','Try\x20clearer\x20audio','186YBOWEY','FFmpeg\x20failed\x20to\x20create\x20output\x20file','│\x0a│\x20⚉\x20*Reply\x20with:*\x0a','delete','`✘\x20Download\x20failed:\x20','audio','access_secret','videos','ffmpeg\x20-i\x20\x22','sha1','result','mtype','188545npPekB','video/','│\x20*➫\x20Listen\x20On:*\x0a','crypto','msg','POST','`✘\x20Failed\x20to\x20get\x20video\x20URL`','Search','│\x20\x20\x201\x20→\x20download\x20audio\x0a','whatmusic','ENOENT','1956427acpxnb','Unknown\x20Artist','`⚉\x20Downloading\x20audio...`','ffmpeg','Reply\x20to\x20audio/video\x20with\x20.shazam','link','No\x20stream','audioMessage','[SHAZAM]\x20play-dl\x20failed:','fetch','N/A','floor','[SHAZAM]\x20fallback\x20audio\x20OK:','endpoint','│\x20⚉\x20','host','34180NDIyNR','│\x20✦\x20*Album:*\x20\x20\x20\x20','Mozilla/5.0','│\x20𓄄\x20*Artist:*\x20\x20\x20','mp4','sender','release_date','util','now','https://api.akuari.my.id/downloader/youtubeaudio?link=','downloadUrl','_𓄄\x20','existsSync','217586kqsIxk','name','json','╰──────────────────','readFileSync'];a0_0x1c19=function(){return _0x56006a;};return a0_0x1c19();}function a0_0x108e(_0x2ca630,_0x101ce6){_0x2ca630=_0x2ca630-0x18e;const _0x1c1936=a0_0x1c19();let _0x108ef6=_0x1c1936[_0x2ca630];return _0x108ef6;}async function downloadVideo(_0x188a71){const _0x53003c=a0_0x55c1c2;for(const _0x1ff10a of FALLBACK_VIDEO_APIS(_0x188a71)){try{const {data:_0x50e39b}=await axios['get'](_0x1ff10a,{'timeout':0x4e20,'headers':{'User-Agent':_0x53003c(0x1b4)}}),_0x2bf79a=_0x50e39b?.[_0x53003c(0x195)]?.[_0x53003c(0x1bc)]||_0x50e39b?.['result']?.[_0x53003c(0x204)]||_0x50e39b?.['result']||_0x50e39b?.['download']||_0x50e39b?.['url']||_0x50e39b?.['link'];if(!_0x2bf79a)continue;return console[_0x53003c(0x1ef)](_0x53003c(0x1eb),_0x1ff10a),_0x2bf79a;}catch(_0x572dfe){console[_0x53003c(0x1ef)](_0x53003c(0x206),_0x572dfe[_0x53003c(0x210)]);}}return null;}const searchYouTube=async _0x4f3691=>{const _0x48e284=a0_0x55c1c2;try{const _0x3bd4f5=await yts(_0x4f3691);return _0x3bd4f5[_0x48e284(0x192)][0x0]||null;}catch(_0x36e7a5){return console[_0x48e284(0x1ef)](_0x48e284(0x223),_0x36e7a5['message']),null;}},buildStringToSign=(_0x169d4b,_0x5a9ac3,_0x22e4ea,_0x14ef39,_0x25f705,_0x2cff07)=>[_0x169d4b,_0x5a9ac3,_0x22e4ea,_0x14ef39,_0x25f705,_0x2cff07][a0_0x55c1c2(0x22d)]('\x0a'),sign=(_0x1d9812,_0x592391)=>crypto[a0_0x55c1c2(0x1ce)](a0_0x55c1c2(0x194),_0x592391)['update'](Buffer[a0_0x55c1c2(0x1cc)](_0x1d9812,'utf8'))['digest']()['toString'](a0_0x55c1c2(0x218)),audioCut=async(_0x22b58f,_0xe80740,_0x532c8a)=>{const _0x590497=a0_0x55c1c2,_0x3235f6=_0x22b58f['replace'](/\.[^.]+$/,'')+'_cut.mp3';await exec(_0x590497(0x193)+_0x22b58f+'\x22\x20-ss\x20'+_0xe80740+_0x590497(0x21e)+_0x532c8a+'\x20-acodec\x20libmp3lame\x20-ar\x2044100\x20-ac\x201\x20-b:a\x20128k\x20\x22'+_0x3235f6+_0x590497(0x1c7));if(!fs[_0x590497(0x1be)](_0x3235f6))throw new Error(_0x590497(0x230));return{'data':fs[_0x590497(0x1c3)](_0x3235f6),'path':_0x3235f6};},ensureTempDir=()=>{const _0x19e3fd=a0_0x55c1c2,_0x5b7cea=path[_0x19e3fd(0x22d)](__dirname,_0x19e3fd(0x205));if(!fs[_0x19e3fd(0x1be)](_0x5b7cea))fs[_0x19e3fd(0x1db)](_0x5b7cea,{'recursive':!![]});return _0x5b7cea;},cleanupFiles=_0x2c3185=>{const _0xcbd9b7=a0_0x55c1c2;_0x2c3185[_0xcbd9b7(0x22a)](_0x1081b0=>{const _0x392303=_0xcbd9b7;try{if(_0x1081b0&&fs[_0x392303(0x1be)](_0x1081b0))fs['unlinkSync'](_0x1081b0);}catch{}});};setInterval(()=>{const _0x54c2d2=a0_0x55c1c2;try{const _0xe84c40=path['join'](__dirname,_0x54c2d2(0x205));if(!fs['existsSync'](_0xe84c40))return;const _0x2a5958=Date['now']();fs[_0x54c2d2(0x228)](_0xe84c40)[_0x54c2d2(0x22a)](_0x2721be=>{const _0x36547a=_0x54c2d2,_0x1428b2=path[_0x36547a(0x22d)](_0xe84c40,_0x2721be);_0x2a5958-fs[_0x36547a(0x1f9)](_0x1428b2)[_0x36547a(0x1d7)]>0x2*0x3c*0x3e8&&fs[_0x36547a(0x20c)](_0x1428b2);});}catch{}},0x1d4c0).unref?.();const handleShazamReply=async(_0x4b1cf9,_0x49bc2b,_0x56bca9)=>{const _0x3d8730=a0_0x55c1c2,_0xbb2a04=_0x49bc2b['chat']+':'+_0x49bc2b[_0x3d8730(0x1b7)],_0x2b5d2c=activeShazamSessions[_0x3d8730(0x219)](_0xbb2a04);if(!_0x2b5d2c)return![];const _0x10e246=_0x49bc2b[_0x3d8730(0x1e9)]?.['id']||_0x49bc2b[_0x3d8730(0x210)]?.[_0x3d8730(0x1f4)]?.[_0x3d8730(0x1c8)]?.[_0x3d8730(0x1fa)];if(_0x10e246!==_0x2b5d2c['messageId'])return![];activeShazamSessions[_0x3d8730(0x18e)](_0xbb2a04);const _0x1bc45d=_0x49bc2b[_0x3d8730(0x20b)]?.[_0x3d8730(0x1cb)]()[_0x3d8730(0x226)]();if(!['1','2',_0x3d8730(0x190),_0x3d8730(0x217)][_0x3d8730(0x1e1)](_0x1bc45d))return await _0x56bca9(_0x3d8730(0x221)),!![];const _0x23da10=_0x1bc45d==='1'||_0x1bc45d===_0x3d8730(0x190);await _0x4b1cf9[_0x3d8730(0x224)](_0x49bc2b['chat'],{'react':{'text':'⬇️','key':_0x49bc2b['key']}})[_0x3d8730(0x1fd)](()=>{});try{if(!_0x2b5d2c[_0x3d8730(0x1cd)])return _0x56bca9(_0x3d8730(0x1e5));if(_0x23da10){await _0x56bca9(_0x3d8730(0x1a4));const _0x48d989=await downloadAudio(_0x2b5d2c[_0x3d8730(0x1cd)]);if(!_0x48d989)return _0x56bca9('`✘\x20Failed\x20to\x20download\x20audio`');await _0x4b1cf9[_0x3d8730(0x224)](_0x49bc2b['chat'],{'audio':_0x48d989,'mimetype':_0x3d8730(0x1c4),'fileName':_0x2b5d2c['title']+_0x3d8730(0x214),'ptt':![]},{'quoted':_0x49bc2b});}else{await _0x56bca9(_0x3d8730(0x1ea));const _0x57c824=await downloadVideo(_0x2b5d2c[_0x3d8730(0x1cd)]);if(!_0x57c824)return _0x56bca9(_0x3d8730(0x19d));await _0x4b1cf9[_0x3d8730(0x224)](_0x49bc2b[_0x3d8730(0x1f2)],{'video':{'url':_0x57c824},'caption':_0x3d8730(0x1bd)+_0x2b5d2c['title']+'_'},{'quoted':_0x49bc2b});}await _0x4b1cf9[_0x3d8730(0x224)](_0x49bc2b[_0x3d8730(0x1f2)],{'react':{'text':'✨','key':_0x49bc2b[_0x3d8730(0x1d3)]}})[_0x3d8730(0x1fd)](()=>{});}catch(_0x2db7c9){await _0x56bca9(_0x3d8730(0x18f)+_0x2db7c9['message']+'`');}return!![];};module['exports']={'name':a0_0x55c1c2(0x207),'alias':[a0_0x55c1c2(0x1f1),a0_0x55c1c2(0x1e8),a0_0x55c1c2(0x21a),a0_0x55c1c2(0x1a0)],'desc':'Identify\x20music\x20from\x20replied\x20audio/video\x20message','category':a0_0x55c1c2(0x19e),'usage':a0_0x55c1c2(0x1a6),'react':'🎵','handleShazamReply':handleShazamReply,'execute':async(_0x56714d,_0x352f6a,{args:_0x1dcdbc,reply:_0x29abdf,prefix:_0x24e293})=>{const _0x31ba53=a0_0x55c1c2,_0x37aecf=ensureTempDir();let _0xcf6a1f=null,_0x59b4ed=null;try{const _0x32524e=_0x352f6a['quoted']?.[_0x31ba53(0x196)]===_0x31ba53(0x1a9)||_0x352f6a['quoted']?.[_0x31ba53(0x196)]==='ptvMessage'||_0x352f6a[_0x31ba53(0x1e9)]?.[_0x31ba53(0x1ee)]?.[_0x31ba53(0x1d5)](_0x31ba53(0x1e2)),_0x1c79f2=_0x352f6a['quoted']?.[_0x31ba53(0x196)]===_0x31ba53(0x1df)||_0x352f6a[_0x31ba53(0x1e9)]?.['mimetype']?.['startsWith'](_0x31ba53(0x198));if(!_0x32524e&&!_0x1c79f2)return _0x29abdf('╭─❍\x20*SHA𓄄AM*\x0a│\x0a'+_0x31ba53(0x209)+_0x31ba53(0x1c6)+_0x31ba53(0x203)+_0x31ba53(0x1c2));await _0x56714d[_0x31ba53(0x224)](_0x352f6a[_0x31ba53(0x1f2)],{'react':{'text':'🔍','key':_0x352f6a[_0x31ba53(0x1d3)]}})[_0x31ba53(0x1fd)](()=>{});if(!_0x352f6a[_0x31ba53(0x1e9)]['download'])throw new Error(_0x31ba53(0x1f3));const _0x1f0865=await _0x352f6a[_0x31ba53(0x1e9)][_0x31ba53(0x1fb)]();if(!_0x1f0865||_0x1f0865[_0x31ba53(0x22c)]===0x0)throw new Error(_0x31ba53(0x200));const _0x48cd52=_0x1c79f2?_0x31ba53(0x1b6):_0x31ba53(0x21f);_0xcf6a1f=path[_0x31ba53(0x22d)](_0x37aecf,'shazam_'+Date['now']()+'.'+_0x48cd52),fs[_0x31ba53(0x1ec)](_0xcf6a1f,_0x1f0865),_0x59b4ed=await audioCut(_0xcf6a1f,0x0,0xf);const _0x4bf95f=Math[_0x31ba53(0x1ad)](Date['now']()/0x3e8),_0x474baa=buildStringToSign('POST',ACR_CLOUD[_0x31ba53(0x1af)],ACR_CLOUD[_0x31ba53(0x211)],ACR_CLOUD['data_type'],ACR_CLOUD[_0x31ba53(0x1f0)],_0x4bf95f),_0x5c8409=sign(_0x474baa,ACR_CLOUD[_0x31ba53(0x191)]),_0x47eaea=new FormData();_0x47eaea[_0x31ba53(0x1e7)](_0x31ba53(0x225),_0x59b4ed[_0x31ba53(0x1e3)],{'filename':_0x31ba53(0x1dc),'contentType':_0x31ba53(0x1c4)}),_0x47eaea[_0x31ba53(0x1e7)](_0x31ba53(0x21b),_0x59b4ed[_0x31ba53(0x1e3)][_0x31ba53(0x22c)]),_0x47eaea['append'](_0x31ba53(0x211),ACR_CLOUD[_0x31ba53(0x211)]),_0x47eaea['append'](_0x31ba53(0x208),ACR_CLOUD[_0x31ba53(0x208)]),_0x47eaea[_0x31ba53(0x1e7)](_0x31ba53(0x1f0),ACR_CLOUD['signature_version']),_0x47eaea[_0x31ba53(0x1e7)]('signature',_0x5c8409),_0x47eaea[_0x31ba53(0x1e7)](_0x31ba53(0x1c9),_0x4bf95f);const _0x37c086='http://'+ACR_CLOUD[_0x31ba53(0x1b1)]+ACR_CLOUD[_0x31ba53(0x1af)],_0x8e1556=await fetch(_0x37c086,{'method':_0x31ba53(0x19c),'body':_0x47eaea,'timeout':0x7530}),_0x5a1a57=await _0x8e1556[_0x31ba53(0x1c1)]();if(_0x5a1a57['status']['code']!==0x0)return _0x29abdf('╭─❍\x20*SHA𓄄AM*\x0a│\x0a'+_0x31ba53(0x1f5)+(_0x31ba53(0x1b0)+(_0x5a1a57[_0x31ba53(0x1d1)][_0x31ba53(0x19b)]||_0x31ba53(0x22e))+'\x0a')+'╰──────────────────');if(!_0x5a1a57[_0x31ba53(0x1d9)]?.['music']?.[_0x31ba53(0x22c)])return _0x29abdf('╭─❍\x20*SHA𓄄AM*\x0a│\x0a'+_0x31ba53(0x1d2)+_0x31ba53(0x1e4)+'╰──────────────────');const _0x213654=_0x5a1a57[_0x31ba53(0x1d9)][_0x31ba53(0x1e0)][0x0],_0x197ce1=_0x213654[_0x31ba53(0x216)]?.[_0x31ba53(0x1f8)](_0x12673c=>_0x12673c[_0x31ba53(0x1c0)])[_0x31ba53(0x22d)](',\x20')||_0x31ba53(0x1a3),_0x1ae8be=_0x213654['title']||'Unknown\x20Title',_0x5d245a=_0x213654[_0x31ba53(0x20e)]?.[_0x31ba53(0x1c0)]||'Unknown\x20Album',_0x511f0b=_0x213654[_0x31ba53(0x1b8)]||_0x31ba53(0x1ac),_0xc84431=_0x213654[_0x31ba53(0x202)]?Math[_0x31ba53(0x1ad)](_0x213654[_0x31ba53(0x202)]/0x3e8)+'s':'N/A',_0x1cb213=await searchYouTube(_0x1ae8be+'\x20'+_0x197ce1),_0x4f2c05=_0x213654['external_metadata']?.[_0x31ba53(0x22b)]?.['track'],_0x1d32c8=_0x213654[_0x31ba53(0x1cf)]?.[_0x31ba53(0x212)];let _0x9eb9d9='╭─❍\x20*𓄄\x20SONG\x20IDENTIFIED*\x0a│\x0a'+(_0x31ba53(0x21d)+_0x1ae8be+'\x0a')+(_0x31ba53(0x1b5)+_0x197ce1+'\x0a')+(_0x31ba53(0x1b3)+_0x5d245a+'\x0a')+(_0x31ba53(0x1f7)+_0x511f0b+'\x0a')+(_0x31ba53(0x215)+_0xc84431+_0x31ba53(0x222))+_0x31ba53(0x199);if(_0x4f2c05?.['id'])_0x9eb9d9+='│\x20\x20\x20🎵\x20spotify.com/track/'+_0x4f2c05['id']+'\x0a';if(_0x1d32c8?.[_0x31ba53(0x20a)])_0x9eb9d9+='│\x20\x20𓊈𝑽꯭𝑰꯭𝑷ࠡࠡࠡࠡࠢ𓊉\x20youtube.com/watch?v='+_0x1d32c8['vid']+'\x0a';if(_0x1cb213?.[_0x31ba53(0x204)])_0x9eb9d9+=_0x31ba53(0x1da)+_0x1cb213[_0x31ba53(0x204)]+'\x0a';_0x9eb9d9+=_0x31ba53(0x231)+_0x31ba53(0x19f)+_0x31ba53(0x20f)+_0x31ba53(0x1c2);const _0xa29e64=_0x1cb213?.['thumbnail']||_0x213654['album']?.[_0x31ba53(0x1d0)]||'https://files.catbox.moe/5uli5p.jpeg',_0x421ac9=await _0x56714d[_0x31ba53(0x224)](_0x352f6a[_0x31ba53(0x1f2)],{'image':{'url':_0xa29e64},'caption':_0x9eb9d9},{'quoted':_0x352f6a}),_0x5f3a7d=_0x352f6a[_0x31ba53(0x1f2)]+':'+_0x352f6a[_0x31ba53(0x1b7)];activeShazamSessions['set'](_0x5f3a7d,{'messageId':_0x421ac9['key']['id'],'ytUrl':_0x1cb213?.[_0x31ba53(0x204)]||null,'title':_0x1ae8be,'timestamp':Date[_0x31ba53(0x1ba)]()}),setTimeout(()=>activeShazamSessions[_0x31ba53(0x18e)](_0x5f3a7d),0x1d4c0),await _0x56714d[_0x31ba53(0x224)](_0x352f6a[_0x31ba53(0x1f2)],{'react':{'text':'🎶','key':_0x352f6a['key']}})[_0x31ba53(0x1fd)](()=>{});}catch(_0x506a75){let _0x5406ff=_0x506a75[_0x31ba53(0x210)];if(_0x506a75[_0x31ba53(0x210)][_0x31ba53(0x1e1)](_0x31ba53(0x1a5)))_0x5406ff='FFmpeg\x20not\x20installed\x20or\x20failed';if(_0x506a75[_0x31ba53(0x210)]['includes'](_0x31ba53(0x1ab)))_0x5406ff='Network\x20error';if(_0x506a75[_0x31ba53(0x210)][_0x31ba53(0x1e1)](_0x31ba53(0x1a1)))_0x5406ff=_0x31ba53(0x1fe);return _0x29abdf('╭─❍\x20*SHA⚉AM*\x0a│\x0a'+_0x31ba53(0x1d6)+(_0x31ba53(0x1b0)+_0x5406ff+'\x0a')+'╰──────────────────');}finally{cleanupFiles([_0xcf6a1f,_0x59b4ed?.[_0x31ba53(0x1ca)]]);}}};
