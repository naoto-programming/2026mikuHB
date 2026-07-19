ObjC.import('Foundation');
function readFile(path) {
    const data = $.NSString.stringWithContentsOfFileEncodingError($(path), $.NSUTF8StringEncoding, null);
    return ObjC.unwrap(data);
}
eval(readFile('./game.js'));
const { Player, CHARACTER_GIMMICKS, RhythmSystem, AudioSystem, GIMMICK_NORMAL_SECONDS, GIMMICK_SPECIAL_SECONDS } = globalThis.GameLogic;

// CHARACTER_GIMMICKSは全6キャラに2つずつギミックを定義している
['swordsman', 'archer', 'thief', 'fighter', 'beast', 'mage'].forEach(id => {
    if (!Array.isArray(CHARACTER_GIMMICKS[id]) || CHARACTER_GIMMICKS[id].length !== 2) {
        throw new Error(id + ' should have exactly 2 gimmick definitions');
    }
});

const expectedSpecials = {
    swordsman: ['flickUpNote', 'giantNote'],
    archer: ['corruptedNote', 'launchNote'],
    thief: ['resonanceShake', 'rapidFire'],
    fighter: ['steppedMotion', 'flipMirror'],
    beast: ['invisibleApproach', 'centerJudgeCircle'],
    mage: ['driftingJudgeLine', 'eventNote'],
};
Object.keys(expectedSpecials).forEach(id => {
    expectedSpecials[id].forEach((special, i) => {
        if (CHARACTER_GIMMICKS[id][i].special !== special) {
            throw new Error(id + '[' + i + '].special should be ' + special + ', got ' + CHARACTER_GIMMICKS[id][i].special);
        }
    });
});

// 初期状態はnormalフェーズで、getActiveGimmickは空オブジェクトを返す
const p = new Player('p1', 'thief', true);
if (p.gimmickPhase !== 'normal') throw new Error('gimmickPhase should start as normal');
if (Object.keys(p.getActiveGimmick()).length !== 0) throw new Error('getActiveGimmick should return {} during the normal phase');

// GIMMICK_NORMAL_SECONDS経過するとspecialフェーズに切り替わり、該当キャラのギミックが返る
p.update(GIMMICK_NORMAL_SECONDS + 0.1, 0, []);
if (p.gimmickPhase !== 'special') throw new Error('gimmickPhase should switch to special after GIMMICK_NORMAL_SECONDS');
const active = p.getActiveGimmick();
const expectedFirst = CHARACTER_GIMMICKS.thief[0];
if (JSON.stringify(active) !== JSON.stringify(expectedFirst)) {
    throw new Error('active gimmick should match CHARACTER_GIMMICKS.thief[0], got ' + JSON.stringify(active));
}

// さらにGIMMICK_SPECIAL_SECONDS経過するとnormalに戻る
p.update(GIMMICK_SPECIAL_SECONDS + 0.1, 0, []);
if (p.gimmickPhase !== 'normal') throw new Error('gimmickPhase should return to normal after the special phase elapses');

// 次のspecialフェーズではgimmickIndexが反転し、2つ目のギミックになる
p.update(GIMMICK_NORMAL_SECONDS + 0.1, 0, []);
const active2 = p.getActiveGimmick();
const expectedSecond = CHARACTER_GIMMICKS.thief[1];
if (JSON.stringify(active2) !== JSON.stringify(expectedSecond)) {
    throw new Error('second special phase should use CHARACTER_GIMMICKS.thief[1], got ' + JSON.stringify(active2));
}

// RhythmSystem.startSwordBurstはgimmick.burstExtra分だけノーツを追加する
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
const audio = makeAudio();
const rhythm = new RhythmSystem(audio);
rhythm.startSwordBurst(4, {});
const baseLen = rhythm.swordNotes.length;
const rhythm2 = new RhythmSystem(audio);
rhythm2.startSwordBurst(4, { burstExtra: 2 });
if (rhythm2.swordNotes.length !== baseLen + 2) {
    throw new Error('burstExtra should add extra notes to the sword burst, expected ' + (baseLen + 2) + ' got ' + rhythm2.swordNotes.length);
}

// checkInputAnyはgimmick.judgeWindowMultで判定窓を縮小できる
const rhythm3 = new RhythmSystem(audio);
rhythm3.startSwordBurst(4, {});
// startSwordBurstはランダムなバーストパターンを選ぶため、note[0]以外のノーツが
// 偶然この後設定するcurrentTimeと同じタイミングになりヒットしてしまうことがある
// （ヒットするとplayHitSound経由でこのモックにないcreateOscillatorを呼びクラッシュする）。
// note[0]だけを判定対象にしたいので、他のノーツは判定から除外しておく。
rhythm3.swordNotes.forEach((n, i) => { if (i > 0) n.missed = true; });
const beatInterval = 60 / audio.bpm;
audio.ctx.currentTime = (rhythm3.swordNotes[0].beat * beatInterval) + 0.25; // GOOD_WINDOW(0.30)以内だが縮小後窓の外
const resultNarrow = rhythm3.checkInputAny({ judgeWindowMult: 0.5 });
if (resultNarrow !== null) throw new Error('a narrowed judge window should miss a note that a normal window would catch');

// judgeWindowMultは防御ノーツには適用されない（ダメージ回避に直結するため）
const audio4 = makeAudio();
const rhythm4 = new RhythmSystem(audio4);
rhythm4.generateDefendNote(1);
const beatInterval4 = 60 / audio4.bpm;
audio4.ctx.currentTime = (1 * beatInterval4) + 0.25; // GOOD_WINDOW(0.30)以内、縮小後窓(0.15)の外
const defendResult = rhythm4.checkInputAny({ judgeWindowMult: 0.5 });
if (defendResult === null || defendResult.note.type !== 'defend') {
    throw new Error('judgeWindowMult should not narrow the defend window, expected a defend hit but got ' + JSON.stringify(defendResult));
}
const checkInputDefendResult = (() => {
    const audio5 = makeAudio();
    const rhythm5 = new RhythmSystem(audio5);
    rhythm5.generateDefendNote(1);
    const beatInterval5 = 60 / audio5.bpm;
    audio5.ctx.currentTime = (1 * beatInterval5) + 0.25;
    return rhythm5.checkInput('defend', { judgeWindowMult: 0.5 });
})();
if (checkInputDefendResult === null) {
    throw new Error('checkInput should not narrow the defend window via judgeWindowMult either');
}

console.log('CHARACTER GIMMICKS OK');
