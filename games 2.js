// =================== SUIT ===================
function suitResult(user, bot) {
    if (user === bot) return '🤝 *SERI!*';
    const wins = { batu: 'gunting', gunting: 'kertas', kertas: 'batu' };
    return wins[user] === bot ? '🎉 *KAMU MENANG!*' : '😅 *BOT MENANG!* Lebih beruntung lain kali!';
}

// =================== TEBAK KATA ===================
const wordList = [
    { word: 'apel', hint: 'Buah berwarna merah atau hijau' },
    { word: 'kucing', hint: 'Hewan peliharaan yang suka mengeong' },
    { word: 'matahari', hint: 'Benda langit yang menyinari bumi siang hari' },
    { word: 'komputer', hint: 'Perangkat elektronik untuk bekerja' },
    { word: 'sekolah', hint: 'Tempat belajar anak-anak' },
    { word: 'hujan', hint: 'Air yang turun dari langit' },
    { word: 'buku', hint: 'Media baca dari kertas' },
    { word: 'musik', hint: 'Seni menggunakan suara dan nada' },
    { word: 'mobil', hint: 'Kendaraan beroda empat' },
    { word: 'pohon', hint: 'Tumbuhan besar penghasil oksigen' },
    { word: 'bulan', hint: 'Satelit alami bumi yang bersinar malam' },
    { word: 'lautan', hint: 'Kumpulan air asin yang sangat luas' },
    { word: 'nasi', hint: 'Makanan pokok orang Indonesia' },
    { word: 'kamera', hint: 'Alat untuk mengambil foto atau video' },
    { word: 'telepon', hint: 'Alat komunikasi jarak jauh' },
    { word: 'sepatu', hint: 'Alas kaki di luar rumah' },
    { word: 'singa', hint: 'Raja hutan dari Afrika' },
    { word: 'awan', hint: 'Kumpulan uap air di langit' },
    { word: 'jembatan', hint: 'Penghubung di atas sungai atau jurang' },
    { word: 'gitar', hint: 'Alat musik berdawai yang dipetik' },
    { word: 'panda', hint: 'Hewan berbulu hitam-putih dari China' },
    { word: 'dokter', hint: 'Profesi penyembuh orang sakit' },
    { word: 'pesawat', hint: 'Kendaraan yang terbang di udara' },
    { word: 'pantai', hint: 'Tepi laut dengan pasir' },
    { word: 'kopi', hint: 'Minuman panas yang sering diminum pagi hari' },
];

function getRandomWord() {
    return wordList[Math.floor(Math.random() * wordList.length)];
}

function shuffleWord(word) {
    return word.split('').sort(() => Math.random() - 0.5).join('');
}

module.exports = { suitResult, getRandomWord, shuffleWord };
