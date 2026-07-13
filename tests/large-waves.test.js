ObjC.import('Foundation');
function readFile(path) {
    const data = $.NSString.stringWithContentsOfFileEncodingError($(path), $.NSUTF8StringEncoding, null);
    return ObjC.unwrap(data);
}
eval(readFile('./game.js'));
const { StageManager, ENEMY_TYPES } = globalThis.GameLogic;

const stage = new StageManager();
stage.stage = 4; // 高ステージでも上限内に収まることを確認
stage.start(90);
stage.waveTimer = 0;
stage.spawnWave();

if (stage.enemies.length < 40) throw new Error('a wave should spawn a large number of enemies, got ' + stage.enemies.length);
if (stage.enemies.length > 50) throw new Error('wave size should be capped at 50, got ' + stage.enemies.length);

stage.enemies.forEach(e => {
    const baseAtk = ENEMY_TYPES[e.type].atk * stage.getStageMod();
    if (e.atk > baseAtk * 0.5) throw new Error('spawned enemy atk should be reduced (~0.35x base), got ' + e.atk + ' vs base ' + baseAtk);
});

console.log('LARGE WAVES OK');
