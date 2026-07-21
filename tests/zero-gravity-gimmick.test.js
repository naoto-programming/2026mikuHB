ObjC.import('Foundation');
function readFile(path) {
    const data = $.NSString.stringWithContentsOfFileEncodingError($(path), $.NSUTF8StringEncoding, null);
    return ObjC.unwrap(data);
}
eval(readFile('./game.js'));
const { Player, Enemy, CONSTANTS, CHARACTER_GIMMICKS } = globalThis.GameLogic;

// 剣士の2つ目のギミックは巨大ノーツを廃止し、無重力に置き換わっている
if (CHARACTER_GIMMICKS.swordsman[1].special !== 'zeroGravity') {
    throw new Error('swordsman gimmick[1] should be zeroGravity, got ' + CHARACTER_GIMMICKS.swordsman[1].special);
}

// zeroGravity中のPlayer.update: 通常の間合いAI(敵への接近)を完全に停止し、
// ふわふわとした緩やかな漂いに置き換わる。間合い外にいる遠くの敵がいても近づかない
const p = new Player('p1', 'swordsman', true);
p.x = 200;
p.y = CONSTANTS.GROUND_Y;
// floatVX/floatVYは乱数で決まるため、地面(上限)にいきなり張り付いて動けなくなる
// 運任せのケースを避けるよう、上方向へのドリフトを決め打ちしてテストを決定的にする
p.floatVX = 0;
p.floatVY = -1;
p.floatDriftTimer = 999;
const farEnemy = new Enemy('normal', 900, CONSTANTS.GROUND_Y, 1);
for (let i = 0; i < 30; i++) {
    p.update(1 / 60, 0, [farEnemy], false, true); // zeroGravity=true
}
if (Math.abs(p.x - 200) > 50) {
    throw new Error('a floating player should drift gently, not chase a distant enemy across the stage, x moved to ' + p.x);
}
if (p.y >= CONSTANTS.GROUND_Y) {
    throw new Error('a floating player should drift upward off the ground level over time, y stayed at ' + p.y);
}

// zeroGravity中のEnemy.update: プレイヤーへの接近・攻撃開始を一切行わない
const e = new Enemy('normal', 850, CONSTANTS.GROUND_Y, 1);
const nearPlayer = new Player('p1', 'swordsman', true);
nearPlayer.x = 850;
nearPlayer.y = CONSTANTS.GROUND_Y;
const startX = e.x;
for (let i = 0; i < 60; i++) {
    e.update(1 / 60, [nearPlayer], 0, [e], true); // zeroGravity=true
}
if (e.isAttacking || e.attackWarning) {
    throw new Error('a floating enemy should never start an attack while zero gravity is active');
}
if (Math.abs(e.x - startX) > 50) {
    throw new Error('a floating enemy should drift gently, not close in on the player, x moved from ' + startX + ' to ' + e.x);
}

console.log('ZERO GRAVITY GIMMICK OK');
