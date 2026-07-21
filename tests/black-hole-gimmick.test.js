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

// 吸い込みはテレポートではなく、tweenで中心へ滑らかに移動してから
// blackHoleState==='sucked'に切り替わる(通常AIは一切行わない)
const suckingIn = new Enemy('normal', 100, CONSTANTS.GROUND_Y, 1);
suckingIn.blackHoleState = 'suckingIn';
suckingIn.blackHoleCenterX = 640;
suckingIn.blackHoleCenterY = 250;
suckingIn.tween = { fromX: 100, fromY: CONSTANTS.GROUND_Y, toX: 640, toY: 250, timer: 0, duration: 0.35, onComplete: 'blackHoleSucked' };
for (let i = 0; i < 30; i++) { // 0.5秒分、tweenの duration(0.35s)より長く回す
    suckingIn.update(1 / 60, [], 0, [suckingIn]);
}
if (suckingIn.blackHoleState !== 'sucked') throw new Error('after the tween completes, the enemy should become sucked, got ' + suckingIn.blackHoleState);
if (Math.abs(suckingIn.x - 640) > suckingIn.orbitRadius + 1 || Math.abs(suckingIn.y - 250) > suckingIn.orbitRadius + 1) {
    throw new Error('a sucked-in enemy should end up orbiting near the black hole center');
}
if (suckingIn.isAttacking || suckingIn.attackWarning) {
    throw new Error('a sucking-in/sucked enemy must never start an attack');
}

// 吸い込まれた状態(sucked)の敵は、一点に留まらずブラックホール内部を個別に周回する
const sucked = new Enemy('normal', 500, CONSTANTS.GROUND_Y, 1);
sucked.blackHoleState = 'sucked';
sucked.blackHoleCenterX = 500;
sucked.blackHoleCenterY = 250;
sucked.orbitAngle = 0;
sucked.orbitRadius = 30;
sucked.orbitSpeed = 5;
const startAngle = sucked.orbitAngle;
sucked.update(1 / 60, [], 0, [sucked]);
if (sucked.orbitAngle === startAngle) throw new Error('a sucked-in enemy should keep orbiting (its angle should advance each frame)');
if (Math.hypot(sucked.x - 500, sucked.y - 250) > sucked.orbitRadius + 1) {
    throw new Error('a sucked-in enemy should stay within its orbit radius around the black hole center');
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
