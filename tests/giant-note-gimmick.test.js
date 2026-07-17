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

const audio = makeAudio();
const rhythm = new RhythmSystem(audio);
rhythm.generateGiantNote(4);
if (!rhythm.giantNote) throw new Error('generateGiantNote should set rhythm.giantNote');
if (rhythm.giantNote.giantStage !== 3) throw new Error('a fresh giant note should start at giantStage 3, got ' + rhythm.giantNote.giantStage);
if (!rhythm.swordNotes.includes(rhythm.giantNote)) throw new Error('generateGiantNote should also push the giant note into swordNotes so checkInputAny/checkInput/getNotesForRender find it naturally');

// resolveGiantHitはstageを1減らし、0未満にならない限り次の小節へ再スケジュールする
rhythm.resolveGiantHit();
if (rhythm.giantNote.giantStage !== 2) throw new Error('resolveGiantHit should decrement giantStage, got ' + rhythm.giantNote.giantStage);
if (rhythm.giantNote.hit) throw new Error('a giant note above stage 0 should not be marked hit (it respawns)');

rhythm.resolveGiantHit();
rhythm.resolveGiantHit(); // giantStageが0の状態でヒット -> 爆発して消滅
if (!rhythm.giantNote.hit) throw new Error('a giant note at stage 0 should finally be marked hit (explosion)');

console.log('GIANT NOTE GIMMICK OK');
