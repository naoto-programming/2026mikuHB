ObjC.import('Foundation');
function readFile(path) {
    const data = $.NSString.stringWithContentsOfFileEncodingError($(path), $.NSUTF8StringEncoding, null);
    return ObjC.unwrap(data);
}
eval(readFile('./game.js'));
const { RhythmSystem, AudioSystem, CHARACTER_GIMMICKS, shouldTriggerAbilitySteal } = globalThis.GameLogic;

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

// 盗賊A「能力泥棒」: 能力ノーツのパーフェクト連続数が5に達すると最初の発動、
// その後は3連続ごと(8, 11, 14, ...)に追加発動する
for (let i = 0; i < 5; i++) {
    if (shouldTriggerAbilitySteal(i)) throw new Error('should not trigger before reaching a streak of 5, got true at streak=' + i);
}
if (!shouldTriggerAbilitySteal(5)) throw new Error('should trigger at streak=5 (the first activation)');
if (shouldTriggerAbilitySteal(6) || shouldTriggerAbilitySteal(7)) throw new Error('should not trigger again until 3 more perfects have accumulated (streak 6,7)');
if (!shouldTriggerAbilitySteal(8)) throw new Error('should trigger again at streak=8 (5 + 3)');
if (!shouldTriggerAbilitySteal(11)) throw new Error('should trigger again at streak=11 (5 + 3 + 3)');
if (shouldTriggerAbilitySteal(9) || shouldTriggerAbilitySteal(10)) throw new Error('should not trigger at streak=9 or 10, only every 3rd step past 5');

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
