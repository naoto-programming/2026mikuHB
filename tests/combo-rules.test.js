ObjC.import('Foundation');
function readFile(path) {
    const data = $.NSString.stringWithContentsOfFileEncodingError($(path), $.NSUTF8StringEncoding, null);
    return ObjC.unwrap(data);
}
eval(readFile('./game.js'));
const { RhythmSystem, AudioSystem, CONSTANTS } = globalThis.GameLogic;

function audioNodeStub() {
    return {
        connect: () => {},
        disconnect: () => {},
        start: () => {},
        stop: () => {},
        frequency: { setValueAtTime: () => {}, exponentialRampToValueAtTime: () => {} },
        gain: { setValueAtTime: () => {}, exponentialRampToValueAtTime: () => {} },
    };
}
function makeAudio() {
    const audio = new AudioSystem();
    audio.bpm = 120;
    audio.isPlaying = true;
    audio.ctx = {
        currentTime: 0,
        createOscillator: () => audioNodeStub(),
        createGain: () => audioNodeStub(),
    };
    audio.masterGain = audioNodeStub();
    audio.startTime = 0;
    return audio;
}

// パーフェクト/グレイトはコンボ+1、グッド(タイミングが早すぎ/遅すぎ)とミス(取りこぼし)は
// どちらもコンボをリセットする
const audio = makeAudio();
const rhythm = new RhythmSystem(audio);
const beatInterval = 60 / audio.bpm;

function makeNote(beat, type) {
    return { id: rhythm.noteId++, beat, type, hit: false, missed: false };
}

// Perfect: ちょうど拍のタイミング
rhythm.swordNotes.push(makeNote(1, 'sword'));
audio.ctx.currentTime = 1 * beatInterval;
const r1 = rhythm.checkInput('sword');
if (r1.judge !== 'perfect') throw new Error('expected perfect, got ' + r1.judge);
if (rhythm.combo !== 1) throw new Error('perfect should increment combo to 1, got ' + rhythm.combo);

// Great: PERFECT_WINDOWの外、GREAT_WINDOWの内
rhythm.swordNotes.push(makeNote(2, 'sword'));
audio.ctx.currentTime = (2 * beatInterval) + 0.12; // PERFECT(0.09)超え、GREAT(0.18)以内
const r2 = rhythm.checkInput('sword');
if (r2.judge !== 'great') throw new Error('expected great, got ' + r2.judge);
if (rhythm.combo !== 2) throw new Error('great should increment combo to 2, got ' + rhythm.combo);

// Good: GREAT_WINDOWの外、GOOD_WINDOWの内(タイミングが早すぎ/遅すぎでも辛うじて成功)。
// パーフェクト/グレイトの正確なタイミングだけがコンボを伸ばす仕様のため、
// グッドはミスと同様にコンボをリセットする
rhythm.swordNotes.push(makeNote(3, 'sword'));
audio.ctx.currentTime = (3 * beatInterval) + 0.25; // GREAT(0.18)超え、GOOD(0.30)以内
const r3 = rhythm.checkInput('sword');
if (r3.judge !== 'good') throw new Error('expected good, got ' + r3.judge);
if (rhythm.combo !== 0) throw new Error('good (a mistimed hit) should reset the combo just like a miss, got ' + rhythm.combo);

// Miss(取りこぼし): コンボをリセットする(グッドで既に0になっているため、一度パーフェクトで
// 積み直してから取りこぼす)
rhythm.swordNotes.push(makeNote(4, 'sword'));
audio.ctx.currentTime = 4 * beatInterval;
const r3b = rhythm.checkInput('sword');
if (r3b.judge !== 'perfect') throw new Error('expected perfect, got ' + r3b.judge);
if (rhythm.combo !== 1) throw new Error('perfect should increment combo to 1, got ' + rhythm.combo);

rhythm.swordNotes.push(makeNote(5, 'sword'));
audio.ctx.currentTime = (5 * beatInterval) + CONSTANTS.GOOD_WINDOW + 0.01;
rhythm.update();
if (rhythm.combo !== 0) throw new Error('missing a note (letting it pass) should reset combo to 0, got ' + rhythm.combo);

// 能力ノーツも1つずつ実際の判定(パーフェクト等)を返し、判定演出用のonJudgeも呼ばれる。
// 攻撃・防御ノーツと同じくパーフェクト/グレイトはコンボを伸ばす(スコアには影響させない)
const audio2 = makeAudio();
const rhythm2 = new RhythmSystem(audio2);
rhythm2.combo = 5;
rhythm2.abilityActive = true;
rhythm2.abilityNotes.push(makeNote(1, 'ability'));
let onJudgeCalls = [];
rhythm2.onJudge = (judge, points, combo) => onJudgeCalls.push({ judge, points, combo });
const beatInterval2 = 60 / audio2.bpm;
audio2.ctx.currentTime = 1 * beatInterval2; // ちょうど拍(perfect相当)
const abilityResult = rhythm2.checkInput('ability');
if (abilityResult.judge !== 'perfect') throw new Error('ability notes should report their real judge (perfect), got ' + abilityResult.judge);
if (rhythm2.combo !== 6) throw new Error('a perfect ability note hit should increment combo just like sword/defend notes, expected 6, got ' + rhythm2.combo);
if (onJudgeCalls.length !== 1 || onJudgeCalls[0].judge !== 'perfect') {
    throw new Error('hitting an ability note should still fire onJudge with its real judge, so a per-note effect can be shown');
}
if (onJudgeCalls[0].combo !== 6) {
    throw new Error('onJudge for an ability note should report the updated combo, got ' + onJudgeCalls[0].combo);
}

console.log('COMBO RULES OK');
