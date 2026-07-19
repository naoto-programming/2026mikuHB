ObjC.import('Foundation');
function readFile(path) {
    const data = $.NSString.stringWithContentsOfFileEncodingError($(path), $.NSUTF8StringEncoding, null);
    return ObjC.unwrap(data);
}
eval(readFile('./game.js'));
const { StageManager, Enemy, CONSTANTS, applyAbility, Player } = globalThis.GameLogic;

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

// 敵は上空から1体ずつ順番に降ってくるため、spawnDelayは出現順に応じて広く分散する
// (まとめて一斉に降ってこないよう、後の敵ほど遅く出現する)
const delays = new Set();
const maxExpectedDelay = stage.enemies.length * 0.25 + 1;
stage.enemies.forEach(en => {
    if (en.spawnDelay < 0 || en.spawnDelay >= maxExpectedDelay) throw new Error('spawnDelay should be within [0,' + maxExpectedDelay + '), got ' + en.spawnDelay);
    delays.add(en.spawnDelay);
    if (!en.falling) throw new Error('a freshly spawned enemy should start in the falling(from-the-sky) state');
    if (en.y >= en.groundY) throw new Error('a freshly spawned enemy should start above its groundY (falling from the sky), got y=' + en.y + ' groundY=' + en.groundY);
    if (Math.abs(en.groundY - CONSTANTS.GROUND_Y) > 15) throw new Error('enemy groundY (landing spot) should stay within GROUND_Y ± 15, got ' + en.groundY);
    if (en.hueShift < -20 || en.hueShift >= 20) throw new Error('hueShift should be within [-20,20), got ' + en.hueShift);
    if (en.brightnessShift < 0.85 || en.brightnessShift >= 1.15) throw new Error('brightnessShift should be within [0.85,1.15), got ' + en.brightnessShift);
});
if (delays.size < 2) throw new Error('spawnDelay should vary across enemies in the same wave, not be identical');

// 落下中(falling=true)の敵はまだ「敵」として扱われず、攻撃対象にもダメージ対象にもならない
const fallingEnemy = new Enemy('normal', 0, -400, 1);
fallingEnemy.falling = true;
fallingEnemy.groundY = 600;
const hpBefore = fallingEnemy.hp;
const dmgResult = fallingEnemy.takeDamage(9999, 'sword');
if (dmgResult !== 0) throw new Error('takeDamage should return 0 while an enemy is still falling, got ' + dmgResult);
if (fallingEnemy.hp !== hpBefore) throw new Error('a falling enemy should take no damage until it lands');
if (fallingEnemy.dead) throw new Error('a falling enemy should not be killable while still falling');

const player = new Player('p1', 'swordsman', true);
const outcome = applyAbility('swordsman', 1, player, [fallingEnemy], 0);
if (outcome.hits.length !== 0) throw new Error('abilities should never target an enemy that is still falling, got ' + outcome.hits.length + ' hits');

// 着地後(falling=false)は通常通り攻撃対象・ダメージ対象になる
fallingEnemy.falling = false;
const outcomeAfterLanding = applyAbility('swordsman', 1, player, [fallingEnemy], 0);
if (outcomeAfterLanding.hits.length !== 1) throw new Error('once landed, the enemy should be a normal valid target again');

console.log('ENEMY WAVE VARIANCE OK');
