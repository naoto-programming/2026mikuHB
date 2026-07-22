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

// ブラックホールに吸い込まれている間(吸い込まれる途中も含む)は無敵になり、
// 外部からのダメージを一切受けない
const invuln1 = new Enemy('normal', 500, CONSTANTS.GROUND_Y, 1);
invuln1.blackHoleState = 'sucked';
const hpBefore1 = invuln1.hp;
invuln1.takeDamage(9999, 'sword');
if (invuln1.hp !== hpBefore1 || invuln1.dead) {
    throw new Error('an enemy sucked into the black hole must be invulnerable to damage');
}

const invuln2 = new Enemy('normal', 500, CONSTANTS.GROUND_Y, 1);
invuln2.blackHoleState = 'suckingIn';
const hpBefore2 = invuln2.hp;
invuln2.takeDamage(9999, 'sword');
if (invuln2.hp !== hpBefore2 || invuln2.dead) {
    throw new Error('an enemy still being sucked in must also be invulnerable to damage');
}

// 一方、爆発で解放され宙を飛んでいる間(flying)は、着地・衝突ダメージを受ける通常仕様のまま
const stillVulnerable = new Enemy('normal', 500, CONSTANTS.GROUND_Y, 1);
stillVulnerable.blackHoleState = 'flying';
stillVulnerable.takeDamage(9999, 'sword');
if (!stillVulnerable.dead) {
    throw new Error('a flying (already-launched) enemy should still be able to take damage normally');
}

// 高速で吹き飛んでいる最中(x座標が画面外判定の範囲を大きく超えることがある)でも、
// 通常敵向けの画面外dead化処理に巻き込まれてはいけない(GameController側の
// updateBlackHoleFlyingEnemiesが着地を検出するまで、flying状態のまま飛び続けるべき)。
// 以前はflying分岐にreturnがなく、末尾の共通処理(画面外なら問答無用でdead化)まで
// 流れてしまっていたため、水平方向に高速で飛ぶと戻ってこなくなる不具合があった
const fastFlying = new Enemy('normal', 500, 300, 1);
fastFlying.groundY = 600;
fastFlying.blackHoleState = 'flying';
fastFlying.flyVX = 5000;
fastFlying.flyVY = -50;
for (let i = 0; i < 10; i++) fastFlying.update(1 / 60, [], 0, [fastFlying]);
if (fastFlying.dead) {
    throw new Error('a fast-flying black-hole enemy must not be marked dead by the generic off-screen check; only updateBlackHoleFlyingEnemies should resolve its flying state');
}
if (fastFlying.blackHoleState !== 'flying') {
    throw new Error('the enemy should remain in the flying state until GameController resolves it, got ' + fastFlying.blackHoleState);
}

console.log('BLACK HOLE GIMMICK OK');
