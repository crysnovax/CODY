'use strict';

// Compact, bundled English vocabulary: no network lookups or runtime dependencies.
const WORDS = `
a able about above abroad absence absolute absorb abstract absurd abuse access accident account accurate accuse ache achieve acid across act action active actor actual adapt add address adjust admire admit adopt adult advance advice advise affair affect afford afraid after afternoon again against age agency agenda agent agree ahead aid aim air airport alarm album alert alien alive all allow almost alone along aloud alphabet already also alter although always amaze ambition amount amused anchor ancient and anger angle angry animal annual another answer anxious any apart apology appeal appear apple apply april arch area argue arise arm armed armor army around arrange arrest arrive arrow art article artist as ash aside ask asleep aspect assign assist assume asthma athlete atom attach attack attempt attend attention attitude attract audio audit august aunt author auto autumn average avoid awake aware away awesome awful awkward
baby bachelor back background bacon badge bag balance ball bamboo banana band bank bar barely bargain barrel base basic basket battle beach bean bear beard beast beat beautiful because become bedroom before behave belief believe bell belong below belt bench benefit best better between beyond bicycle bid bike bird birth biscuit bit bite bitter black blade blame blanket blast blend bless blind block blood blossom blue board boat body boil bold bolt bomb bone bonus book border boring borrow boss both bother bottle bottom bounce boundary bowl box boy bracket brain brand brave bread break breathe brick bridge brief bright bring broad broken brother brown brush bubble buddy budget build bulb bulk bullet bundle burden burger burn burst bus business busy butter button buyer cabin cable cactus cage cake calculate calendar call calm camera camp campaign campus can canal cancel cancer candidate candle candy cap capable capital captain car carbon card care career careful carry cart case cash casino cast cat catalog catch category cater ceiling celebrate celery cell cement census century cereal certain chain chair chalk champion change chaos chapter charm chart chase cheap check cheek cheer cheese chef chemical chess chest chicken chief child chimney choice choose chronic chunk cigar cinema circle citizen city civil claim clap clarify claw clay clean clear clerk clever click client climate climb clinic clip clock close cloth cloud clown club clue coach coast coconut code coffee coin cold collect college color column combine come comfort comic common company concert conduct confirm congrats connect consider contact continue contract control cook cookie cool copper copy coral corner correct cost cotton couch country couple courage course court cousin cover cow crack craft crash crawl crazy cream create credit crew cricket crime crisp critic crop cross crowd cruel cruise crush cry crystal cube culture cup curious current curtain curve custom cute cycle dad daily damage dance danger daring dark data date dawn day dead deal debate debris decade december decide deck declare deep deer defend define degree delay deliver demand dentist deny depend describe desert design desire desk detail develop device devote diagram diamond diary dice diet differ digital dignity dilemma dinner direct dirt disagree discover disease dish dismiss distance divide dizzy doctor document dog doll dollar dolphin domain donate donkey door double doubt down draft dragon dramatic drawer dream dress drift drink drive drop drum dry duck due dumb during dust duty each eager eagle early earn earth easily east easy echo ecology economy edge edit editor educate effect effort egg eight either elbow elder electric element elephant elevator elite else embark emergency emotion employ empower empty enable encounter encourage end enemy energy engage engine enjoy enrich enroll enough ensure enter entire entry envelope equal escape essay essential establish estate estimate even evening event ever every evidence exact examine example exceed excel except exchange excite exercise exist exit expand expect expense expert explore export expose express extend extra eye fabric face fact factory fade fail faint fair faith fall false fame family famous fan fancy farm fashion fast fat fatal father fatigue fault favorite fear feast feather feature federal feed feel fellow fence festival fetch fever few fiber fiction field figure file fill film filter final find fine finger finish fire firm first fish fit fitness fix flag flame flash flat flavor flee flight float floor flour flow flower fluid fly focus fog foil fold follow food foot football force forest forget fork formal format former fortune forward fossil foster found foundation fragile frame free freedom freeze frequent fresh friend fringe frog front frost fruit fuel fun funny fur furniture further future gain galaxy gallery game gap garage garden garlic gas gate gather gauge general gentle genuine gesture ghost giant gift giggle ginger girl give glad glance glass global glove glow goal goat gold good goose gorilla govern grab grace grade grain grand grant grape grass gravity great green greet grief grill grin grip grocery group grow guard guess guide guilt guitar habit hair half hammer hamster hand handle happy harbor hard harvest hat have hazard head health heart heat heavy hedge height hello helmet help hen hero hidden high highway hill hint hip hire history hobby hockey hold hole holiday hollow home honey honor hope horn horror horse hospital host hotel hour house hover hub huge human humble humor hundred hungry hunt hurry hurt husband hybrid ice icon idea identify idle ignore ill image imagine immense impact improve impulse inch include income increase indeed index indicate indoor industry infant inform initial inject injury ink inn innocent input insect inside inspire install intact interest into introduce invent invest invite iron island isolate issue item jacket jaguar jail jam jar jazz jealous jeans jelly jewel job join joke journey joy judge juice jump jungle junior junk jury just keen keep kettle key kick kid kidney kind kingdom kiss kit kite kitten knee knife knock know knowledge label laboratory lack lady lake lamp land language laptop large laser last late laugh laundry law lawn lawsuit layer lazy leader leaf learn leave lecture left leg legal legend lemon lend length lens leopard lesson letter level liberty library license life lift light like limit line link lion liquid list listen litter little live lizard load loan lobster local lock logic lonely long look loop loose loss lottery loud lounge love loyal lucky luggage lumber lunar lunch lung luxury machine mad magic magnet mail main major make mammal man manage manner mansion manual maple marble march margin marine market marriage mask mass master match material math matter maximum maze meadow mean measure meat mechanic medal media melody melt member memory menace menu mercy merge merit merry mesh message metal method middle midnight milk million mimic mind minimum minor minute miracle mirror misery miss mistake mix mixed mobile model modify mom moment monitor monkey monster month moon moral more morning mosquito mother motion motor mountain mouse mouth move movie much muffin multiply muscle museum music must mutual myself mystery myth naive name nap narrow nasty nation nature near neck need negative neglect neither nerve nest net network neutral never new news next nice night noble noise nominate noodle normal north nose note nothing notice novel now nuclear number nurse nut oak obey object observe obtain obvious occasion ocean october odd off offer office often oil okay old olive olympic omit once one onion online only open opera operate opinion oppose option orange orbit orchard order ordinary organ orient original orphan ostrich other outdoor outer output outside oval oven over own owner oxygen oyster ozone package paddle page pair palace palm panda panel panic paper parade parent park parrot part party pass patch path patient patrol pattern pause pave payment peace peanut pear pedal peel peer penalty pencil people pepper perfect perform perfume perhaps permit person pet phone photo phrase physical piano picnic picture piece pig pigeon pill pilot pink pioneer pipe pistol pitch pizza place planet plastic plate play please pledge pluck plug plum plunge poem poet point polar police policy polish polite pond pony pool popular portion position possible post potato pottery poverty powder power practice praise predict prefer prepare present pretty prevent price pride primary print priority prison prize problem process produce product profit program project promise promote proof property propose prosper protect proud prove provide public pudding pull pulp pulse pumpkin punch pupil puppy purchase pure purple purpose purse push put puzzle pyramid quality quantum quarter queen question quick quiet quilt quit quote rabbit race rack radar radio rail rain raise rally ramp ranch random range rapid rare rate rather raven raw ray razor reach react read ready real reason rebel rebuild recall receive recipe record recycle red reduce reflect reform refuse region regret regular reject relax release relief rely remain remember remove render rent repair repeat replace reply report request rescue resist resort resource response result retire retreat return reunion reveal review reward rhythm rib ribbon rice rich ride ridge rifle right rigid ring riot ripple risk ritual river road roast robot robust rocket rod role roll romance roof rook room root rope rose rough round route routine royal rubber rude rug rule run runner rural rush sad saddle safe sail salad salmon salt salute same sample sand satisfy sauce sausage save say scale scan scare scarf school science scissors scout scramble scrap screen script scroll scrub sea search season seat second secret section security seed seek select sell seminar sense series serious serve service session settle setup seven shadow share sheep sheet shelf shell shelter shield shift shine ship shiver shock shoe shoot shop short shoulder shove show shrimp shrug shuffle shy sibling sick side siege sign silent silk silly silver similar simple since sing singer single sink sip siren sister situate six size skate sketch ski skill skin skirt sky slab slam sleep slender slice slide slight slim slogan slot slow slush small smart smile smoke smooth snack snail snake snap sniff snow soap soccer social sock soda soft solar soldier solid solution solve someone song soon sorry sort soul sound soup source south space spare speed spell spend spice spider spike spin spirit split spoil spoon sport spot spray spread spring spy square squeeze squirrel stable stadium staff stage stairs stamp stand start state stay steak steal steam steel stem step stereo stick still sting stitch stock stomach stone stool story stove strategy straw stream street strike string strip strong structure struggle student study stuff stumble style subject subway success such sudden suffer sugar suggest suit summer sun sunny sunrise sunset super supply support sure surface surprise surround survey suspect sustain swallow swamp swap swarm swear sweat sweep sweet swift swim swing switch sword symbol symmetry symphony syrup system table tackle tag tail talent talk tall tame tank tap target task taste tattoo taxi teach team tell ten tennis tent term test text thank that theme then theory there they thick thief thin thing think third thirst thirteen thirty this thought three throat throne through thumb thunder ticket tide tiger tight till timber time tiny tip tired title toast today toddler toe together toilet token tomato tomorrow tone tongue tonight tool tooth top topic torch tornado tortoise total touch tough tour toward tower town toy track trade traffic tragedy trail train transfer trap travel tray treasure treat tree trend trial tribe trick trigger trim trip trophy trouble truck true truly trumpet trust truth try tube tuition tumble tuna tunnel turkey turn turtle twelve twenty twice twin twist two type typical ugly umbrella unable unaware uncle uncover under undo unfair unfold unhappy uniform unique unit universe unknown unlock until unusual unveil update upgrade uphold upon upper upset urban urge usage use useful usual utility vacant vacuum vague valid valley value van vanish vapor various vast vault vehicle velvet vendor venture verb verify version very vessel veteran viable vibrant vicious victory video view village vintage violin virtual virus visit visual vital vivid vocal voice volcano volume vote voyage wagon waist wait wake walk wall walnut want war warm warrior wash wasp waste water wave way wealth weapon wear weather web wedding weekend weird welcome west wet whale what wheat wheel when where while whisper white whole whom wide widow width wife wild will win wind window wine wing wink winner winter wire wisdom wise wish witness wolf woman wonder wood wool word work world worm worry worth would wound wreck wrestle wrist write wrong yard year yellow yes yesterday yet yield yoga yogurt young youth zebra zero zigzag zinc zone zoo zoom
`;
const WORD_LIST = Array.from(new Set(WORDS.trim().split(/\s+/).filter(word => /^[a-z]{3,}$/.test(word))));
const WORD_SET = new Set(WORD_LIST);
const sessions = new Map();

function normalizeWord(input) {
  if (typeof input !== 'string') return '';
  return input.toLocaleLowerCase('en-US').trim()
    .replace(/[’'`.,!?;:()[\]{}"“”\-–—]/g, '')
}

function createSession(mode, chat, players) {
  return {
    mode,
    chat,
    players: players.map(player => ({ id: player.id, joinedAt: player.joinedAt || Date.now() })),
    currentPlayer: players[0]?.id || null,
    lastWord: null,
    usedWords: new Set(),
    history: [],
    startedAt: Date.now(),
    winner: null,
    ended: false
  };
}

function validateWord(session, rawWord, playerId, wordSet = WORD_SET) {
  const word = normalizeWord(rawWord);
  if (!word || !/^[a-z]+$/.test(word)) return { ok: false, reason: 'letters' };
  if (word.length < 3) return { ok: false, reason: 'short' };
  if (!wordSet.has(word)) return { ok: false, reason: 'unknown', word };
  if (session.usedWords.has(word)) return { ok: false, reason: 'repeated', word };
  if (!session.players.some(player => player.id === playerId)) return { ok: false, reason: 'player', word };
  if (session.lastWord && word[0] !== session.lastWord.at(-1)) {
    return { ok: false, reason: 'chain', word, expected: session.lastWord.at(-1) };
  }
  if (session.mode === 'group' && session.currentPlayer !== playerId) {
    return { ok: false, reason: 'turn', word };
  }
  return { ok: true, word };
}

function applyWord(session, rawWord, playerId, wordSet = WORD_SET) {
  if (!session || session.ended) return { ok: false, reason: 'inactive' };
  const result = validateWord(session, rawWord, playerId, wordSet);
  if (!result.ok) return result;
  const player = session.players.find(entry => entry.id === playerId);
  if (!player) return { ok: false, reason: 'player' };
  session.lastWord = result.word;
  session.usedWords.add(result.word);
  session.history.push({ word: result.word, playerId });
  if (session.mode === 'group') {
    const index = session.players.findIndex(entry => entry.id === playerId);
    session.currentPlayer = session.players[(index + 1) % session.players.length].id;
  }
  return { ok: true, word: result.word, player };
}

function findBotWord(lastWord, usedWords, wordList = WORD_LIST, random = Math.random) {
  if (!lastWord) return null;
  const initial = lastWord.at(-1);
  const options = wordList.filter(word => word.startsWith(initial) && !usedWords.has(word));
  if (!options.length) return null;
  const index = Math.min(options.length - 1, Math.floor(random() * options.length));
  return options[index];
}

function hasContinuation(lastWord, usedWords, wordList = WORD_LIST) {
  if (!lastWord) return false;
  const initial = lastWord.at(-1);
  return wordList.some(word => word.startsWith(initial) && !usedWords.has(word));
}

function senderId(m) {
  return m?.sender || m?.key?.participant || m?.participant || '';
}

function sessionKey(mode, chat, sender) {
  return mode === 'group' ? `group:${chat}` : `solo:${chat}:${sender}`;
}

function identityText(id) {
  const digits = String(id || '').split('@')[0].replace(/:\d+$/, '').replace(/\D/g, '');
  return digits ? `+${digits}` : 'a player';
}

function playerLabel(session, id) {
  const index = session.players.findIndex(player => player.id === id);
  return index < 0 ? 'Unknown player' : `Player ${index + 1} (${identityText(id)})`;
}

function usageText() {
  return `🔤 *WORD CHAIN GAME*\n\nChoose your format:\n• *.wcg solo* — play in this chat against the bot\n• *.wcg group* — start a pass-and-play match in a WhatsApp group\n• *.wcg join* — join an active group match\n\nOn your turn, send *.wcg <word>* or *.wcg play <word>*. Each word must be 3+ letters, a listed English word, unused, and begin with the previous word’s final letter.\n\n*.wcg status* shows the match; *.wcg quit* forfeits your own solo match or a group match you joined. Group play is turn-taking in this WhatsApp chat; it is not an interactive web game.`;
}

function statusText(session) {
  const mode = session.mode === 'solo' ? 'Solo vs bot' : 'Group turn-taking';
  const turn = session.mode === 'solo' ? 'You (then the bot)' : playerLabel(session, session.currentPlayer);
  const last = session.lastWord ? `${session.lastWord} → *${session.lastWord.at(-1).toUpperCase()}*` : 'No word yet — the first player may start anywhere.';
  const players = session.mode === 'solo'
    ? 'You · WCG Bot'
    : session.players.map((player, i) => `${i + 1}. ${identityText(player.id)}`).join('\n');
  return `🔤 *WORD CHAIN · STATUS*\n\n*Mode:* ${mode}\n*Turn:* ${turn}\n*Last word:* ${last}\n*Words played:* ${session.history.length}\n*Players:*\n${players}`;
}

async function sendWcgMessage(sock, m, text, reply) {
  if (typeof sock?.sendPlogmeMessage === 'function') {
    return sock.sendPlogmeMessage(m.chat, { text }, m, { renderRichResponse: true });
  }
  if (typeof sock?.sendMessage === 'function') {
    return sock.sendMessage(m.chat, { text }, { quoted: m });
  }
  if (typeof reply === 'function') return reply(text);
  return undefined;
}

function commandText(m, options) {
  if (Array.isArray(options?.args) && options.args.length) return options.args.join(' ').trim();
  if (typeof options?.text === 'string' && options.text.trim()) return options.text.trim();
  return String(m?.text || m?.body || '').trim().replace(/^\.?wcg(?:\s+|$)/i, '').trim();
}

async function execute(sock, m, options = {}) {
  const reply = options.reply;
  const chat = String(m?.chat || '');
  const sender = senderId(m);
  const input = commandText(m, options);
  const [actionRaw = '', ...rest] = input.split(/\s+/);
  const action = actionRaw.toLowerCase();
  const soloKey = sessionKey('solo', chat, sender);
  const groupKey = sessionKey('group', chat);
  let session;
  let response;

  if (!action || action === 'help') {
    response = usageText();
  } else if (action === 'solo') {
    if (!sender) response = 'I could not identify your WhatsApp sender, so I cannot create a private solo session.';
    else if (sessions.has(soloKey)) response = 'You already have a solo match in this chat. Use *.wcg status* to check it or *.wcg quit* to forfeit before starting another.';
    else {
      session = createSession('solo', chat, [{ id: sender }]);
      sessions.set(soloKey, session);
      response = `✨ *SOLO MATCH STARTED*\n\nYou’re up first. Send any unused 3+ letter English word with *.wcg <word>*. I’ll answer with a word beginning with its final letter.\n\nUse *.wcg status* to check the chain or *.wcg quit* to forfeit.`;
    }
  } else if (action === 'group') {
    if (!chat.endsWith('@g.us')) response = 'Group matches can only start inside a WhatsApp group chat. Use *.wcg solo* here instead.';
    else if (!sender) response = 'I could not identify your WhatsApp sender, so I cannot start the group match.';
    else if (sessions.has(groupKey)) response = 'A group match is already active here. Join it with *.wcg join* or check *.wcg status*; it will not be replaced.';
    else {
      session = createSession('group', chat, [{ id: sender }]);
      sessions.set(groupKey, session);
      response = `👥 *GROUP MATCH STARTED*\n\n${identityText(sender)} is Player 1 and takes the first turn. Invite others to send *.wcg join*. The first word may start with any letter.\n\nTurns are played in this group chat with *.wcg <word>*; use *.wcg status* to see whose turn it is. No links or client-side game are involved.`;
    }
  } else if (action === 'join') {
    if (!chat.endsWith('@g.us')) response = 'Joining is available only in the WhatsApp group where the match is running.';
    else if (!sender) response = 'I could not identify your WhatsApp sender, so I cannot add you to the match.';
    else if (!(session = sessions.get(groupKey))) response = 'There is no active group match here. Start one with *.wcg group*.';
    else if (session.players.some(player => player.id === sender)) response = 'You are already in this match.';
    else {
      session.players.push({ id: sender, joinedAt: Date.now() });
      response = `✅ ${identityText(sender)} joined as Player ${session.players.length}. They’ll take a turn when the round reaches them.`;
    }
  } else if (action === 'status') {
    session = sessions.get(groupKey) || (sender && sessions.get(soloKey));
    response = session ? statusText(session) : 'No active match for you in this chat. Start with *.wcg solo* or *.wcg group*.';
  } else if (action === 'quit' || action === 'forfeit') {
    if (!sender) response = 'I could not identify your WhatsApp sender; no match was changed.';
    else {
      session = sessions.get(groupKey);
      if (chat.endsWith('@g.us') && session) {
        if (!session.players.some(player => player.id === sender)) response = 'Only a player who joined this group match can forfeit it. No game state was changed.';
        else {
          session.ended = true;
          session.winner = 'forfeit';
          sessions.delete(groupKey);
          response = `🏁 ${identityText(sender)} forfeited. The group match has ended; start a fresh one with *.wcg group* when ready.`;
        }
      } else if (sessions.has(soloKey)) {
        session = sessions.get(soloKey);
        session.ended = true;
        session.winner = 'bot';
        sessions.delete(soloKey);
        response = 'Match forfeited. The bot wins this solo round; start again with *.wcg solo* whenever you like.';
      } else response = 'You do not have an active match here, so nothing was changed.';
    }
  } else {
    const rawWord = action === 'play' ? rest.join(' ') : [actionRaw, ...rest].join(' ');
    if (chat.endsWith('@g.us') && (session = sessions.get(groupKey))) {
      const result = applyWord(session, rawWord, sender);
      if (!result.ok) {
        const errors = {
          letters: 'Use a word made of letters only.', short: 'That word is too short; use at least 3 letters.',
          unknown: `“${normalizeWord(rawWord)}” is not in my bundled English word list. Try another word.`,
          repeated: `“${normalizeWord(rawWord)}” has already been used in this match. Try a fresh word.`,
          chain: `That word must start with *${(result.expected || session.lastWord?.at(-1) || '?').toUpperCase()}*, the final letter of *${session.lastWord}*.`,
          turn: `It is ${playerLabel(session, session.currentPlayer)}’s turn. Your word did not consume a turn.`,
          player: 'Join this match with *.wcg join* before playing.', inactive: 'This match is no longer active.'
        };
        response = errors[result.reason] || 'That word was not accepted; the turn has not advanced.';
      } else {
        const nextId = session.currentPlayer;
        if (!hasContinuation(result.word, session.usedWords)) {
          session.ended = true;
          session.winner = sender;
          sessions.delete(groupKey);
          response = `🏆 *${playerLabel(session, sender)} WINS!*\n\n*${result.word}* left no unused word beginning with *${result.word.at(-1).toUpperCase()}*. Start a new group match with *.wcg group*.`;
        } else {
          response = `✅ *${result.word}* accepted (${playerLabel(session, sender)}).\n\n➡️ Next: ${playerLabel(session, nextId)} — send *.wcg <word>* starting with *${result.word.at(-1).toUpperCase()}*.`;
        }
      }
    } else if (sender && (session = sessions.get(soloKey))) {
      const result = applyWord(session, rawWord, sender);
      if (!result.ok) {
        const errors = {
          letters: 'Use a word made of letters only.', short: 'That word is too short; use at least 3 letters.',
          unknown: `“${normalizeWord(rawWord)}” is not in my bundled English word list. Try another word.`,
          repeated: `“${normalizeWord(rawWord)}” has already been used in this match. Try a fresh word.`,
          chain: `That word must start with *${(result.expected || session.lastWord?.at(-1) || '?').toUpperCase()}*, the final letter of *${session.lastWord}*.`,
          player: 'This is not your solo session.'
        };
        response = errors[result.reason] || 'That word was not accepted; the game state has not changed.';
      } else {
        const botWord = findBotWord(result.word, session.usedWords);
        if (!botWord) {
          session.ended = true;
          session.winner = sender;
          sessions.delete(soloKey);
          response = `🏆 *YOU WIN!*\n\nYour word *${result.word}* left the bot with no unused word beginning with *${result.word.at(-1).toUpperCase()}*. Start another round with *.wcg solo*.`;
        } else {
          session.usedWords.add(botWord);
          session.lastWord = botWord;
          session.history.push({ word: botWord, playerId: 'bot' });
          response = `✅ You: *${result.word}*\n🤖 Bot: *${botWord}*\n\nYour turn again — play an unused word starting with *${botWord.at(-1).toUpperCase()}*. Use *.wcg status* to review the chain.`;
        }
      }
    } else response = chat.endsWith('@g.us')
      ? 'There is no active group match here. Start one with *.wcg group*.'
      : 'You do not have an active solo match in this chat. Start one with *.wcg solo*.';
  }

  return sendWcgMessage(sock, m, response, reply);
}

module.exports = {
  name: 'wcg',
  alias: ['wordchain', 'word-chain'],
  desc: 'Play Word Chain solo against the bot or in group turns',
  category: 'Games',
  usage: '.wcg solo | .wcg group | .wcg join | .wcg <word> | .wcg status | .wcg quit',
  execute,
  // Export deterministic hooks for focused tests and integrations.
  WORD_LIST,
  WORD_SET,
  sessions,
  normalizeWord,
  createSession,
  validateWord,
  applyWord,
  findBotWord,
  hasContinuation,
  sessionKey,
  senderId,
  statusText,
  sendWcgMessage,
  _resetSessions() { sessions.clear(); }
};
