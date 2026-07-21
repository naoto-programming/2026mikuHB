ObjC.import('Foundation');
function readFile(path) {
    const data = $.NSString.stringWithContentsOfFileEncodingError($(path), $.NSUTF8StringEncoding, null);
    return ObjC.unwrap(data);
}
eval(readFile('./game.js'));
const { Enemy } = globalThis.GameLogic;

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

console.log('KNOCKBACK OK');
