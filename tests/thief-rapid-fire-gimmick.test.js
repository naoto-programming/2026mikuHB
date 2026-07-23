ObjC.import('Foundation');
function readFile(path) {
    const data = $.NSString.stringWithContentsOfFileEncodingError($(path), $.NSUTF8StringEncoding, null);
    return ObjC.unwrap(data);
}
eval(readFile('./game.js'));
const { RhythmSystem, AudioSystem, CHARACTER_GIMMICKS, Player, Enemy, applyAbility, CHARACTERS,
    ABILITY_STEAL_POWER_MULT, ABILITY_STEAL_PENDING_BEATS, ABILITY_FUSION_POWER_MULT, ABILITY_FUSION_TABLE } = globalThis.GameLogic;

function makeAudio() {
    const audio = new AudioSystem();
    audio.bpm = 120;
    audio.isPlaying = true;
    audio.ctx = { currentTime: 0 };
    audio.startTime = 0;
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

console.log('THIEF RAPID-FIRE GIMMICK OK');
