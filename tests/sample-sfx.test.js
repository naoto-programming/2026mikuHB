ObjC.import('Foundation');
function readFile(path) {
    const data = $.NSString.stringWithContentsOfFileEncodingError($(path), $.NSUTF8StringEncoding, null);
    return ObjC.unwrap(data);
}
eval(readFile('./game.js'));
const { AudioSystem, SFX_FILES } = globalThis.GameLogic;

// SFX_FILESが期待する4種のキー・ファイル名を持つ
const expectedKeys = ['tick', 'perfectHit', 'ability', 'attack'];
expectedKeys.forEach(k => {
    if (!SFX_FILES[k]) throw new Error('SFX_FILES should define a file for key: ' + k);
});

function makeAudio() {
    const audio = new AudioSystem();
    let createBufferSourceCalls = 0;
    audio.ctx = {
        currentTime: 0,
        createBufferSource() {
            createBufferSourceCalls++;
            return { connect(){}, start(){}, stop(){}, buffer: null };
        },
    };
    audio.masterGain = { connect(){} };
    audio._getCreateBufferSourceCalls = () => createBufferSourceCalls;
    return audio;
}

// バッファが未ロードの間はplaySfxが何もしない（例外を投げない）
{
    const audio = makeAudio();
    audio.playSfx('attack'); // _bufferCache未設定
    if (audio._getCreateBufferSourceCalls() !== 0) throw new Error('playSfx should not play anything before the buffer is loaded');
}

// バッファがキャッシュ済みならcreateBufferSourceで再生する
{
    const audio = makeAudio();
    audio._bufferCache = { [SFX_FILES.attack]: { fakeBuffer: true } };
    audio.playSfx('attack');
    if (audio._getCreateBufferSourceCalls() !== 1) throw new Error('playSfx should play the cached buffer via createBufferSource');
}

console.log('SAMPLE SFX OK');
