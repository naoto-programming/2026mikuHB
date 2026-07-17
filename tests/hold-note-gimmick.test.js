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

// generateHoldNoteは開始beatと終了beat(開始+1拍)を持つノーツをdefendNotesに追加する
const audio = makeAudio();
const rhythm = new RhythmSystem(audio);
rhythm.generateHoldNote(4);
const note = rhythm.defendNotes.find(n => n.beat === 4);
if (!note) throw new Error('generateHoldNote should add a note at the start beat');
if (note.holdEndBeat !== 5) throw new Error('generateHoldNote should set holdEndBeat to start+1, got ' + note.holdEndBeat);
if (note.type !== 'defend') throw new Error('hold notes should still be type defend so checkInputAny finds them');
if (!note.isHold) throw new Error('hold notes should be flagged with isHold: true');

console.log('HOLD NOTE GIMMICK OK');
