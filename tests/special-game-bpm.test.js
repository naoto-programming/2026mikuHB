ObjC.import('Foundation');
function readFile(path) {
    const data = $.NSString.stringWithContentsOfFileEncodingError($(path), $.NSUTF8StringEncoding, null);
    return ObjC.unwrap(data);
}
// eval経由でgame.jsを読み込む(このリポジトリの全テストで使われている既存の
// JXA用ローダーパターン。ローカルの信頼済みファイルを読むだけで外部入力は扱わない)
eval(readFile('./game.js'));
const { detectBeatGrid, AudioSystem } = globalThis.GameLogic;

// 既知のBPM・開始位相のクリック列(一定間隔で音量が急上昇するインパルス)を含む疑似音声
// データを作り、detectBeatGridがそのテンポと拍の開始位置の両方を正しく推定できるか検証する
function makeClickTrack(bpm, sampleRate, seconds, leadInSeconds = 0) {
    const beatInterval = 60 / bpm;
    const length = Math.floor(sampleRate * seconds);
    const data = new Float32Array(length);
    for (let t = leadInSeconds; t < seconds; t += beatInterval) {
        const start = Math.floor(t * sampleRate);
        // 短いクリック(数msの矩形パルス)を打つ
        for (let i = 0; i < sampleRate * 0.02 && start + i < length; i++) {
            data[start + i] = 0.9;
        }
    }
    return {
        sampleRate,
        duration: seconds,
        getChannelData: () => data,
    };
}

const sampleRate = 44100;
const knownBpm = 120;
const buffer = makeClickTrack(knownBpm, sampleRate, 10);
const { bpm: detected } = detectBeatGrid(buffer);
if (Math.abs(detected - knownBpm) > 3) {
    throw new Error(`detectBeatGrid should recover a tempo close to ${knownBpm}, got ${detected}`);
}

// 曲の先頭に前奏(無音)があり、最初のダウンビートが0秒目でない場合でも、
// 拍の開始位相(offsetSeconds)がその前奏の長さに近い値として検出できる
const leadIn = 1.37;
const bufferWithLeadIn = makeClickTrack(knownBpm, sampleRate, 10, leadIn);
const { bpm: detectedWithLeadIn, offsetSeconds } = detectBeatGrid(bufferWithLeadIn);
if (Math.abs(detectedWithLeadIn - knownBpm) > 3) {
    throw new Error(`detectBeatGrid should still recover the tempo with a lead-in, got ${detectedWithLeadIn}`);
}
// 拍間隔を法として比較する(検出された位相は複数拍分ずれていても、間隔を法にすれば
// 前奏の長さと一致するはず)
const beatInterval = 60 / detectedWithLeadIn;
const phaseDiff = Math.abs(((offsetSeconds - leadIn + beatInterval / 2) % beatInterval + beatInterval) % beatInterval - beatInterval / 2);
if (phaseDiff > 0.05) {
    throw new Error(`detectBeatGrid's offsetSeconds should align with the lead-in (${leadIn}s), got offset ${offsetSeconds}s (phase diff ${phaseDiff}s)`);
}

// AudioSystem.setPreloadedBufferは、通常loadTrackが行うfetch/decodeを介さずに
// 直接キャッシュへ登録できる(特別ゲームでアップロード済みバッファを使い回すため)
const audio = new AudioSystem();
const fakeBuffer = { duration: 12.3 };
audio.setPreloadedBuffer('__special_upload__', fakeBuffer);
if (audio._bufferCache['__special_upload__'] !== fakeBuffer) {
    throw new Error('setPreloadedBuffer should register the buffer under the given key in _bufferCache');
}

console.log('SPECIAL GAME BPM DETECTION OK');
