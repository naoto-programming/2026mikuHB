ObjC.import('Foundation');
function readFile(path) {
    const data = $.NSString.stringWithContentsOfFileEncodingError($(path), $.NSUTF8StringEncoding, null);
    return ObjC.unwrap(data);
}
eval(readFile('./game.js'));
const { ENEMY_TYPES, IMAGE_MANIFEST, StageManager } = globalThis.GameLogic;

if ('flying' in ENEMY_TYPES) throw new Error('ENEMY_TYPES.flying should be removed');
if ('flying' in IMAGE_MANIFEST.enemySprites) throw new Error('IMAGE_MANIFEST.enemySprites.flying should be removed');

const stage = new StageManager();
stage.start(90);
for (let i = 0; i < 20; i++) {
    stage.waveTimer = 0;
    stage.enemies = [];
    stage.spawnWave();
    if (stage.enemies.some(e => e.type === 'flying')) throw new Error('spawnWave should never produce a flying enemy');
}

console.log('NO FLYING ENEMIES OK');
