ObjC.import('Foundation');
function readFile(path) {
    const data = $.NSString.stringWithContentsOfFileEncodingError($(path), $.NSUTF8StringEncoding, null);
    return ObjC.unwrap(data);
}
eval(readFile('./game.js'));
const { snapToMeasureBeat, MEASURE_BEATS, RhythmSystem, AudioSystem, LOOKAHEAD_BEATS } = globalThis.GameLogic;

if (typeof MEASURE_BEATS !== 'number' || MEASURE_BEATS < 2) throw new Error('MEASURE_BEATS should be a number >= 2, got ' + MEASURE_BEATS);
if (typeof snapToMeasureBeat !== 'function') throw new Error('snapToMeasureBeat should exist');

const snapped = snapToMeasureBeat(5.3, 4);
if (snapped % MEASURE_BEATS !== 0) throw new Error('snapToMeasureBeat should return a measure boundary, got ' + snapped);
if (snapped < 5.3 + 4) throw new Error('snapToMeasureBeat should be at least leadBeats ahead of currentBeat, got ' + snapped);

const audio = new AudioSystem();
audio.bpm = 120;
audio.isPlaying = true;
audio.ctx = { currentTime: 3.3 };
audio.startTime = 0;

const rhythm = new RhythmSystem(audio);
rhythm.startSwordBurst(4);
if (rhythm.swordBurstStartBeat % MEASURE_BEATS !== 0) throw new Error('sword burst should start on a measure boundary, got ' + rhythm.swordBurstStartBeat);

rhythm.startAbility(4);
if (rhythm.abilityStartBeat % MEASURE_BEATS !== 0) throw new Error('ability burst should start on a measure boundary, got ' + rhythm.abilityStartBeat);

console.log('MEASURE ALIGNED TIMING OK');
