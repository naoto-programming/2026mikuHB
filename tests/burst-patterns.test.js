ObjC.import('Foundation');
function readFile(path) {
    const data = $.NSString.stringWithContentsOfFileEncodingError($(path), $.NSUTF8StringEncoding, null);
    return ObjC.unwrap(data);
}
eval(readFile('./game.js'));
const { RhythmSystem, AudioSystem, BURST_PATTERNS } = globalThis.GameLogic;

if (!Array.isArray(BURST_PATTERNS) || BURST_PATTERNS.length < 2) throw new Error('BURST_PATTERNS should contain multiple patterns');

const audio = new AudioSystem();
audio.bpm = 120;
audio.isPlaying = true;
audio.ctx = { currentTime: 0 };
audio.startTime = 0;

const seenPatterns = new Set();
for (let i = 0; i < 50; i++) {
    const rhythm = new RhythmSystem(audio);
    rhythm.startSwordBurst(4);
    const beats = rhythm.swordNotes.map(n => n.beat - rhythm.swordBurstStartBeat);
    seenPatterns.add(JSON.stringify(beats));
}
if (seenPatterns.size < 2) throw new Error('startSwordBurst should pick from more than one rhythm pattern across many calls');

console.log('BURST PATTERNS OK');
