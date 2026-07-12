ObjC.import('Foundation');
function readFile(path) {
    const data = $.NSString.stringWithContentsOfFileEncodingError($(path), $.NSUTF8StringEncoding, null);
    return ObjC.unwrap(data);
}
eval(readFile('./game.js'));
const { StageManager, computeTotalWaves } = globalThis.GameLogic;

if (computeTotalWaves(90, 15) !== 6) throw new Error('computeTotalWaves(90,15) should be 6, got ' + computeTotalWaves(90, 15));
if (computeTotalWaves(10, 15) !== 1) throw new Error('computeTotalWaves should floor to at least 1 wave, got ' + computeTotalWaves(10, 15));

const stage = new StageManager();
stage.start(90);
if (stage.scrollX !== 0) throw new Error('scrollX should stay 0 (no auto-scroll)');
if (stage.totalWaves !== 6) throw new Error('expected 6 total waves for a 90s track, got ' + stage.totalWaves);
if (stage.currentWave !== 0) throw new Error('currentWave should start at 0');
if (stage.enemies.length !== 0) throw new Error('enemies should start empty');

// スクロールしないこと: updateを回してもscrollXは変わらない
stage.update(0.5, []);
if (stage.scrollX !== 0) throw new Error('scrollX must remain 0 after update (no forced auto-scroll)');

// ウェーブがプレイヤーの左右両方から出現しうること
stage.waveTimer = 0;
stage.spawnWave();
const fromLeft = stage.enemies.some(e => e.x < 0);
const fromRight = stage.enemies.some(e => e.x > 1280);
if (stage.enemies.length < 5) throw new Error('a wave should spawn several enemies at once, got ' + stage.enemies.length);
if (!fromLeft && !fromRight) throw new Error('enemies should be able to spawn from screen edges');

console.log('WAVE STAGE OK');
