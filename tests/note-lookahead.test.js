ObjC.import('Foundation');
function readFile(path) {
    const data = $.NSString.stringWithContentsOfFileEncodingError($(path), $.NSUTF8StringEncoding, null);
    return ObjC.unwrap(data);
}
eval(readFile('./game.js'));
const { RhythmSystem, AudioSystem, LOOKAHEAD_BEATS } = globalThis.GameLogic;

if (typeof LOOKAHEAD_BEATS !== 'number' || LOOKAHEAD_BEATS < 2) throw new Error('LOOKAHEAD_BEATS should be a number >= 2, got ' + LOOKAHEAD_BEATS);

const audio = new AudioSystem();
audio.bpm = 120;
audio.isPlaying = true;
audio.ctx = { currentTime: 0 };
audio.startTime = 0;

const rhythm = new RhythmSystem(audio);
rhythm.startSwordBurst(4);
const firstNoteBeat = Math.min(...rhythm.swordNotes.map(n => n.beat));
if (firstNoteBeat < LOOKAHEAD_BEATS) throw new Error('first sword note should be scheduled at least LOOKAHEAD_BEATS ahead, got beat ' + firstNoteBeat);

rhythm.startAbility(4);
const firstAbilityBeat = Math.min(...rhythm.abilityNotes.map(n => n.beat));
if (firstAbilityBeat < LOOKAHEAD_BEATS) throw new Error('first ability note should be scheduled at least LOOKAHEAD_BEATS ahead, got beat ' + firstAbilityBeat);

console.log('NOTE LOOKAHEAD OK');
