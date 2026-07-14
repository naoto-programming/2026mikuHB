ObjC.import('Foundation');
function readFile(path) {
    const data = $.NSString.stringWithContentsOfFileEncodingError($(path), $.NSUTF8StringEncoding, null);
    return ObjC.unwrap(data);
}
eval(readFile('./game.js'));
const { RhythmSystem, AudioSystem } = globalThis.GameLogic;

const audio = new AudioSystem();
audio.bpm = 120;
audio.isPlaying = true;
audio.ctx = { currentTime: 10 };
audio.startTime = 0; // currentBeat = 10 * (120/60) = 20

const rhythm = new RhythmSystem(audio);

if (typeof rhythm.findDefendNoteAtBeat !== 'function') throw new Error('RhythmSystem.findDefendNoteAtBeat should exist');

rhythm.generateDefendNote(22);
const found = rhythm.findDefendNoteAtBeat(22);
if (!found) throw new Error('findDefendNoteAtBeat should find a note scheduled at that beat');
if (rhythm.findDefendNoteAtBeat(23)) throw new Error('findDefendNoteAtBeat should not find a note at a different beat');

// 既にhit/missed済みのノーツは「既存扱い」しない（新しい防御ノーツが必要）
found.hit = true;
if (rhythm.findDefendNoteAtBeat(22)) throw new Error('findDefendNoteAtBeat should ignore already-resolved notes');

console.log('DEFEND BEAT QUANTIZE OK');
