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

console.log('NOTE COLLISION AVOIDANCE OK');
