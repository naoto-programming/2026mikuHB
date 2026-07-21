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

// 弓士A「ウイルス化」: ノーツが生成される瞬間にだけ、その新規ノーツ群の1つに感染フラグを
// 立てる(専用の独立したノーツを新たに生成するわけではない)。ギミックが有効でなければ感染しない
const audio = makeAudio();
const rhythm = new RhythmSystem(audio);
rhythm.startSwordBurst(4, {}); // ギミック無効時は感染しない
if (rhythm.hasCorruptedNote()) throw new Error('spawning notes without the corruptedNote gimmick active should never corrupt a note');

const audioB = makeAudio();
const rhythmB = new RhythmSystem(audioB);
rhythmB.startSwordBurst(4, { special: 'corruptedNote' });
const baseCount = rhythmB.swordNotes.length;
if (rhythmB.swordNotes.length !== baseCount) throw new Error('spawning with the gimmick active should not create a new note, only flag an existing one');
if (!rhythmB.swordNotes.some(n => n.corrupted)) throw new Error('one of the newly spawned sword notes should now be flagged corrupted');
if (!rhythmB.hasCorruptedNote()) throw new Error('hasCorruptedNote should report true once a note is corrupted');

// 既に感染ノーツが残っている間は、別のノーツ生成(防御ノーツ等、既存ノーツを上書きしない生成)が
// 起きても追加でもう1つ感染させたりはしない
rhythmB.generateDefendNote(rhythmB.swordNotes[0].beat + 10, { special: 'corruptedNote' });
const totalCorrupted = rhythmB.swordNotes.filter(n => n.corrupted).length + rhythmB.defendNotes.filter(n => n.corrupted).length;
if (totalCorrupted !== 1) {
    throw new Error('only one note should ever be corrupted at a time while an existing corrupted note remains unresolved, got ' + totalCorrupted);
}

// checkInputAnyは感染ノーツを元の種別のまま通常通り判定する
const beatInterval = 60 / audioB.bpm;
const corrupted = rhythmB.swordNotes.find(n => n.corrupted);
audioB.ctx.currentTime = corrupted.beat * beatInterval;
const result = rhythmB.checkInputAny({});
if (!result || !result.note.corrupted) throw new Error('checkInputAny should resolve the corrupted note like any other note of its type, got ' + JSON.stringify(result));
if (result.note.type !== 'sword') throw new Error('a corrupted note keeps its original underlying type (sword/ability/defend), it is not a separate note type');

// 出現済み(既に画面に流れている)ノーツを後から感染させることはない。
// 出現時にギミックが無効だったノーツは、その後ギミックが有効になっても遡って感染しない
const audioC = makeAudio();
const rhythmC = new RhythmSystem(audioC);
rhythmC.generateDefendNote(2); // ギミック無効時に生成
rhythmC.generateDefendNote(3, { special: 'corruptedNote' }); // 有効になった後に生成
if (rhythmC.defendNotes[0].corrupted) throw new Error('a note spawned before the gimmick was active must never become corrupted retroactively');
if (!rhythmC.defendNotes[1].corrupted) throw new Error('a note spawned while the gimmick is active should be corrupted at spawn time');

// 感染ノーツは他の基本ノーツ(攻撃・能力・カウンター/回避)と同じタイミングには配置しない。
// 候補のうち他のノーツと同じbeatのものは選ばれず、重ならない候補だけが選ばれる
const audio2 = makeAudio();
const rhythm2 = new RhythmSystem(audio2);
rhythm2.abilityNotes.push({ id: rhythm2.noteId++, beat: 4, type: 'ability', hit: false, missed: false });
const collidingNote = { id: rhythm2.noteId++, beat: 4, type: 'sword', hit: false, missed: false };
const freeNote = { id: rhythm2.noteId++, beat: 5, type: 'sword', hit: false, missed: false };
rhythm2.swordNotes.push(collidingNote, freeNote);
rhythm2.maybeCorruptOnSpawn([collidingNote, freeNote], true);
if (collidingNote.corrupted) throw new Error('a note sharing its beat with another note must never be picked for corruption');
if (!freeNote.corrupted) throw new Error('the note with no beat collision should be the one picked for corruption');

// 重ならない候補が1つもなければ、今回は感染させない(強制はしない)
const audio2b = makeAudio();
const rhythm2b = new RhythmSystem(audio2b);
rhythm2b.abilityNotes.push({ id: rhythm2b.noteId++, beat: 4, type: 'ability', hit: false, missed: false });
const onlyCollidingNote = { id: rhythm2b.noteId++, beat: 4, type: 'sword', hit: false, missed: false };
rhythm2b.swordNotes.push(onlyCollidingNote);
const corrupted2b = rhythm2b.maybeCorruptOnSpawn([onlyCollidingNote], true);
if (corrupted2b) throw new Error('maybeCorruptOnSpawn should return false when every candidate collides with another note');
if (onlyCollidingNote.corrupted || rhythm2b.hasCorruptedNote()) {
    throw new Error('no note should be corrupted when every candidate shares a beat with another note');
}

// 逆方向: 既に感染ノーツが存在する状態で新しくノーツを生成する側(startSwordBurst等)も、
// その感染ノーツと同じ拍に重ならないよう自分の拍をずらす
const audio5x = makeAudio();
const rhythm5x = new RhythmSystem(audio5x);
rhythm5x.defendNotes.push({ id: rhythm5x.noteId++, beat: 4, type: 'defend', hit: false, missed: false, corrupted: true });
if (rhythm5x.getCorruptedNoteBeat() !== 4) throw new Error('getCorruptedNoteBeat should return the beat of the currently active corrupted note');
const collidingNew = { id: rhythm5x.noteId++, beat: 4, type: 'sword', hit: false, missed: false };
const freeNew = { id: rhythm5x.noteId++, beat: 5, type: 'sword', hit: false, missed: false };
rhythm5x.avoidCorruptedBeatCollisions([collidingNew, freeNew]);
if (collidingNew.beat === 4) throw new Error('a newly generated note landing on the corrupted note\'s beat should be nudged away');
if (freeNew.beat !== 5) throw new Error('a newly generated note not colliding with the corrupted beat should be left unchanged');

const audio5y = makeAudio();
const rhythm5y = new RhythmSystem(audio5y);
if (rhythm5y.getCorruptedNoteBeat() !== null) throw new Error('getCorruptedNoteBeat should return null when no note is corrupted');

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
