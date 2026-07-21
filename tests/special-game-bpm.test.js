ObjC.import('Foundation');
function readFile(path) {
    const data = $.NSString.stringWithContentsOfFileEncodingError($(path), $.NSUTF8StringEncoding, null);
    return ObjC.unwrap(data);
}
// eval経由でgame.jsを読み込む(このリポジトリの全テストで使われている既存の
// JXA用ローダーパターン。ローカルの信頼済みファイルを読むだけで外部入力は扱わない)
eval(readFile('./game.js'));
const { detectBPM, AudioSystem } = globalThis.GameLogic;

// 既知のBPMのクリック列(一定間隔で音量が急上昇するインパルス)を含む疑似音声データを作り、
// detectBPMがそのテンポを正しく推定できるか検証する
function makeClickTrack(bpm, sampleRate, seconds) {
    const beatInterval = 60 / bpm;
    const length = Math.floor(sampleRate * seconds);
    const data = new Float32Array(length);
    for (let t = 0; t < seconds; t += beatInterval) {
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
const detected = detectBPM(buffer);
if (Math.abs(detected - knownBpm) > 3) {
    throw new Error(`detectBPM should recover a tempo close to ${knownBpm}, got ${detected}`);
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
