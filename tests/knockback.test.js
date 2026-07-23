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

// ノックバックの強さはダメージ量に基づく: 弱い攻撃より強い攻撃の方がはっきり吹き飛ぶ
// (Enemyはランダムに耐性を持つことがあるため、比較のため明示的に無効化する)
const eWeak = new Enemy('normal', 400, 600, 1);
eWeak.y = 600;
eWeak.resistances = {};
eWeak.takeDamage(2, 'sword', 600); // 弱いダメージ
const eStrong = new Enemy('normal', 400, 600, 1);
eStrong.y = 600;
eStrong.resistances = {};
eStrong.takeDamage(25, 'sword', 600); // 強いダメージ(致命傷にはならない範囲)
if (!(Math.abs(eStrong.hitKnockbackVY) > Math.abs(eWeak.hitKnockbackVY))) {
    throw new Error('a stronger hit should produce stronger (upward) knockback velocity than a weaker hit, weak=' + eWeak.hitKnockbackVY + ' strong=' + eStrong.hitKnockbackVY);
}
if (!(eStrong.hitKnockbackPower > eWeak.hitKnockbackPower)) {
    throw new Error('hitKnockbackPower should scale up with damage, weak=' + eWeak.hitKnockbackPower + ' strong=' + eStrong.hitKnockbackPower);
}
// 敵の水平方向の吹っ飛びもダメージ量に応じて強くなる
const eWeakX = new Enemy('normal', 400, 600, 1);
eWeakX.resistances = {};
eWeakX.hitKnockbackDir = 1;
eWeakX.takeDamage(2, 'sword');
eWeakX.hitKnockbackDir = 1; // takeDamage内でランダムに決まる向きを固定して比較する
const weakDx = (() => { const before = eWeakX.x; eWeakX.update(1 / 60, [], 0, [eWeakX]); return eWeakX.x - before; })();
const eStrongX = new Enemy('normal', 400, 600, 1);
eStrongX.resistances = {};
eStrongX.takeDamage(25, 'sword');
eStrongX.hitKnockbackDir = 1;
const strongDx = (() => { const before = eStrongX.x; eStrongX.update(1 / 60, [], 0, [eStrongX]); return eStrongX.x - before; })();
if (!(strongDx > weakDx)) {
    throw new Error('a stronger hit should move the enemy further per frame than a weaker hit, weak=' + weakDx + ' strong=' + strongDx);
}

// 魔法使い「ノーツウィンド」で宙に浮いている間(windLifted)は、他のダメージ源からも
// 一切ダメージを受けない(風で飛んでいる間は攻撃対象から外れる)
const eWindLifted = new Enemy('normal', 400, 600, 1);
eWindLifted.windLifted = true;
const hpBeforeWindLifted = eWindLifted.hp;
eWindLifted.takeDamage(50, 'ability');
if (eWindLifted.hp !== hpBeforeWindLifted) throw new Error('a wind-lifted enemy should be immune to damage from other sources');

// knockbackMultが0の攻撃(魔法使いの雷・炎の継続ダメージ)は、ダメージは通っても
// ノックバックそのものが一切発生しない
const eNoKnockback = new Enemy('normal', 400, 600, 1);
const hpBeforeNoKb = eNoKnockback.hp;
eNoKnockback.takeDamage(5, 'ability', undefined, 0);
if (eNoKnockback.hp === hpBeforeNoKb) throw new Error('damage should still apply even when knockback is suppressed');
if (eNoKnockback.hitKnockbackTimer > 0) throw new Error('knockbackMult=0 should suppress hit-knockback entirely');

// verticalMultは、横方向のノックバックは維持したまま上方向の跳ね返りだけを弱める
// (魔法使いの地震: 全体を吹き飛ばすが上にはあまり跳ねさせたくない)
const eNormalKb = new Enemy('normal', 400, 600, 1);
eNormalKb.y = 600;
eNormalKb.resistances = {}; // Enemyはランダムに耐性を持つことがあるため、比較のため無効化する
eNormalKb.takeDamage(20, 'ability', 600);
const eWeakVertical = new Enemy('normal', 400, 600, 1);
eWeakVertical.y = 600;
eWeakVertical.resistances = {};
eWeakVertical.takeDamage(20, 'ability', 600, 1, 0.3);
if (!(eWeakVertical.hitKnockbackTimer > 0)) throw new Error('verticalMult should not suppress knockback entirely, horizontal knockback should still start');
if (!(Math.abs(eWeakVertical.hitKnockbackVY) < Math.abs(eNormalKb.hitKnockbackVY))) {
    throw new Error('a lower verticalMult should produce a weaker upward knockback, normal=' + eNormalKb.hitKnockbackVY + ' weak=' + eWeakVertical.hitKnockbackVY);
}
if (eWeakVertical.hitKnockbackPower !== eNormalKb.hitKnockbackPower) {
    throw new Error('verticalMult should only affect the vertical component, not the overall knockback power');
}

console.log('KNOCKBACK OK');
