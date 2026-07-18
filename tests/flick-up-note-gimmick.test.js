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

// generateFlickUpNoteは通常の防御ノーツと同じ形(単発タイミング)で、flickUpフラグだけが付く
const audio = makeAudio();
const rhythm = new RhythmSystem(audio);
rhythm.generateFlickUpNote(4);
const note = rhythm.defendNotes.find(n => n.beat === 4);
if (!note) throw new Error('generateFlickUpNote should add a note at the given beat');
if (note.type !== 'defend') throw new Error('flick-up notes should still be type defend so checkInputAny finds them with the normal timing/reduction rules');
if (!note.flickUp) throw new Error('flick-up notes should be flagged with flickUp: true');
if (note.holdEndBeat !== undefined) throw new Error('flick-up notes should not carry a hold-specific holdEndBeat field');

console.log('FLICK UP NOTE GIMMICK OK');
