ObjC.import('Foundation');
function readFile(path) {
    const data = $.NSString.stringWithContentsOfFileEncodingError($(path), $.NSUTF8StringEncoding, null);
    return ObjC.unwrap(data);
}
eval(readFile('./game.js'));
const { Player, CHARACTER_GIMMICKS, RhythmSystem, AudioSystem } = globalThis.GameLogic;

// CHARACTER_GIMMICKSは全6キャラに2つずつギミックを定義している
['swordsman', 'archer', 'thief', 'fighter', 'beast', 'mage'].forEach(id => {
    if (!Array.isArray(CHARACTER_GIMMICKS[id]) || CHARACTER_GIMMICKS[id].length !== 2) {
        throw new Error(id + ' should have exactly 2 gimmick definitions');
    }
});

// 初期状態はnormalフェーズで、getActiveGimmickは空オブジェクトを返す
const p = new Player('p1', 'thief', true);
if (p.gimmickPhase !== 'normal') throw new Error('gimmickPhase should start as normal');
if (Object.keys(p.getActiveGimmick()).length !== 0) throw new Error('getActiveGimmick should return {} during the normal phase');

// 20秒経過するとspecialフェーズに切り替わり、該当キャラのギミックが返る
p.update(20.1, 0, []);
if (p.gimmickPhase !== 'special') throw new Error('gimmickPhase should switch to special after 20s');
const active = p.getActiveGimmick();
const expectedFirst = CHARACTER_GIMMICKS.thief[0];
if (JSON.stringify(active) !== JSON.stringify(expectedFirst)) {
    throw new Error('active gimmick should match CHARACTER_GIMMICKS.thief[0], got ' + JSON.stringify(active));
}

// さらに8秒経過するとnormalに戻る
p.update(8.1, 0, []);
if (p.gimmickPhase !== 'normal') throw new Error('gimmickPhase should return to normal after the special phase elapses');

// 次のspecialフェーズではgimmickIndexが反転し、2つ目のギミックになる
p.update(20.1, 0, []);
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
    audio.ctx = { currentTime: 0 };
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

console.log('CHARACTER GIMMICKS OK');
