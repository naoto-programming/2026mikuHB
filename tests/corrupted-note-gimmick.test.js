ObjC.import('Foundation');
function readFile(path) {
    const data = $.NSString.stringWithContentsOfFileEncodingError($(path), $.NSUTF8StringEncoding, null);
    return ObjC.unwrap(data);
}
eval(readFile('./game.js'));
const { RhythmSystem, AudioSystem, CONSTANTS } = globalThis.GameLogic;

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

// 同じbeatに別のノーツがあると、片方だけ選ぶと強制ミスになってしまうため、
// 同じタイミングのノーツも道連れで感染する
const audio2 = makeAudio();
const rhythm2 = new RhythmSystem(audio2);
rhythm2.swordNotes.push({ id: rhythm2.noteId++, beat: 4, type: 'sword', hit: false, missed: false });
rhythm2.abilityNotes.push({ id: rhythm2.noteId++, beat: 4, type: 'ability', hit: false, missed: false });
rhythm2.markRandomNoteCorrupted();
if (!rhythm2.swordNotes[0].corrupted || !rhythm2.abilityNotes[0].corrupted) {
    throw new Error('notes sharing the same beat as the corrupted note should also become corrupted, so there is no forced miss');
}

// ウイルスノーツを無視して素通りさせると、通常のミス扱い(コンボ0)ではなく
// コンボが加算される(正しいプレイとして扱われる)
const audio3 = makeAudio();
const rhythm3 = new RhythmSystem(audio3);
rhythm3.combo = 5;
rhythm3.swordNotes.push({ id: rhythm3.noteId++, beat: 1, type: 'sword', hit: false, missed: false, corrupted: true });
const beatInterval3 = 60 / audio3.bpm;
audio3.ctx.currentTime = (1 * beatInterval3) + CONSTANTS.GOOD_WINDOW + 0.01; // 判定窓を過ぎて素通りさせる
rhythm3.update();
if (rhythm3.combo !== 6) throw new Error('letting a corrupted note pass by (ignoring it) should increment combo, got ' + rhythm3.combo);
if (!rhythm3.swordNotes[0].missed) throw new Error('the corrupted note should still be marked missed internally');

// 盗賊B「連打」中のノーツ(rapidFireNote)は発動時間内で完結する専用の仕組みのため、
// 取りこぼしても通常のコンボ切れ・被弾処理をしない
const audio4 = makeAudio();
const rhythm4 = new RhythmSystem(audio4);
rhythm4.combo = 5;
rhythm4.defendNotes.push({ id: rhythm4.noteId++, beat: 1, type: 'defend', hit: false, missed: false, rapidFireNote: true });
const beatInterval4 = 60 / audio4.bpm;
audio4.ctx.currentTime = (1 * beatInterval4) + CONSTANTS.GOOD_WINDOW + 0.01;
rhythm4.update();
if (rhythm4.combo !== 5) throw new Error('missing a rapidFireNote should not reset or change combo, got ' + rhythm4.combo);
if (rhythm4.defendMissThisFrame) throw new Error('missing a rapidFireNote defend note should not trigger the normal self-damage path');

console.log('CORRUPTED NOTE / SPECIAL-MISS-HANDLING GIMMICK OK');
