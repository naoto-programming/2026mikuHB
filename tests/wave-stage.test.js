ObjC.import('Foundation');
function readFile(path) {
    const data = $.NSString.stringWithContentsOfFileEncodingError($(path), $.NSUTF8StringEncoding, null);
    return ObjC.unwrap(data);
}
eval(readFile('./game.js'));
const { StageManager, computeTotalWaves } = globalThis.GameLogic;

if (computeTotalWaves(90, 15) !== 3) throw new Error('computeTotalWaves(90,15) should be capped at 3, got ' + computeTotalWaves(90, 15));
if (computeTotalWaves(10, 15) !== 1) throw new Error('computeTotalWaves should floor to at least 1 wave, got ' + computeTotalWaves(10, 15));

const stage = new StageManager();
stage.start(90);
if (stage.scrollX !== 0) throw new Error('scrollX should stay 0 (no auto-scroll)');
if (stage.totalWaves !== 3) throw new Error('expected 3 total waves (capped) for a 90s track, got ' + stage.totalWaves);
if (stage.currentWave !== 0) throw new Error('currentWave should start at 0');
if (stage.enemies.length !== 0) throw new Error('enemies should start empty');

// スクロールしないこと: updateを回してもscrollXは変わらない
stage.update(0.5, []);
if (stage.scrollX !== 0) throw new Error('scrollX must remain 0 after update (no forced auto-scroll)');

// ウェーブの敵は上空から降ってくる形で出現し、x座標はランダムに散らばること
stage.waveTimer = 0;
stage.spawnWave();
if (stage.enemies.length < 5) throw new Error('a wave should spawn several enemies at once, got ' + stage.enemies.length);
if (!stage.enemies.every(e => e.falling)) throw new Error('newly spawned enemies should start in the falling(from-the-sky) state');
if (!stage.enemies.every(e => e.y < e.groundY)) throw new Error('newly spawned enemies should start above their eventual groundY, not already on the ground');
const xs = new Set(stage.enemies.map(e => Math.round(e.x)));
if (xs.size < 5) throw new Error('enemies should spawn at varied, random x positions, not a fixed pattern, got only ' + xs.size + ' distinct values');

// 敵を全滅させ切らなくても、残数がwaveAdvanceRemainingRatio未満まで減れば
// 次のウェーブが(前のウェーブの生存者に)重ねて投入される
const stage2 = new StageManager();
stage2.start(90);
stage2.waveTimer = 0;
stage2.update(0.001, []);
const firstWaveCount = stage2.enemies.length;
if (firstWaveCount < 5) throw new Error('first wave should spawn enemies');

const keepCount = Math.max(1, Math.floor(firstWaveCount * stage2.waveAdvanceRemainingRatio) - 1);
stage2.enemies = stage2.enemies.slice(0, keepCount); // 大半を倒したことを模擬(0体にはしない)

stage2.waveTimer = 0;
stage2.update(0.001, []);
if (stage2.currentWave !== 2) {
    throw new Error('a second wave should spawn once enough of the first wave is cleared, even with survivors remaining, currentWave=' + stage2.currentWave);
}
if (stage2.enemies.length <= keepCount) {
    throw new Error('new wave enemies should be added on top of the remaining survivors, got ' + stage2.enemies.length + ' vs kept ' + keepCount);
}

console.log('WAVE STAGE OK');
