ObjC.import('Foundation');
function readFile(path) {
    const data = $.NSString.stringWithContentsOfFileEncodingError($(path), $.NSUTF8StringEncoding, null);
    return ObjC.unwrap(data);
}
eval(readFile('./game.js'));
const { Enemy, RhythmSystem, AudioSystem, CONSTANTS, CHARACTER_GIMMICKS } = globalThis.GameLogic;

function makeAudio() {
    const audio = new AudioSystem();
    audio.bpm = 120;
    audio.isPlaying = true;
    audio.ctx = { currentTime: 0 };
    audio.startTime = 0;
    return audio;
}

// 盗賊のギミックは元の割り当てのまま: A「地震」(resonanceShake)とB「連打」(rapidFire)
if (CHARACTER_GIMMICKS.thief[0].special !== 'resonanceShake') {
    throw new Error("thief gimmick[0] should still be resonanceShake, got " + CHARACTER_GIMMICKS.thief[0].special);
}
if (CHARACTER_GIMMICKS.thief[1].special !== 'rapidFire') {
    throw new Error("thief gimmick[1] should still be rapidFire, got " + CHARACTER_GIMMICKS.thief[1].special);
}

// 盗賊A「地震」: 打ち上げられた敵(thiefSlowMotion)は動きが超スローになる
const slow = new Enemy('normal', 500, 300, 1);
slow.thiefSlowMotion = true;
const normal = new Enemy('normal', 500, 300, 1);
normal.thiefSlowMotion = false;
slow.update(0.1, [], 0, [slow]);
normal.update(0.1, [], 0, [normal]);
if (!(slow.animTimer < normal.animTimer)) {
    throw new Error('an enemy under thiefSlowMotion should experience time more slowly than a normal enemy');
}

// 盗賊A「地震」: 打ち上げられた敵(thiefLaunched)は高く打ち上がってから、
// 超スローの放物線で地面まで落ちてくる
const launched = new Enemy('normal', 500, 300, 1);
launched.groundY = 300;
launched.thiefSlowMotion = true;
launched.thiefLaunched = true;
launched.vy = -900;
const startY = launched.y;
launched.update(1 / 60, [], 0, [launched]);
if (launched.y >= startY) {
    throw new Error('a thiefLaunched enemy should rise (move upward) immediately after being launched, y=' + launched.y);
}
// 十分な時間が経てば、着地してthiefLaunchedが解除される
for (let i = 0; i < 600; i++) launched.update(1 / 60, [], 0, [launched]);
if (launched.thiefLaunched) throw new Error('a thiefLaunched enemy should eventually land and clear thiefLaunched');
if (launched.y !== launched.groundY) throw new Error('a landed enemy should settle exactly at groundY, got ' + launched.y);

// 盗賊A「地震」: 通常は落下中(falling)の敵にダメージは通らないが、地震ギミック中に
// スロー化(thiefSlowMotion)された落下中の敵は、着地を待たず既に戦闘対象として扱われ、
// ダメージを受け付ける(上から降ってきた敵をすぐ巻き込めるようにするため)
const fallingNormal = new Enemy('normal', 500, 300, 1);
fallingNormal.falling = true;
const hpBeforeNormalFall = fallingNormal.hp;
fallingNormal.takeDamage(5, 'sword');
if (fallingNormal.hp !== hpBeforeNormalFall) {
    throw new Error('a normally-falling enemy (not under the earthquake gimmick) should still be immune to damage');
}

const fallingSlowed = new Enemy('normal', 500, 300, 1);
fallingSlowed.falling = true;
fallingSlowed.thiefSlowMotion = true;
const hpBeforeSlowedFall = fallingSlowed.hp;
fallingSlowed.takeDamage(5, 'sword');
if (fallingSlowed.hp === hpBeforeSlowedFall) {
    throw new Error('a falling enemy under the earthquake gimmick\'s slow motion should already be damageable, even before landing');
}

// RhythmSystem.update(): 盗賊「地震」・「連打」いずれの最中もability_completeの誤判定を
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

const rhythmResonance = makeStaleAbilityRhythm();
rhythmResonance.resonanceNextBeat = 10;
const resultResonance = rhythmResonance.update();
if (resultResonance && resultResonance.type === 'ability_complete') {
    throw new Error('ability_complete must not fire while resonanceNextBeat is active (mid earthquake gimmick)');
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
