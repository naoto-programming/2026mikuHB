ObjC.import('Foundation');
function readFile(path) {
    const data = $.NSString.stringWithContentsOfFileEncodingError($(path), $.NSUTF8StringEncoding, null);
    return ObjC.unwrap(data);
}
eval(readFile('./game.js'));
const { StageManager, computeTotalWaves, ENDLESS_ENEMY_COUNT_MULT } = globalThis.GameLogic;

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

// 人数が多いほど1ウェーブの敵数が増える(協力プレイのバランス調整)
const stage3 = new StageManager();
stage3.start(90);
stage3.update(0, [{}]); // 1人プレイ相当
stage3.waveTimer = 0;
stage3.spawnWave();
const soloWaveSize = stage3.enemies.length;

const stage4 = new StageManager();
stage4.start(90);
stage4.update(0, [{}, {}, {}, {}]); // 4人プレイ相当
stage4.waveTimer = 0;
stage4.spawnWave();
const fourPlayerWaveSize = stage4.enemies.length;

if (fourPlayerWaveSize <= soloWaveSize) {
    throw new Error('a wave with more players should spawn more enemies than solo, got solo=' + soloWaveSize + ' four-player=' + fourPlayerWaveSize);
}

// エンドレスモード: endlessEnemyCountMultを設定すると、その倍率分だけ敵の数が増える
// (通常モードではこのフィールドが未設定なので、既存の挙動に影響しない)
const stage5 = new StageManager();
stage5.start(90);
stage5.update(0, [{}]);
stage5.endlessEnemyCountMult = ENDLESS_ENEMY_COUNT_MULT.many; // 「多」設定
stage5.waveTimer = 0;
stage5.spawnWave();
const manyWaveSize = stage5.enemies.length;
if (manyWaveSize <= soloWaveSize) {
    throw new Error('endlessEnemyCountMult should scale up the wave size, got solo=' + soloWaveSize + ' many=' + manyWaveSize);
}

// 特別ゲーム・エンドレスモードはstageが1のまま進み続けるが、ウェーブ数が十分進めば
// (ウェーブが特殊敵の出現段階を疑似的に肩代わりして)特殊な敵種別も出現するようになる
const stage6 = new StageManager();
stage6.start(90);
stage6.currentWave = 12; // stageは1のままだが、ウェーブは十分進んでいる想定
stage6.waveTimer = 0;
stage6.spawnEnemies(60);
const spawnedTypes = new Set(stage6.enemies.map(e => e.type));
if (spawnedTypes.size <= 1) {
    throw new Error('after enough waves, special enemy types should start appearing even while stage stays at 1, got only: ' + Array.from(spawnedTypes).join(','));
}

console.log('WAVE STAGE OK');
