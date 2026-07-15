ObjC.import('Foundation');
function readFile(path) {
    const data = $.NSString.stringWithContentsOfFileEncodingError($(path), $.NSUTF8StringEncoding, null);
    return ObjC.unwrap(data);
}
eval(readFile('./game.js'));
const { StageManager, Enemy, CONSTANTS } = globalThis.GameLogic;

// デフォルトではspawnDelay/hueShift/brightnessShiftは中立値
const e2 = new Enemy('normal', 100, 600, 1);
if (e2.spawnDelay !== 0) throw new Error('Enemy default spawnDelay should be 0 (no stagger unless set by spawnWave)');
if (e2.hueShift !== 0) throw new Error('Enemy default hueShift should be 0');
if (e2.brightnessShift !== 1) throw new Error('Enemy default brightnessShift should be 1');

// spawnDelay中は移動・攻撃などの通常ロジックを実行しない
const e = new Enemy('normal', 500, 600, 1);
e.spawnDelay = 1;
const xBefore = e.x;
e.update(2, [{ x: 0, isAlive: () => true }], 0, []);
if (e.x !== xBefore) throw new Error('enemy should not move while spawnDelay > 0');

e.update(0.1, [{ x: 0, isAlive: () => true }], 0, []);
if (e.x === xBefore) throw new Error('enemy should resume normal update once spawnDelay has elapsed');

// ウェーブ内の敵は出現タイミング・位置・色味がばらける
const stage = new StageManager();
stage.stage = 2;
stage.start(90);
stage.waveTimer = 0;
stage.spawnWave();

if (stage.enemies.length === 0) throw new Error('spawnWave should create enemies');

const delays = new Set();
stage.enemies.forEach(en => {
    if (en.spawnDelay < 0 || en.spawnDelay >= 3) throw new Error('spawnDelay should be within [0,3), got ' + en.spawnDelay);
    delays.add(en.spawnDelay);
    if (Math.abs(en.y - CONSTANTS.GROUND_Y) > 15) throw new Error('enemy y should stay within GROUND_Y ± 15, got ' + en.y);
    if (en.hueShift < -20 || en.hueShift >= 20) throw new Error('hueShift should be within [-20,20), got ' + en.hueShift);
    if (en.brightnessShift < 0.85 || en.brightnessShift >= 1.15) throw new Error('brightnessShift should be within [0.85,1.15), got ' + en.brightnessShift);
});
if (delays.size < 2) throw new Error('spawnDelay should vary across enemies in the same wave, not be identical');

console.log('ENEMY WAVE VARIANCE OK');
