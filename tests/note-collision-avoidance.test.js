ObjC.import('Foundation');
function readFile(path) {
    const data = $.NSString.stringWithContentsOfFileEncodingError($(path), $.NSUTF8StringEncoding, null);
    return ObjC.unwrap(data);
}
eval(readFile('./game.js'));
const { RhythmSystem, AudioSystem } = globalThis.GameLogic;

function makeAudio() {
    const audio = new AudioSystem();
    audio.bpm = 120;
    audio.isPlaying = true;
    audio.ctx = { currentTime: 0 };
    audio.startTime = 0;
    return audio;
}

// 能力ノーツが存在するbeatではtrueを返す
{
    const audio = makeAudio();
    const rhythm = new RhythmSystem(audio);
    rhythm.startAbility(4);
    const targetBeat = rhythm.abilityNotes[0].beat;
    if (!rhythm.hasAbilityNoteAtBeat(targetBeat)) throw new Error('hasAbilityNoteAtBeat should find an existing ability note at its beat');
    if (rhythm.hasAbilityNoteAtBeat(targetBeat + 100)) throw new Error('hasAbilityNoteAtBeat should return false for a beat with no ability note');
}

// abilityActiveがfalseなら常にfalse
{
    const audio = makeAudio();
    const rhythm = new RhythmSystem(audio);
    if (rhythm.hasAbilityNoteAtBeat(0)) throw new Error('hasAbilityNoteAtBeat should return false when no ability burst is active');
}

// 攻撃バーストと能力バーストは、それぞれ独立したタイミング(敵接近/8秒クールダウン)で
// 自動発生するため、同じmeasureスナップ・同じバーストパターンにより同じ拍へ重なることが
// あった。checkInputAnyは全レーン中で最も近い1件しか取らないため、重なると片方
// (特に能力ノーツ)の入力が食われ、ずっと打てないまま流れてミスになるバグがあった。
// startSwordBurst/startAbilityがfindFreeBeatで他レーンの拍を避けるようになったことを、
// 同時刻に両方発生させて確認する(snapToMeasureBeat・pickBurstPatternが同じ入力を
// 受け取るため、素朴な実装なら全ノーツが完全に同じ拍で衝突するはずの状況)
{
    const audio = makeAudio();
    const rhythm = new RhythmSystem(audio);
    audio.ctx.currentTime = 10 * (60 / 120);
    rhythm.startSwordBurst(4);
    rhythm.startAbility(4);
    if (rhythm.abilityStartBeat !== rhythm.swordBurstStartBeat) {
        throw new Error('test setup assumption broken: both bursts should snap to the same start beat here');
    }
    const swordBeats = new Set(rhythm.swordNotes.map(n => n.beat));
    rhythm.abilityNotes.forEach(n => {
        if (swordBeats.has(n.beat)) {
            throw new Error('an ability note should not land on the exact same beat as a sword note, beat=' + n.beat);
        }
    });
}

console.log('NOTE COLLISION AVOIDANCE OK');
