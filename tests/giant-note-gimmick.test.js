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

// 剣士B「巨大ノーツ」: ウイルスノーツと同様、通常の攻撃バースト生成の中で
// ランダムに1つの既存ノーツを巨大化させる(専用の独立したノーツは生成しない)
const audio = makeAudio();
const rhythm = new RhythmSystem(audio);
rhythm.startSwordBurst(4, {}); // ギミック無効時は巨大化しない
if (rhythm.giantNote) throw new Error('spawning notes without the giantNote gimmick active should never create a giant note');

const audio2 = makeAudio();
const rhythm2 = new RhythmSystem(audio2);
rhythm2.startSwordBurst(4, { special: 'giantNote' });
if (!rhythm2.giantNote) throw new Error('spawning with the giantNote gimmick active should mark one note as giant');
if (!rhythm2.swordNotes.includes(rhythm2.giantNote)) throw new Error('the giant note should be one of the normally-generated sword notes, not a separate note');
if (rhythm2.giantNote.giantStage !== 2) throw new Error('a fresh giant note should start at giantStage 2 (breaks in 2 hits), got ' + rhythm2.giantNote.giantStage);

// 既に巨大ノーツが残っている間は、次のバーストが生成されても追加でもう1つ巨大化させたりはしない
rhythm2.startSwordBurst(4, { special: 'giantNote' });
if (rhythm2.swordNotes.filter(n => n.isGiant).length > 1) throw new Error('only one giant note should exist at a time');

// resolveGiantHitはstageを1減らし、0未満にならない限り次の小節へ再スケジュールする
rhythm2.resolveGiantHit();
if (rhythm2.giantNote.giantStage !== 1) throw new Error('resolveGiantHit should decrement giantStage, got ' + rhythm2.giantNote.giantStage);
if (rhythm2.giantNote.hit) throw new Error('a giant note above stage 0 should not be marked hit (it respawns)');

rhythm2.resolveGiantHit(); // giantStageが0になった状態でヒット -> 爆発して消滅(2回で壊れる)
if (!rhythm2.giantNote.hit) throw new Error('a giant note should be destroyed after exactly 2 hits (giantStage reaches 0)');

console.log('GIANT NOTE GIMMICK OK');
