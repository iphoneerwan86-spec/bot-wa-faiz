const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const axios = require('axios');
const ytSearch = require('yt-search');
const ytdl = require('@distube/ytdl-core');
const { getTikTokVideo, getInstagramVideo } = require('./downloader');
const games = require('./games');
const db = require('./database');
const fs = require('fs');
const path = require('path');
const config = require('./config');

// =================== PUPPETEER CONFIG ===================
const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--disable-gpu',
            '--no-first-run',
            '--no-zygote',
            '--single-process',
            '--disable-extensions'
        ]
    }
});

// =================== RATE LIMITER ===================
const rateLimitMap = {};

function checkRateLimit(userId) {
    const now = Date.now();
    const window = 2 * 60 * 1000;
    const max = 5;
    if (!rateLimitMap[userId]) rateLimitMap[userId] = [];
    rateLimitMap[userId] = rateLimitMap[userId].filter(t => now - t < window);
    if (rateLimitMap[userId].length >= max) {
        const oldest = rateLimitMap[userId][0];
        const remaining = Math.ceil((window - (now - oldest)) / 1000);
        return { allowed: false, remaining };
    }
    rateLimitMap[userId].push(now);
    return { allowed: true };
}

// =================== QR & READY ===================
client.on('qr', qr => {
    console.log('📱 Scan QR Code ini untuk login:');
    qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
    console.log(`✅ ${db.getBotName()} siap digunakan!`);
});

client.on('auth_failure', msg => console.error('❌ Auth gagal:', msg));
client.on('disconnected', reason => console.log('⚠️ Disconnect:', reason));

// =================== PESAN MASUK ===================
client.on('message', async (msg) => {
    const body = msg.body?.trim();
    if (!body || msg.fromMe) return;

    const chat = await msg.getChat();
    const isGroup = chat.isGroup;
    const sender = msg.author || msg.from;

    let isGroupAdmin = false;
    let isBotGroupAdmin = false;

    if (isGroup) {
        const participants = chat.participants;
        const senderP = participants.find(p => p.id._serialized === sender);
        isGroupAdmin = senderP?.isAdmin || senderP?.isSuperAdmin || false;
        isBotGroupAdmin = participants.find(p => p.id._serialized === client.info.wid._serialized)?.isAdmin || false;
    }

    const isOwner = db.isOwner(sender);
    const isBotAdmin = db.isBotAdmin(sender);
    const hasPrivilege = isOwner || isBotAdmin;

    try {
        if (!hasPrivilege && body.startsWith('.')) {
            const rl = checkRateLimit(sender);
            if (!rl.allowed) {
                await msg.reply(`⏳ *Rate Limit!*\n\nTunggu *${rl.remaining} detik* lagi.\n_(Batas: 5 perintah per 2 menit)_`);
                return;
            }
        }

        const parts = body.split(' ');
        const cmd = parts[0].toLowerCase();

        if (cmd === '.menu' || cmd === '.help') { await msg.reply(getHelpMenu(hasPrivilege)); return; }

        if (cmd === '.namabot') {
            if (!hasPrivilege) { await msg.reply('❌ Hanya owner/admin bot!'); return; }
            const newName = parts.slice(1).join(' ').trim();
            if (!newName) { await msg.reply('❌ Contoh: `.namabot GAMEHARD`'); return; }
            db.setBotName(newName);
            await msg.reply(`✅ Nama bot diubah jadi *${newName}*!`);
            return;
        }

        if (cmd === '.addadmin') {
            if (!isOwner) { await msg.reply('❌ Hanya owner!'); return; }
            const mentioned = await msg.getMentions();
            if (!mentioned.length) { await msg.reply('❌ Tag user!\nContoh: `.addadmin @user`'); return; }
            for (const c of mentioned) db.addBotAdmin(c.id._serialized);
            await msg.reply(`✅ Berhasil tambah ${mentioned.length} admin bot.`);
            return;
        }

        if (cmd === '.deladmin') {
            if (!isOwner) { await msg.reply('❌ Hanya owner!'); return; }
            const mentioned = await msg.getMentions();
            if (!mentioned.length) { await msg.reply('❌ Tag admin yang mau dicopot!'); return; }
            for (const c of mentioned) db.removeBotAdmin(c.id._serialized);
            await msg.reply(`✅ Berhasil copot ${mentioned.length} admin bot.`);
            return;
        }

        if (cmd === '.listadmin') {
            const admins = db.getBotAdmins();
            if (!admins.length) { await msg.reply('📋 Belum ada admin bot.'); return; }
            await msg.reply(`👑 *Daftar Admin Bot:*\n\n${admins.map((a, i) => `${i + 1}. ${a}`).join('\n')}`);
            return;
        }

        if (cmd === '.h' || cmd === '.tagall') {
            if (!isGroup) { await msg.reply('❌ Hanya untuk grup!'); return; }
            if (!isGroupAdmin && !hasPrivilege) { await msg.reply('❌ Hanya admin grup/bot!'); return; }
            let text = `📢 *${db.getBotName()}* — Perhatian anggota!\n\n`;
            const mentions = [];
            for (const p of chat.participants) { text += `@${p.id.user} `; mentions.push(p.id._serialized); }
            await chat.sendMessage(text, { mentions });
            return;
        }

        if (cmd === '.play') {
            const query = parts.slice(1).join(' ').trim();
            if (!query) { await msg.reply('❌ Contoh: `.play Bohemian Rhapsody`'); return; }
            await handlePlay(msg, query); return;
        }

        if (cmd === '.tiktok' || cmd === '.tt') {
            const url = parts[1];
            if (!url) { await msg.reply('❌ Contoh: `.tiktok https://vt.tiktok.com/xxx`'); return; }
            await handleTikTok(msg, url); return;
        }

        if (cmd === '.ig') {
            const url = parts[1];
            if (!url) { await msg.reply('❌ Contoh: `.ig https://www.instagram.com/p/xxx`'); return; }
            await handleInstagram(msg, url); return;
        }

        if (isGroup && ['.kick', '.promote', '.demote', '.hidetag'].includes(cmd)) {
            await handleGroupCommand(msg, chat, body, isGroupAdmin, isBotGroupAdmin, hasPrivilege); return;
        }

        if (['.suit', '.tebak', '.jawab'].includes(cmd)) {
            await handleGame(msg, chat, body); return;
        }

        const autoReply = getAutoReply(body.toLowerCase());
        if (autoReply) { await msg.reply(autoReply); return; }

        if (cmd === '.ai') {
            const q = parts.slice(1).join(' ').trim();
            if (!q) { await msg.reply('❌ Contoh: `.ai Apa itu AI?`'); return; }
            await handleAI(msg, q); return;
        }

        if (!isGroup && !body.startsWith('.')) {
            await handleAI(msg, body);
        }

    } catch (err) {
        console.error('Error:', err.message);
        await msg.reply('❌ Error: ' + err.message);
    }
});

// =================== PLAY MUSIK ===================
async function handlePlay(msg, query) {
    await msg.reply(`🔍 Mencari: *${query}*...`);
    const results = await ytSearch(query);
    if (!results.videos.length) { await msg.reply('❌ Lagu tidak ditemukan!'); return; }

    const video = results.videos[0];
    if (video.seconds > 600) { await msg.reply(`⚠️ Lagu terlalu panjang (${video.timestamp}). Maks 10 menit.`); return; }

    await msg.reply(
        `🎵 *${video.title}*\n` +
        `👤 Artis: ${video.author.name}\n` +
        `⏱️ Durasi: ${video.timestamp}\n` +
        `👁️ Views: ${Number(video.views).toLocaleString('id-ID')}\n` +
        `🔗 ${video.url}`
    );

    await msg.reply('⏳ Mengunduh audio...');
    if (!fs.existsSync('./tmp')) fs.mkdirSync('./tmp');
    const outputPath = path.join(__dirname, 'tmp', `${Date.now()}.mp3`);

    await new Promise((resolve, reject) => {
        const stream = ytdl(video.url, { filter: 'audioonly', quality: 'highestaudio' });
        const out = fs.createWriteStream(outputPath);
        stream.pipe(out);
        out.on('finish', resolve);
        stream.on('error', reject);
    });

    const media = MessageMedia.fromFilePath(outputPath);
    await msg.reply(media, null, { sendMediaAsDocument: true });
    fs.unlinkSync(outputPath);
}

// =================== TIKTOK ===================
async function handleTikTok(msg, url) {
    await msg.reply('⏳ Mengunduh TikTok tanpa watermark...');
    try {
        const buffer = await getTikTokVideo(url);
        if (!fs.existsSync('./tmp')) fs.mkdirSync('./tmp');
        const filePath = path.join(__dirname, 'tmp', `tt_${Date.now()}.mp4`);
        fs.writeFileSync(filePath, buffer);
        const media = MessageMedia.fromFilePath(filePath);
        await msg.reply(media, null, { caption: '🎵 TikTok — Tanpa Watermark ✅' });
        fs.unlinkSync(filePath);
    } catch (e) {
        await msg.reply('❌ Gagal download TikTok. Pastikan link valid dan akun tidak private.');
    }
}

// =================== INSTAGRAM ===================
async function handleInstagram(msg, url) {
    await msg.reply('⏳ Mengunduh dari Instagram...');
    try {
        const buffer = await getInstagramVideo(url);
        if (!fs.existsSync('./tmp')) fs.mkdirSync('./tmp');
        const filePath = path.join(__dirname, 'tmp', `ig_${Date.now()}.mp4`);
        fs.writeFileSync(filePath, buffer);
        const media = MessageMedia.fromFilePath(filePath);
        await msg.reply(media, null, { caption: '📸 Instagram — Tanpa Watermark ✅' });
        fs.unlinkSync(filePath);
    } catch (e) {
        await msg.reply('❌ Gagal download Instagram. Pastikan link valid dan postingan publik.');
    }
}

// =================== GRUP MANAGEMENT ===================
async function handleGroupCommand(msg, chat, body, isGroupAdmin, isBotGroupAdmin, hasPrivilege) {
    const parts = body.split(' ');
    const cmd = parts[0].toLowerCase();
    if (!isGroupAdmin && !hasPrivilege) { await msg.reply('❌ Hanya admin grup/bot!'); return; }
    if (!isBotGroupAdmin && cmd !== '.hidetag') { await msg.reply('❌ Bot harus jadi admin grup!'); return; }
    const mentioned = await msg.getMentions();
    if (cmd === '.kick') {
        if (!mentioned.length) { await msg.reply('❌ Tag user! Contoh: `.kick @user`'); return; }
        for (const c of mentioned) await chat.removeParticipants([c.id._serialized]);
        await msg.reply(`✅ Berhasil kick ${mentioned.length} anggota.`);
    } else if (cmd === '.promote') {
        if (!mentioned.length) { await msg.reply('❌ Tag user! Contoh: `.promote @user`'); return; }
        await chat.promoteParticipants(mentioned.map(m => m.id._serialized));
        await msg.reply(`✅ Berhasil promote ${mentioned.length} anggota.`);
    } else if (cmd === '.demote') {
        if (!mentioned.length) { await msg.reply('❌ Tag user! Contoh: `.demote @user`'); return; }
        await chat.demoteParticipants(mentioned.map(m => m.id._serialized));
        await msg.reply(`✅ Berhasil copot ${mentioned.length} admin.`);
    } else if (cmd === '.hidetag') {
        const pesan = parts.slice(1).join(' ') || '📢 Notifikasi';
        const mentions = chat.participants.map(p => p.id._serialized);
        await chat.sendMessage(pesan, { mentions });
    }
}

// =================== GAMES ===================
const activeGames = {};

async function handleGame(msg, chat, body) {
    const chatId = chat.id._serialized;
    const parts = body.split(' ');
    const cmd = parts[0].toLowerCase();

    if (cmd === '.suit') {
        const pilihanUser = parts[1]?.toLowerCase();
        const valid = ['batu', 'gunting', 'kertas'];
        if (!pilihanUser || !valid.includes(pilihanUser)) {
            await msg.reply('✊ Ketik: `.suit batu` / `.suit gunting` / `.suit kertas`'); return;
        }
        const botPilihan = valid[Math.floor(Math.random() * 3)];
        const emoji = { batu: '🪨', gunting: '✂️', kertas: '📄' };
        await msg.reply(`✊ *SUIT!*\n\nKamu: ${emoji[pilihanUser]} ${pilihanUser}\nBot: ${emoji[botPilihan]} ${botPilihan}\n\n${games.suitResult(pilihanUser, botPilihan)}`);
    }

    if (cmd === '.tebak') {
        const soal = games.getRandomWord();
        activeGames[chatId] = { type: 'tebak', answer: soal.word, hint: soal.hint };
        await msg.reply(`🧩 *TEBAK KATA!*\n\nPetunjuk: *${soal.hint}*\nHuruf diacak: *${games.shuffleWord(soal.word)}*\n\nKetik: \`.jawab [kata]\``);
    }

    if (cmd === '.jawab') {
        const game = activeGames[chatId];
        if (!game) { await msg.reply('❌ Tidak ada game aktif. Mulai dengan *.tebak*'); return; }
        const jawaban = parts.slice(1).join(' ').toLowerCase().trim();
        if (jawaban === game.answer.toLowerCase()) {
            delete activeGames[chatId];
            await msg.reply(`🎉 *BENAR!* Jawaban: *${game.answer}* ✅`);
        } else {
            await msg.reply(`❌ Salah! Coba lagi.\nPetunjuk: *${game.hint}*`);
        }
    }
}

// =================== AI GEMINI (GRATIS) ===================
async function handleAI(msg, question) {
    await msg.reply('🤖 Sedang berpikir...');
    const botName = db.getBotName();
    const apiKey = process.env.GEMINI_API_KEY || config.GEMINI_API_KEY;

    try {
        const res = await axios.post(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
            {
                contents: [{
                    parts: [{
                        text: `Kamu adalah asisten WhatsApp bernama ${botName}. Jawab dalam Bahasa Indonesia yang santai dan singkat.\n\nPertanyaan: ${question}`
                    }]
                }]
            },
            { headers: { 'Content-Type': 'application/json' } }
        );

        const answer = res.data.candidates[0].content.parts[0].text;
        await msg.reply(`🤖 *${botName}:*\n\n${answer}`);
    } catch (e) {
        console.error('Gemini error:', e.message);
        await msg.reply('❌ AI sedang tidak bisa diakses. Coba lagi nanti.');
    }
}

// =================== AUTO REPLY ===================
function getAutoReply(body) {
    const replies = {
        'halo': '👋 Halo! Ketik *.menu* untuk melihat perintah.',
        'hai': '👋 Hai! Ketik *.menu* ya.',
        'hi': '👋 Hi! Ketik *.menu*.',
        'selamat pagi': '🌅 Selamat pagi!',
        'selamat siang': '☀️ Selamat siang!',
        'selamat malam': '🌙 Selamat malam!',
        'makasih': '😊 Sama-sama!',
        'terima kasih': '😊 Sama-sama!',
    };
    return replies[body] || null;
}

// =================== MENU ===================
function getHelpMenu(isPrivileged = false) {
    const botName = db.getBotName();
    let menu = `╔══════════════════╗
║  🤖 *${botName}*
╚══════════════════╝

🎵 *MUSIK*
▸ \`.play [judul]\` — Cari & kirim MP3

📥 *DOWNLOADER*
▸ \`.tiktok [link]\` — TikTok tanpa watermark
▸ \`.ig [link]\` — Instagram tanpa watermark

🧠 *AI ASISTEN*
▸ \`.ai [tanya]\` — Tanya AI asisten
▸ _(Chat pribadi langsung dibalas)_

🎮 *GAMES*
▸ \`.suit batu/gunting/kertas\`
▸ \`.tebak\` — Mulai tebak kata
▸ \`.jawab [kata]\` — Jawab tebak kata

👥 *GRUP (Admin)*
▸ \`.h\` — Tag semua anggota
▸ \`.kick @user\` — Kick anggota
▸ \`.promote @user\` — Jadikan admin
▸ \`.demote @user\` — Copot admin
▸ \`.hidetag [pesan]\` — Tag tersembunyi

⏱️ *BATAS PERINTAH*
▸ Maks 5 perintah per 2 menit`;

    if (isPrivileged) {
        menu += `

👑 *OWNER / ADMIN BOT*
▸ \`.namabot [nama]\` — Ganti nama bot
▸ \`.addadmin @user\` — Tambah admin bot
▸ \`.deladmin @user\` — Copot admin bot
▸ \`.listadmin\` — Daftar admin bot`;
    }

    menu += `\n\n━━━━━━━━━━━━━━━━━━\n💡 Powered by *${botName}*`;
    return menu;
}

client.initialize();
