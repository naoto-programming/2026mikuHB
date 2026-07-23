ObjC.import('Foundation');
function readFile(path) {
    const data = $.NSString.stringWithContentsOfFileEncodingError($(path), $.NSUTF8StringEncoding, null);
    return ObjC.unwrap(data);
}
eval(readFile('./game.js'));
const { Enemy, RhythmSystem, AudioSystem, CONSTANTS, CHARACTER_GIMMICKS, getAirWalkFlybyInterval } = globalThis.GameLogic;

function makeAudio() {
    const audio = new AudioSystem();
    audio.bpm = 120;
    audio.isPlaying = true;
    audio.ctx = { currentTime: 0 };
    audio.startTime = 0;
    return audio;
}

// 盗賊のギミックは元の割り当てのまま: A「空歩」(airWalk)とB「連打」(rapidFire)
if (CHARACTER_GIMMICKS.thief[0].special !== 'airWalk') {
    throw new Error("thief gimmick[0] should still be airWalk, got " + CHARACTER_GIMMICKS.thief[0].special);
}
if (CHARACTER_GIMMICKS.thief[1].special !== 'rapidFire') {
    throw new Error("thief gimmick[1] should still be rapidFire, got " + CHARACTER_GIMMICKS.thief[1].special);
}

// 盗賊A「空歩」: 画面中央へ向かうtween(onComplete='airWalkPinned')が完了すると、
// テレポートではなく滑らかな移動を経てairWalkPinned状態になる
const pinning = new Enemy('normal', 100, 300, 1);
pinning.tween = { fromX: 100, fromY: 300, toX: 640, toY: 150, timer: 0, duration: 0.5, onComplete: 'airWalkPinned' };
for (let i = 0; i < 40; i++) pinning.update(1 / 60, [], 0, [pinning]); // 0.5秒(tweenのduration)より長く回す
if (!pinning.airWalkPinned) throw new Error('the enemy should become airWalkPinned once the tween to the center completes');
if (Math.abs(pinning.x - 640) > 1 || Math.abs(pinning.y - 150) > 1) {
    throw new Error('the enemy should have smoothly arrived at the tween target position, got x=' + pinning.x + ' y=' + pinning.y);
}

// 固定(airWalkPinned)された敵は、ギミック終了までその場から一切動かない
const pinned = new Enemy('normal', 640, 150, 1);
pinned.airWalkPinned = true;
const pinnedXBefore = pinned.x, pinnedYBefore = pinned.y;
pinned.update(1, [], 0, [pinned]); // 1秒分回しても動かないはず
if (pinned.x !== pinnedXBefore || pinned.y !== pinnedYBefore) {
    throw new Error('an airWalkPinned enemy must not move at all until the gimmick releases it');
}

// 落下中(falling)の敵には通常通りダメージが通らない(空歩ギミックはスロー化ではなく
// 固定を使うため、着地するまでは戦闘対象にしない)
const fallingNormal = new Enemy('normal', 500, 300, 1);
fallingNormal.falling = true;
const hpBeforeNormalFall = fallingNormal.hp;
fallingNormal.takeDamage(5, 'sword');
if (fallingNormal.hp !== hpBeforeNormalFall) {
    throw new Error('a falling enemy should still be immune to damage until it lands');
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

const rhythmAirWalk = makeStaleAbilityRhythm();
rhythmAirWalk.airWalkNextBeat = 10;
const resultAirWalk = rhythmAirWalk.update();
if (resultAirWalk && resultAirWalk.type === 'ability_complete') {
    throw new Error('ability_complete must not fire while airWalkNextBeat is active (mid air-walk gimmick)');
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

// 盗賊A「空歩」: カウンターノーツの蓄積数に応じて自動フライバイの間隔が
// 4→3→2→1→半拍と段階的に短くなる(頻度が上がる)
if (getAirWalkFlybyInterval(0) !== 4) throw new Error('with no counter hits yet, the interval should start at 4 beats, got ' + getAirWalkFlybyInterval(0));
if (getAirWalkFlybyInterval(2) !== 3) throw new Error('expected interval 3 at 2 counter hits, got ' + getAirWalkFlybyInterval(2));
if (getAirWalkFlybyInterval(4) !== 2) throw new Error('expected interval 2 at 4 counter hits, got ' + getAirWalkFlybyInterval(4));
if (getAirWalkFlybyInterval(6) !== 1) throw new Error('expected interval 1 at 6 counter hits, got ' + getAirWalkFlybyInterval(6));
if (getAirWalkFlybyInterval(8) !== 0.5) throw new Error('expected interval 0.5 at 8 counter hits, got ' + getAirWalkFlybyInterval(8));
if (getAirWalkFlybyInterval(999) !== 0.5) throw new Error('the interval should never go below 0.5 no matter how many hits accumulate, got ' + getAirWalkFlybyInterval(999));
// しきい値は、ギミックの継続時間内にカウンターノーツを全てパーフェクトで取り続ければ
// 現実的に到達できる程度に低く抑えられているべき(最大でも一桁台前半のヒット数で十分)
if (getAirWalkFlybyInterval(8) !== 0.5 || 8 > 10) {
    throw new Error('the top tier (0.5 beats) should be reachable with a realistically small number of perfect counter hits');
}

console.log('THIEF RAPID-FIRE GIMMICK OK');
