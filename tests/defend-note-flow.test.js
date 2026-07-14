ObjC.import('Foundation');
function readFile(path) {
    const data = $.NSString.stringWithContentsOfFileEncodingError($(path), $.NSUTF8StringEncoding, null);
    return ObjC.unwrap(data);
}
eval(readFile('./game.js'));
const { Enemy, RhythmSystem, AudioSystem } = globalThis.GameLogic;

// 攻撃開始直後から予兆が立つ（旧: attackTimer<0.6まで待つ必要があった）
const e = new Enemy('normal', 400, 600, 1);
e.startAttack();
if (e.attackTimer !== 2.5) throw new Error('attackTimer should now start at 2.5, got ' + e.attackTimer);
e.update(0.01, [], 0, [e]);
if (!e.attackWarning) throw new Error('attackWarning should be true almost immediately after startAttack, not only in the last 0.6s');

// 防御ノーツは左から流れる（x座標が中央より右側から始まらない）
const audio = new AudioSystem();
audio.bpm = 120;
audio.isPlaying = true;
audio.ctx = { currentTime: 0 };
audio.startTime = 0;
const rhythm = new RhythmSystem(audio);
rhythm.generateDefendNote(4); // 4拍先
const notes = rhythm.getNotesForRender();
const defendNote = notes.find(n => n.type === 'defend');
if (!defendNote) throw new Error('defend note should be visible');
if (defendNote.x >= 300) throw new Error('a future defend note should be positioned left of the reference point (300), got x=' + defendNote.x);

console.log('DEFEND NOTE FLOW OK');
