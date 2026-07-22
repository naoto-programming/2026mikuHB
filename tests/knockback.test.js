ObjC.import('Foundation');
function readFile(path) {
    const data = $.NSString.stringWithContentsOfFileEncodingError($(path), $.NSUTF8StringEncoding, null);
    return ObjC.unwrap(data);
}
eval(readFile('./game.js'));
const { Enemy, Player, CONSTANTS } = globalThis.GameLogic;

const e = new Enemy('normal', 400, 600, 1);
if (e.knockbackTimer !== 0) throw new Error('knockbackTimer should start at 0');

e.takeDamage(9999, 'sword'); // lethal hit
if (!e.dead) throw new Error('enemy should be dead after lethal damage');
if (!(e.knockbackTimer > 0)) throw new Error('a lethal hit should start a knockback timer');
if (e.knockbackDir !== 1 && e.knockbackDir !== -1) throw new Error('knockbackDir should be -1 or 1, got ' + e.knockbackDir);

// ノックバック中は通常のupdate処理（追跡・攻撃）を行わず、時間経過だけする
const xBefore = e.x;
e.update(0.1, [], 0, [e]);
if (e.x === xBefore) throw new Error('enemy should move during its knockback animation');
if (!e.dead) throw new Error('enemy should remain dead during knockback');

// 十分な時間が経てばknockbackTimerが尽きる
for (let i = 0; i < 60; i++) e.update(0.1, [], 0, [e]);
if (e.knockbackTimer > 0) throw new Error('knockbackTimer should eventually reach 0');

// どの攻撃でも、生きている間はヒットするたびに軽く仰け反る(致命傷ではない通常ヒット)
const e2 = new Enemy('normal', 400, 600, 1);
if (e2.hitKnockbackTimer !== 0) throw new Error('hitKnockbackTimer should start at 0');
e2.takeDamage(1, 'sword'); // 致命傷ではない軽いダメージ
if (e2.dead) throw new Error('a small hit should not kill the enemy');
if (!(e2.hitKnockbackTimer > 0)) throw new Error('a non-lethal hit should start a brief hit-knockback');
const e2xBefore = e2.x;
e2.update(1 / 60, [], 0, [e2]);
if (e2.x === e2xBefore) throw new Error('the enemy should move during its hit-knockback');

// ブラックホールに吸い込まれている/tween移動中は、位置が別の仕組みで制御されているため
// ヒットノックバックを適用しない(弊害が起きるため)
const e3 = new Enemy('normal', 400, 600, 1);
e3.blackHoleState = 'sucked';
e3.takeDamage(1, 'sword');
if (e3.hitKnockbackTimer > 0) throw new Error('a sucked-in enemy must not receive hit-knockback');

const e4 = new Enemy('normal', 400, 600, 1);
e4.tween = { fromX: 0, fromY: 0, toX: 10, toY: 0, timer: 0, duration: 0.4, onComplete: null };
e4.takeDamage(1, 'sword');
if (e4.hitKnockbackTimer > 0) throw new Error('an enemy mid-tween must not receive hit-knockback');

// 高さ関係によるノックバックの向き: 攻撃者(attackerY)が自分より高い(yが小さい)場合、
// 自分はさらに上へ跳ね上がる(上向き=負のY速度)
const e5 = new Enemy('normal', 400, 600, 1);
e5.y = 600;
e5.takeDamage(1, 'sword', 500); // 攻撃者は自分より高い(y=500 < 600)
if (!(e5.hitKnockbackVY < 0)) throw new Error('knockback should have an upward (negative) vertical velocity, got ' + e5.hitKnockbackVY);

// 攻撃者が自分より低くても、地面に沈まないよう必ず上向きの成分を持つ
const e6 = new Enemy('normal', 400, 600, 1);
e6.y = 400;
e6.takeDamage(1, 'sword', 600); // 攻撃者は自分より低い(y=600 > 400)
if (!(e6.hitKnockbackVY < 0)) throw new Error('knockback must still have an upward component even when the attacker is lower, got ' + e6.hitKnockbackVY);

// ノックバック中、タイマーが切れた時点でまだ空中でも、宙に浮いたままにならず地面へ戻る
const e7 = new Enemy('normal', 400, 600, 1);
e7.groundY = 600;
e7.y = 600;
e7.takeDamage(1, 'sword', 600);
for (let i = 0; i < 30; i++) e7.update(1 / 60, [], 0, [e7]); // 0.25秒のタイマーを超えて回す
if (e7.hitKnockbackTimer > 0) throw new Error('hitKnockbackTimer should have expired by now');
if (e7.y !== e7.groundY) throw new Error('the enemy should settle back exactly at groundY once knockback ends, got ' + e7.y);

// プレイヤーもダメージを受けたらノックバックする(敵と同様、しっかりとした仰け反り)
const p = new Player('p1', 'swordsman', true);
p.x = 400;
p.y = CONSTANTS.GROUND_Y;
if (p.hitKnockbackTimer !== 0) throw new Error('player hitKnockbackTimer should start at 0');
p.takeDamage(5);
if (!(p.hitKnockbackTimer > 0)) throw new Error('taking damage should start a knockback for the player too');
const pxBefore = p.x;
p.update(1 / 60, 0, []);
if (p.x === pxBefore) throw new Error('the player should move during its hit-knockback');
if (!(p.hitKnockbackVY < 0)) throw new Error('the player knockback should have an upward (negative) vertical velocity');

// 無敵中はダメージそのものを受けないため、ノックバックも発生しない
const pInvincible = new Player('p1', 'swordsman', true);
pInvincible.invincible = 1;
pInvincible.takeDamage(5);
if (pInvincible.hitKnockbackTimer > 0) throw new Error('an invincible player should not take damage or receive knockback');

console.log('KNOCKBACK OK');
