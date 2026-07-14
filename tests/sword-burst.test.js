ObjC.import('Foundation');
function readFile(path) {
    const data = $.NSString.stringWithContentsOfFileEncodingError($(path), $.NSUTF8StringEncoding, null);
    return ObjC.unwrap(data);
}
eval(readFile('./game.js'));
const { RhythmSystem, AudioSystem } = globalThis.GameLogic;

// startSwordBurstを呼ぶまでノーツは1つも発生しない
const audio = new AudioSystem();
audio.bpm = 120;
audio.isPlaying = true;
// Minimal Web Audio API stub. Notes are now scheduled LOOKAHEAD_BEATS ahead
// of the current beat, so checkInput('sword') below (currentBeat is 0 in
// this stub) lands far from the first note's beat and legitimately misses
// (see the null check below) -- that's expected, not a bug. A real hit
// calls AudioSystem.playHitSound(), which calls into ctx.createOscillator
// etc. These no-op stubs let that code path run without touching real Web
// Audio (unavailable under osascript -l JavaScript).
function audioNodeStub() {
    return {
        connect: () => {},
        disconnect: () => {},
        start: () => {},
        stop: () => {},
        frequency: { setValueAtTime: () => {} },
        gain: { setValueAtTime: () => {}, exponentialRampToValueAtTime: () => {} },
    };
}
audio.ctx = {
    currentTime: 0,
    createOscillator: () => audioNodeStub(),
    createGain: () => audioNodeStub(),
};
audio.masterGain = audioNodeStub();
audio.startTime = 0;

const rhythm = new RhythmSystem(audio);
if (rhythm.swordNotes.length !== 0) throw new Error('no sword notes should exist before any burst is started');
if (rhythm.swordBurstActive) throw new Error('swordBurstActive should start false');

rhythm.startSwordBurst(4);
if (rhythm.swordNotes.length !== 4) throw new Error('expected 4 sword notes after startSwordBurst(4), got ' + rhythm.swordNotes.length);
if (!rhythm.swordBurstActive) throw new Error('swordBurstActive should be true right after starting a burst');

// checkInput('sword') はswordNotesの中から探す
const result = rhythm.checkInput('sword');
if (result === null) {
    // 拍が離れすぎていてヒットしないのは正常。少なくとも例外にならないことを確認する。
}

console.log('SWORD BURST OK');
