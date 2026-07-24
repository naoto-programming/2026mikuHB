ObjC.import('Foundation');
function readFile(path) {
    const data = $.NSString.stringWithContentsOfFileEncodingError($(path), $.NSUTF8StringEncoding, null);
    return ObjC.unwrap(data);
}
eval(readFile('./game.js'));
const { RhythmSystem, AudioSystem, CHARACTER_GIMMICKS, Player, Enemy, applyAbility, CHARACTERS,
    ABILITY_STEAL_POWER_MULT, ABILITY_STEAL_PENDING_BEATS, ABILITY_FUSION_POWER_MULT, ABILITY_FUSION_TABLE,
    ABILITY_FUSION_RECOIL_RATIO,
    RAPID_NOTE_WINDOW_TOTAL_BEATS, RAPID_NOTE_EARLY_WINDOW_BEATS, RAPID_NOTE_LATE_WINDOW_BEATS } = globalThis.GameLogic;

function makeAudio() {
    const audio = new AudioSystem();
    audio.bpm = 120;
    audio.isPlaying = true;
    audio.ctx = { currentTime: 0 };
    audio.startTime = 0;
    return audio;
}

function audioNodeStub() {
    return {
        connect: () => {}, disconnect: () => {}, start: () => {}, stop: () => {},
        frequency: { setValueAtTime: () => {}, exponentialRampToValueAtTime: () => {} },
        gain: { setValueAtTime: () => {}, exponentialRampToValueAtTime: () => {} },
    };
}
// playHitSound等が実際に音を鳴らそうとしても落ちないよう、Web Audioの最小限のスタブを持つ
// AudioSystemを作る(makeAudio()はcheckInputを直接呼ばないテストで使う軽量版のため分けている)
function makeAudioWithSoundStub() {
    const audio = makeAudio();
    audio.ctx.createOscillator = () => audioNodeStub();
    audio.ctx.createGain = () => audioNodeStub();
    audio.masterGain = audioNodeStub();
    return audio;
}

// 盗賊のギミックは元の割り当てのまま: A「能力泥棒」(abilitySteal)とB「連打」(rapidFire)
if (CHARACTER_GIMMICKS.thief[0].special !== 'abilitySteal') {
    throw new Error("thief gimmick[0] should be abilitySteal, got " + CHARACTER_GIMMICKS.thief[0].special);
}
if (CHARACTER_GIMMICKS.thief[1].special !== 'rapidFire') {
    throw new Error("thief gimmick[1] should still be rapidFire, got " + CHARACTER_GIMMICKS.thief[1].special);
}

// 盗賊A「能力泥棒」: 単独発動・融合技それぞれの弱体化倍率がまともな値になっていることを確認
if (!(ABILITY_STEAL_POWER_MULT > 0 && ABILITY_STEAL_POWER_MULT < 1)) {
    throw new Error('a solo stolen ability should be weakened (powerMult between 0 and 1), got ' + ABILITY_STEAL_POWER_MULT);
}
if (!(ABILITY_FUSION_POWER_MULT > 0 && ABILITY_FUSION_POWER_MULT < 1)) {
    throw new Error('a fusion ability should also be weakened (powerMult between 0 and 1), got ' + ABILITY_FUSION_POWER_MULT);
}
if (!(ABILITY_STEAL_PENDING_BEATS > 0)) throw new Error('ABILITY_STEAL_PENDING_BEATS should be a positive number of beats');
// 融合技は単独発動より強力なため、使い放題にならないよう発動のたびに反動ダメージを
// 受けるデメリットを持たせてある(最大HPに対する割合として、0より大きく小さすぎない値)
if (!(ABILITY_FUSION_RECOIL_RATIO > 0 && ABILITY_FUSION_RECOIL_RATIO < 0.3)) {
    throw new Error('a fusion technique should cost some noticeable but not overwhelming recoil damage, got ' + ABILITY_FUSION_RECOIL_RATIO);
}

// 融合技テーブル: 6職業の総当たり(15通り)全てに専用の融合技が定義されており、
// それぞれ固有の名前・有効なshapeを持っていることを確認する
{
    const ids = CHARACTERS.map(c => c.id);
    const expectedPairs = [];
    for (let i = 0; i < ids.length; i++) {
        for (let j = i + 1; j < ids.length; j++) {
            expectedPairs.push([ids[i], ids[j]].sort().join('+'));
        }
    }
    if (expectedPairs.length !== 15) throw new Error('expected 15 unordered pairs from 6 characters, got ' + expectedPairs.length);
    expectedPairs.forEach(key => {
        const config = ABILITY_FUSION_TABLE[key];
        if (!config) throw new Error('missing a fusion entry for pair: ' + key);
        if (!config.name) throw new Error('fusion entry for ' + key + ' is missing a name');
        if (!['circle', 'directional', 'random'].includes(config.shape)) {
            throw new Error('fusion entry for ' + key + ' has an invalid shape: ' + config.shape);
        }
        if (!['weak', 'medium', 'strong'].includes(config.tier)) {
            throw new Error('fusion entry for ' + key + ' has an invalid tier: ' + config.tier);
        }
    });
    // 全ての名前が重複なくユニークであること(組み合わせごとに本当に別物と分かるように)
    const names = new Set(expectedPairs.map(key => ABILITY_FUSION_TABLE[key].name));
    if (names.size !== expectedPairs.length) throw new Error('fusion technique names should all be unique across the 15 pairs');
}

// applyAbilityのpowerMultは、能力泥棒が弱体化した性能で他の職業の能力を借りて発動するために
// 使う。同じ入力でpowerMultだけを下げれば、与えるダメージも比例して下がる
{
    const player = new Player('p1', 'thief', true);
    const fullEnemy = new Enemy('normal', 100, 0, 1);
    const weakEnemy = new Enemy('normal', 100, 0, 1);
    const fullOutcome = applyAbility('swordsman', 1, player, [fullEnemy], 0, 1);
    const weakOutcome = applyAbility('swordsman', 1, player, [weakEnemy], 0, ABILITY_STEAL_POWER_MULT);
    if (!(weakOutcome.hits[0].dmg < fullOutcome.hits[0].dmg)) {
        throw new Error('a lower powerMult should deal less damage than the default (1), full=' + fullOutcome.hits[0].dmg + ' weak=' + weakOutcome.hits[0].dmg);
    }
    // 盗賊自身の「4回攻撃」はpower変数を使わずdmgを直接計算しているため、個別に確認する
    const fullThief = applyAbility('thief', 1, player, [new Enemy('normal', 50, 0, 1)], 0, 1);
    const weakThief = applyAbility('thief', 1, player, [new Enemy('normal', 50, 0, 1)], 0, ABILITY_STEAL_POWER_MULT);
    if (!(weakThief.hits[0].dmg < fullThief.hits[0].dmg)) {
        throw new Error('powerMult should also weaken the thief\'s own ability formula, full=' + fullThief.hits[0].dmg + ' weak=' + weakThief.hits[0].dmg);
    }
}

// RhythmSystem.update(): 盗賊「能力泥棒」・「連打」いずれの最中もability_completeの誤判定を
// 起こさない(どちらもability notesを継続的に注ぎ足すため、abilityStartBeat/abilityLengthが
// 古いままだと誤って完了扱いになってしまう)
function makeStaleAbilityRhythm() {
    const audio = makeAudio();
    const rhythm = new RhythmSystem(audio);
    rhythm.abilityActive = true;
    rhythm.abilityStartBeat = 0;
    rhythm.abilityLength = 1;
    rhythm.abilityNotes.push({ id: rhythm.noteId++, beat: 0, type: 'ability', hit: false, missed: false });
    audio.ctx.currentTime = 5; // abilityStartBeat+abilityLength+1をとっくに超えている
    return rhythm;
}

const rhythmAbilitySteal = makeStaleAbilityRhythm();
rhythmAbilitySteal.abilityStealNextBeat = 10;
const resultAbilitySteal = rhythmAbilitySteal.update();
if (resultAbilitySteal && resultAbilitySteal.type === 'ability_complete') {
    throw new Error('ability_complete must not fire while abilityStealNextBeat is active (mid ability-steal gimmick)');
}

const rhythmRapid = makeStaleAbilityRhythm();
rhythmRapid.rapidFireNextBeat = 10;
const resultRapid = rhythmRapid.update();
if (resultRapid && resultRapid.type === 'ability_complete') {
    throw new Error('ability_complete must not fire while rapidFireNextBeat is active (mid rapid-fire gimmick)');
}

// 両方とも終わった後は、通常通りability_completeが機能する
const rhythmDone = makeStaleAbilityRhythm();
const resultDone = rhythmDone.update();
if (!resultDone || resultDone.type !== 'ability_complete') {
    throw new Error('ability_complete should resume firing normally once neither gimmick is active');
}

// 能力泥棒のノーツは右からだけでなく、fromLeftフラグが立っているものは
// 防御ノーツと同じ側(左)から流れてくる
{
    const audio = makeAudio();
    const rhythm = new RhythmSystem(audio);
    rhythm.abilityActive = true;
    const leftNote = { id: rhythm.noteId++, beat: 2, type: 'ability', hit: false, missed: false, abilityStealNote: true, fromLeft: true };
    const rightNote = { id: rhythm.noteId++, beat: 2, type: 'ability', hit: false, missed: false, abilityStealNote: true, fromLeft: false };
    rhythm.abilityNotes.push(leftNote, rightNote);
    audio.ctx.currentTime = 1.5 * (60 / 120);
    const rendered = rhythm.getNotesForRender({});
    const leftRendered = rendered.find(n => n.id === leftNote.id);
    const rightRendered = rendered.find(n => n.id === rightNote.id);
    if (!leftRendered || !rightRendered) throw new Error('both ability-steal notes should be visible');
    if (!(leftRendered.x < 300) || !(rightRendered.x > 300)) {
        throw new Error('fromLeft should approach from the defend (left) side while the rest still approach from the right, left.x=' +
            leftRendered.x + ' right.x=' + rightRendered.x);
    }
}

// 0.5拍間隔で連続するノーツ(連打・能力泥棒)は、隣接ノーツの判定窓と重ならないよう、
// 「前のノーツの遅打ち許容」+「次のノーツの早打ち許容」が間隔(0.5拍)を超えてはいけない。
// 早打ち(まだノーツの拍が来ていない状態でのタップ)は自然に早めがちなプレイに合わせて
// 広め、遅打ち(拍を過ぎてからのタップ)はすぐ次のノーツへ譲れるよう狭めの非対称にしてある
if (!(RAPID_NOTE_EARLY_WINDOW_BEATS + RAPID_NOTE_LATE_WINDOW_BEATS <= 0.5)) {
    throw new Error('early+late rapid-note windows must not exceed the 0.5-beat note spacing, or adjacent notes\' windows will overlap, got early=' +
        RAPID_NOTE_EARLY_WINDOW_BEATS + ' late=' + RAPID_NOTE_LATE_WINDOW_BEATS);
}
if (!(RAPID_NOTE_EARLY_WINDOW_BEATS > RAPID_NOTE_LATE_WINDOW_BEATS)) {
    throw new Error('the early (anticipatory) window should be more generous than the late window, since players tend to tap slightly early');
}
if (RAPID_NOTE_WINDOW_TOTAL_BEATS <= 0) throw new Error('RAPID_NOTE_WINDOW_TOTAL_BEATS should be a positive budget shared between early/late');

// 最初のノーツを無視して(打たずに)2つ目からタップし始めても、2つ目のノーツを
// 正確なタイミングで打てば、既に残っている1つ目のノーツへ誤って吸われることなく
// きちんと2つ目にヒットする
{
    const audio = makeAudioWithSoundStub();
    const rhythm = new RhythmSystem(audio);
    const beatInterval = 60 / audio.bpm;
    rhythm.swordNotes.push(
        { id: rhythm.noteId++, beat: 0, type: 'sword', hit: false, missed: false, rapidFireNote: true },
        { id: rhythm.noteId++, beat: 0.5, type: 'sword', hit: false, missed: false, rapidFireNote: true }
    );
    // 1つ目のノーツは無視したまま、2つ目のノーツのタイミングちょうどでタップする
    audio.ctx.currentTime = 0.5 * beatInterval;
    rhythm.update(); // 実際のゲームループと同様、タップの前にも毎フレームmiss判定が走る
    const result = rhythm.checkInputAny({});
    if (!result || !result.note || result.note.beat !== 0.5) {
        throw new Error('tapping precisely on the 2nd note should hit the 2nd note, not get stolen by the stale 1st note, got ' +
            JSON.stringify(result && result.note));
    }
    if (result.judge === 'miss') throw new Error('the 2nd note should be hit successfully (not judged as a miss)');
}

// 途中からタップし始めた時、少し早め/遅めのタイミングのブレがあっても、狙った
// ノーツとは別の(前後に隣接する)ノーツへ誤ってヒットすることがない
// (前のノーツに対する猶予をタップより先に使い切らせるため、まずrhythm.update()を呼ぶ)
{
    const audio = makeAudioWithSoundStub();
    const rhythm = new RhythmSystem(audio);
    const beatInterval = 60 / audio.bpm;
    rhythm.swordNotes.push(
        { id: rhythm.noteId++, beat: 0, type: 'sword', hit: false, missed: false, rapidFireNote: true },
        { id: rhythm.noteId++, beat: 0.5, type: 'sword', hit: false, missed: false, rapidFireNote: true }
    );
    // 2つ目のノーツより少しだけ早いタイミング(0.15拍分)でタップする
    audio.ctx.currentTime = (0.5 - 0.15) * beatInterval;
    rhythm.update();
    const result = rhythm.checkInputAny({});
    if (!result || !result.note || result.note.beat !== 0.5) {
        throw new Error('an early-but-reasonable tap aimed at the 2nd note must not get attributed to the stale 1st note, got ' +
            JSON.stringify(result && result.note));
    }
}

console.log('THIEF RAPID-FIRE GIMMICK OK');
