ObjC.import('Foundation');
function readFile(path) {
    const data = $.NSString.stringWithContentsOfFileEncodingError($(path), $.NSUTF8StringEncoding, null);
    return ObjC.unwrap(data);
}
eval(readFile('./game.js'));
const { Enemy, CONSTANTS, CHARACTER_GIMMICKS } = globalThis.GameLogic;

// 剣士の2つ目のギミックは無重力を廃止し、ブラックホールに置き換わっている
if (CHARACTER_GIMMICKS.swordsman[1].special !== 'blackHole') {
    throw new Error('swordsman gimmick[1] should be blackHole, got ' + CHARACTER_GIMMICKS.swordsman[1].special);
}

// ブラックホールに吸い込まれた敵(blackHoleState==='sucked')は、爆発で解放されるまで
// 完全に静止する(通常の接近・攻撃AIは一切行わない)
const sucked = new Enemy('normal', 500, CONSTANTS.GROUND_Y, 1);
sucked.blackHoleState = 'sucked';
const startX = sucked.x, startY = sucked.y;
for (let i = 0; i < 60; i++) {
    sucked.update(1 / 60, [], 0, [sucked]);
}
if (sucked.x !== startX || sucked.y !== startY) {
    throw new Error('a sucked-in enemy must not move at all while held in the black hole');
}
if (sucked.isAttacking || sucked.attackWarning) {
    throw new Error('a sucked-in enemy must never start an attack');
}

// 爆発で吹き飛ばされた敵(blackHoleState==='flying')は、通常AIを止めて弾道だけを動かす。
// 重力を受けて落下方向へ加速していく
const flying = new Enemy('normal', 500, 200, 1);
flying.blackHoleState = 'flying';
flying.flyVX = 100;
flying.flyVY = 0;
const startFlyingX = flying.x, startFlyingY = flying.y;
flying.update(1 / 60, [], 0, [flying]);
if (flying.x <= startFlyingX) {
    throw new Error('a flying enemy should move according to flyVX');
}
if (flying.y <= startFlyingY) {
    throw new Error('a flying enemy should fall due to gravity acting on flyVY');
}
if (flying.isAttacking || flying.attackWarning) {
    throw new Error('a flying enemy must never start an attack mid-flight');
}

console.log('BLACK HOLE GIMMICK OK');
