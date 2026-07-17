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
    audio.ctx = {
        currentTime: 0,
        createOscillator() { return { connect(){}, start(){}, stop(){}, frequency:{setValueAtTime(){}, exponentialRampToValueAtTime(){}} }; },
        createGain() { return { connect(){}, gain:{value:0, setValueAtTime(){}, exponentialRampToValueAtTime(){}} }; },
        createBufferSource() { return { connect(){}, start(){}, stop(){} }; },
        createBuffer() { return { getChannelData(){ return new Float32Array(100); } }; },
        createBiquadFilter() { return { connect(){}, frequency:{value:0} }; },
    };
    audio.startTime = 0;
    return audio;
}

const audio = makeAudio();
const rhythm = new RhythmSystem(audio);
rhythm.generateDamageNote(4);
if (rhythm.damageNotes.length !== 1) throw new Error('generateDamageNote should add a note to damageNotes');
if (rhythm.damageNotes[0].type !== 'trap') throw new Error('damage notes should be type trap');

// checkInputAnyはdamageNotes(trap)も判定対象に含める
const beatInterval = 60 / audio.bpm;
audio.ctx.currentTime = 4 * beatInterval;
const result = rhythm.checkInputAny({});
if (!result || result.note.type !== 'trap') throw new Error('checkInputAny should be able to resolve a trap note, got ' + JSON.stringify(result));

console.log('DAMAGE NOTE GIMMICK OK');
