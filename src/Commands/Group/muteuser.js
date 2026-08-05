const fs = require('fs');
const path = require('path');

/* ================= DATABASE ================= */

const MUTE_FILE = path.join(__dirname,'../../database/mutedUsers.json');

const initDb = () => {
const dir = path.dirname(MUTE_FILE);

if(!fs.existsSync(dir))
fs.mkdirSync(dir,{recursive:true});

if(!fs.existsSync(MUTE_FILE))
fs.writeFileSync(MUTE_FILE,'{}');
};

const getMutedDb = () => {
initDb();

try{
return JSON.parse(fs.readFileSync(MUTE_FILE,'utf8'));
}catch{
return {};
}
};

const saveMutedDb = data => {
fs.writeFileSync(MUTE_FILE,JSON.stringify(data,null,2));
};

/* ================= TIME ================= */

const parseTime = str => {
const match = str?.match(/^(\d+)(s|m|h|d|w|mo)$/i);
if(!match) return null;

const num=parseInt(match[1]);
const unit=match[2].toLowerCase();

const map={
s:1000,
m:60000,
h:3600000,
d:86400000,
w:604800000,
mo:2592000000
};

return num * map[unit];
};

const formatTime = ms => {

if(ms<=0) return 'Expired';

const s=Math.floor(ms/1000);
const m=Math.floor(s/60);
const h=Math.floor(m/60);
const d=Math.floor(h/24);

if(d>0) return `${d}d ${h%24}h`;
if(h>0) return `${h}h ${m%60}m`;
if(m>0) return `${m}m ${s%60}s`;

return `${s}s`;
};

/* ================= NAME ================= */

const getUserName = (sock,jid)=>{
try{
const contact=sock.store?.contacts?.get?.(jid);

if(contact?.notify) return contact.notify;
if(contact?.name) return contact.name;
if(contact?.verifiedName) return contact.verifiedName;

}catch{}

return jid.split('@')[0];
};

/* ================= MODULE ================= */

module.exports = {

name:'muteuser',
alias:['silence','shutup','unmuteuser',],
category:'Group',
desc:'Mute system',

execute: async(sock,m,{args,prefix,reply,isGroup,isAdmin,isBotAdmin,sender,mentionedJid})=>{

if(!isGroup)
return reply('✘ _*This command works only in groups*_');

const db=getMutedDb();
const chatId=m.chat;

if(!db[chatId])
db[chatId]={};

/* ================= COMMAND TYPE ================= */

const textLower=(m.text||'').toLowerCase();
const isUnmute=textLower.startsWith(prefix+'unmute');

/* ================= TARGET DETECTION ================= */

let targetJid=null;

/* Mention priority */
if(mentionedJid?.length)
targetJid=mentionedJid[0];

/* Reply priority */
else if(m.quoted?.sender)
targetJid=m.quoted.sender;

/* Regex @number */
else{
const match=(m.text||'').match(/@(\d+)/);
if(match)
targetJid=match[1]+'@s.whatsapp.net';
}

/* Number argument */
if(!targetJid && /^\d+$/.test(args[0]))
targetJid=args[0]+'@s.whatsapp.net';

if(!targetJid)
return reply(`✘ Specify user\nExample:\n${prefix}muteuser @user 30s reason`);

/* ================= META ================= */

const meta=await sock.groupMetadata(chatId);

const botJid=sock.user.id.split(':')[0]+'@s.whatsapp.net';

const botParticipant=meta.participants.find(p=>p.id===botJid);

//const isBotAdmin=
//botParticipant?.admin==='admin'||
//botParticipant?.admin==='superadmin';

const targetParticipant=meta.participants.find(p=>p.id===targetJid);

const isTargetAdmin=
targetParticipant?.admin==='admin'||
targetParticipant?.admin==='superadmin';

/* ================= NAME ================= */

let targetName=getUserName(sock,targetJid);

/* ================= UNMUTE ================= */

if(isUnmute){

if(!db[chatId][targetJid])
return reply(`✘ ${targetName} is not muted`);

delete db[chatId][targetJid];
saveMutedDb(db);

await sock.sendMessage(chatId,{
text:` ✓ @${targetJid.split('@')[0]} unmuted`,
mentions:[targetJid]
},{quoted:m});

return;
}

/* ================= VALIDATION ================= */

if(targetJid===sender)
return reply('✘ _*Cannot mute yourself*_');

if(targetJid===meta.owner)
return reply('✘ _*Cannot mute group owner*_');

if(isTargetAdmin && !isBotAdmin)
return reply('✘ _*Cannot mute admin*_');

if(isTargetAdmin && !isAdmin)
return reply('✘ _*Only admins can mute admins*_');

/* ================= TIME ================= */

let timeMs=null;

const timeArg=args.find(a=>/^\d+(s|m|h|d|w|mo)$/i.test(a));

if(timeArg)
timeMs=parseTime(timeArg);

// Default: permanent (no auto-unmute) unless a time is specified
if(!timeMs)
timeMs=null;

/* ================= REASON ================= */

const reason=args.filter(a=>
!a.includes('@') &&
!a.match(/^\d+(s|m|h|d|w|mo)$/i)
).join(' ')||'No reason';

/* ================= SAVE ================= */

const until = timeMs ? Date.now() + timeMs : Infinity;

db[chatId][targetJid]={
mutedBy:sender,
reason,
time:Date.now(),
until,
duration:timeMs || null
};

saveMutedDb(db);

/* ================= AUTO UNMUTE (only if timed) ================= */

if (timeMs) {
    setTimeout(async()=>{
        const db=getMutedDb();
        if(db[chatId]?.[targetJid]){
            delete db[chatId][targetJid];
            saveMutedDb(db);
            await sock.sendMessage(chatId,{
                text:`_*⁠☞⁠ ͡⁠°⁠ ͜⁠ʖ⁠ ͡⁠°⁠)⁠☞ ${targetJid.split('@')[0]} auto unmuted*_`,
                mentions:[targetJid]
            }).catch(()=>{});
        }
    }, timeMs);
}

/* ================= SUCCESS ================= */

const durationText = timeMs ? formatTime(timeMs) : '∞ Permanent';

await sock.sendMessage(chatId,{
text:
`_*⟁⃝ USER MUTED 彡*_\n\n`+
`—͟͟͞͞𖣘 Target: @${targetJid.split('@')[0]}\n`+
`✐   Reason: ${reason}\n`+
`ⓘ Duration: ${durationText}`,

mentions:[targetJid]

},{quoted:m});

}

};

/* ================= MESSAGE DELETE HANDLER ================= */

module.exports.handleMutedMessage=async(sock,m,isGroup)=>{

if(!isGroup) return false;

const db=getMutedDb();

const chatId=m.chat;
const sender=m.sender;

if(!db[chatId]?.[sender])
return false;

const muteInfo=db[chatId][sender];

// Infinity means permanent — only expire if until is a finite timestamp
if(muteInfo.until !== Infinity && Date.now() > muteInfo.until){
delete db[chatId][sender];
saveMutedDb(db);
return false;
}

try{

await sock.sendMessage(chatId,{
delete:m.key
}).catch(()=>{});

return true;

}catch(err){
console.log('[MUTE DELETE ERROR]',err.message);
return false;
}

};

module.exports.isMuted=(chatId,userId)=>{
const db=getMutedDb();
return !!db[chatId]?.[userId];
};

module.exports.getMuteInfo=(chatId,userId)=>{
const db=getMutedDb();
return db[chatId]?.[userId]||null;
};
