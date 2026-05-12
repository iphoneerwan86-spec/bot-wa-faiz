const axios = require('axios');

// =================== TIKTOK DOWNLOADER ===================
// Menggunakan API tikwm.com (gratis, tanpa watermark)
async function getTikTokVideo(url) {
    const apiUrl = `https://www.tikwm.com/api/`;
    const response = await axios.post(apiUrl, new URLSearchParams({ url, count: 1, cursor: 0, web: 1, hd: 1 }), {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });

    const data = response.data;
    if (!data || data.code !== 0) throw new Error('Gagal mengambil data TikTok');

    const videoUrl = data.data.hdplay || data.data.play;
    if (!videoUrl) throw new Error('URL video tidak ditemukan');

    const videoRes = await axios.get(videoUrl, { responseType: 'arraybuffer', headers: { 'Referer': 'https://www.tiktok.com/' } });
    return Buffer.from(videoRes.data);
}

// =================== INSTAGRAM DOWNLOADER ===================
// Menggunakan instaloader API publik
async function getInstagramVideo(url) {
    // Ekstrak shortcode dari URL
    const match = url.match(/instagram\.com\/(?:p|reel|tv)\/([A-Za-z0-9_-]+)/);
    if (!match) throw new Error('URL Instagram tidak valid');
    const shortcode = match[1];

    // Gunakan API SaveFrom atau SnapInsta
    const apiUrl = `https://snapinsta.app/api/ajaxSearch`;
    const response = await axios.post(apiUrl,
        new URLSearchParams({ q: url, t: 'media', lang: 'id' }),
        { headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'Mozilla/5.0' } }
    );

    const html = response.data?.data || '';
    // Cari URL video dari response HTML
    const videoMatch = html.match(/href="(https:\/\/[^"]*\.mp4[^"]*)"/);
    if (!videoMatch) {
        // Coba cara alternatif: download langsung dari Instagram embed
        return await downloadIGDirect(shortcode);
    }

    const videoUrl = videoMatch[1].replace(/&amp;/g, '&');
    const videoRes = await axios.get(videoUrl, { responseType: 'arraybuffer' });
    return Buffer.from(videoRes.data);
}

// Fallback: Instagram oEmbed untuk dapat thumbnail/info
async function downloadIGDirect(shortcode) {
    const url = `https://www.instagram.com/p/${shortcode}/?__a=1&__d=dis`;
    const res = await axios.get(url, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X)',
            'Accept': 'application/json'
        }
    });
    const items = res.data?.items || res.data?.graphql?.shortcode_media;
    if (!items) throw new Error('Tidak bisa mengambil data Instagram');

    const videoUrl = Array.isArray(items)
        ? items[0]?.video_versions?.[0]?.url
        : items.video_url;

    if (!videoUrl) throw new Error('URL video tidak ditemukan');
    const videoRes = await axios.get(videoUrl, { responseType: 'arraybuffer' });
    return Buffer.from(videoRes.data);
}

module.exports = { getTikTokVideo, getInstagramVideo };
