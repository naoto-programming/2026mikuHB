ObjC.import('Foundation');
function readFile(path) {
    const data = $.NSString.stringWithContentsOfFileEncodingError($(path), $.NSUTF8StringEncoding, null);
    return ObjC.unwrap(data);
}
eval(readFile('./game.js'));
const { RhythmSystem, AudioSystem, StageManager, Enemy } = globalThis.GameLogic;

function makeAudio(bpm) {
    const audio = new AudioSystem();
    audio.bpm = bpm;
    audio.isPlaying = true;
    audio.ctx = { currentTime: 0 };
    audio.startTime = 0;
    return audio;
}

// 防御ノーツがmissした瞬間、defendMissThisFrameが立つ
{
    const audio = makeAudio(120);
    const rhythm = new RhythmSystem(audio);
    rhythm.generateDefendNote(0);
    audio.ctx.currentTime = 5; // 判定窓を大きく超えて時間を進める
    rhythm.update();
    if (!rhythm.defendMissThisFrame) throw new Error('defendMissThisFrame should be true the frame a defend note becomes missed');
}

// missしていない場合はfalseのまま、フラグは呼び出しごとにリセットされる
{
    const audio = makeAudio(120);
    const rhythm = new RhythmSystem(audio);
    rhythm.generateDefendNote(100); // 遠い未来のノーツ
    rhythm.update();
    if (rhythm.defendMissThisFrame) throw new Error('defendMissThisFrame should stay false when no defend note has missed');
}

// StageManager.getNearbyEnemyDamageは周囲の生存敵のatk合計を返す
{
    const stage = new StageManager();
    const near1 = new Enemy('normal', 450, 600, 1); // プレイヤー(x=400)から50離れている
    const near2 = new Enemy('normal', 550, 600, 1); // 150離れている
    const far = new Enemy('normal', 900, 600, 1); // 500離れている（範囲外）
    const dead = new Enemy('normal', 420, 600, 1);
    dead.dead = true;
    stage.enemies = [near1, near2, far, dead];
    const dmg = stage.getNearbyEnemyDamage(400, 200);
    const expected = near1.atk + near2.atk;
    if (Math.abs(dmg - expected) > 0.001) throw new Error('expected damage ' + expected + ', got ' + dmg);
}

console.log('DAMAGE MODEL OK');
