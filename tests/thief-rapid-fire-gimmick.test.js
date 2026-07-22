ObjC.import('Foundation');
function readFile(path) {
    const data = $.NSString.stringWithContentsOfFileEncodingError($(path), $.NSUTF8StringEncoding, null);
    return ObjC.unwrap(data);
}
eval(readFile('./game.js'));
const { Enemy, RhythmSystem, AudioSystem, CONSTANTS } = globalThis.GameLogic;

function makeAudio() {
    const audio = new AudioSystem();
    audio.bpm = 120;
    audio.isPlaying = true;
    audio.ctx = { currentTime: 0 };
    audio.startTime = 0;
    return audio;
}

// 盗賊B「連打」: 打ち上げられた敵(thiefSlowMotion)は動きが超スローになる
// (通常の1/5の速さでしか進行しない)
const slow = new Enemy('normal', 500, 300, 1);
slow.thiefSlowMotion = true;
slow.falling = false;
const normal = new Enemy('normal', 500, 300, 1);
normal.thiefSlowMotion = false;
// アニメーションタイマーの進みで速度差を比較する(どちらも同じ初期状態から)
slow.update(0.1, [], 0, [slow]);
normal.update(0.1, [], 0, [normal]);
if (!(slow.animTimer < normal.animTimer)) {
    throw new Error('an enemy under thiefSlowMotion should experience time more slowly than a normal enemy');
}

// RhythmSystem.update(): 盗賊「連打」中はability_completeの誤判定を起こさない
// (連打中はability notesを継続的に注ぎ足すため、abilityStartBeat/abilityLengthが古いまま
// 完了判定されてしまうと、意図せずability_completeが発火してしまう)
const audio = makeAudio();
const rhythm = new RhythmSystem(audio);
rhythm.abilityActive = true;
rhythm.abilityStartBeat = 0;
rhythm.abilityLength = 1; // すぐ完了条件を満たしてしまう古い値
rhythm.rapidFireNextBeat = 10; // 連打中であることを示す(nullでない)
rhythm.abilityNotes.push({ id: rhythm.noteId++, beat: 0, type: 'ability', hit: false, missed: false, rapidFireNote: true });
audio.ctx.currentTime = 5; // abilityStartBeat+abilityLength+1をとっくに超えている
const result = rhythm.update();
if (result && result.type === 'ability_complete') {
    throw new Error('ability_complete must not fire while rapidFireNextBeat is active (mid rapid-fire gimmick)');
}
if (!rhythm.abilityActive) {
    throw new Error('abilityActive should remain true during rapid-fire (not reset by a stale completion check)');
}

// 連打が終わった後(rapidFireNextBeat===null)は、通常通りability_completeが機能する
rhythm.rapidFireNextBeat = null;
const result2 = rhythm.update();
if (!result2 || result2.type !== 'ability_complete') {
    throw new Error('ability_complete should resume firing normally once rapid-fire has ended');
}

console.log('THIEF RAPID-FIRE GIMMICK OK');
