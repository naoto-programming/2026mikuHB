ObjC.import('Foundation');
function readFile(path) {
    const data = $.NSString.stringWithContentsOfFileEncodingError($(path), $.NSUTF8StringEncoding, null);
    return ObjC.unwrap(data);
}
eval(readFile('./game.js'));
const { RhythmSystem, AudioSystem } = globalThis.GameLogic;

function makeAudio() {
    const audio = new AudioSystem();
    audio.bpm = 120;
    audio.isPlaying = true;
    audio.ctx = {
        currentTime: 0,
        createOscillator() { return { connect(){}, start(){}, stop(){}, frequency:{setValueAtTime(){}, exponentialRampToValueAtTime(){}} }; },
        createGain() { return { connect(){}, gain:{value:0, setValueAtTime(){}, exponentialRampToValueAtTime(){}} }; },
        createBufferSource() { return { connect(){}, start(){}, stop(){} }; },
        createBuffer() { return { getChannelData(){ return new Float32Array(100); } }; },
        createBiquadFilter() { return { connect(){}, frequency:{value:0} }; },
    };
    audio.startTime = 0;
    return audio;
}

// markRandomNoteCorruptedは既存の攻撃/能力/カウンターノーツの1つに感染フラグを立てる
// (専用の独立したノーツを新たに生成するわけではない)
const audio = makeAudio();
const rhythm = new RhythmSystem(audio);
rhythm.startSwordBurst(4, {});
const baseCount = rhythm.swordNotes.length;
if (!rhythm.markRandomNoteCorrupted()) throw new Error('markRandomNoteCorrupted should succeed when candidate notes exist');
if (rhythm.swordNotes.length !== baseCount) throw new Error('markRandomNoteCorrupted should not create a new note, only flag an existing one');
if (!rhythm.swordNotes.some(n => n.corrupted)) throw new Error('one of the existing sword notes should now be flagged corrupted');
if (!rhythm.hasCorruptedNote()) throw new Error('hasCorruptedNote should report true once a note is corrupted');

// 既に感染ノーツがある間は、追加でもう1つ感染させたりはしない（呼び出し側がhasCorruptedNoteで防ぐ）
const beatInterval = 60 / audio.bpm;
const corrupted = rhythm.swordNotes.find(n => n.corrupted);
audio.ctx.currentTime = corrupted.beat * beatInterval;
const result = rhythm.checkInputAny({});
if (!result || !result.note.corrupted) throw new Error('checkInputAny should resolve the corrupted note like any other note of its type, got ' + JSON.stringify(result));
if (result.note.type !== 'sword') throw new Error('a corrupted note keeps its original underlying type (sword/ability/defend), it is not a separate note type');

console.log('CORRUPTED NOTE GIMMICK OK');
