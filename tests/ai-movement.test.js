ObjC.import('Foundation');
function readFile(path) {
    const data = $.NSString.stringWithContentsOfFileEncodingError($(path), $.NSUTF8StringEncoding, null);
    return ObjC.unwrap(data);
}
// eval is safe here: this is a local JXA test harness loading this repo's own
// trusted game.js (same pattern used by every other test in tests/*.test.js).
eval(readFile('./game.js'));
const { Player, Enemy } = globalThis.GameLogic;

const p = new Player('p1', 'swordsman', true);
p.x = 200;
const farEnemy = new Enemy('normal', 700, 600, 1);

// 敵が遠くにいれば、その方向へ自動で近づく
p.update(0.1, 0, [farEnemy]);
if (!(p.x > 200)) throw new Error('player should move toward a distant enemy automatically, x=' + p.x);

// 攻撃中は移動しない（既存の仕様を維持）
const p2 = new Player('p1', 'swordsman', true);
p2.x = 200;
p2.attack();
const xBeforeAttack = p2.x;
p2.update(0.1, 0, [farEnemy]);
if (Math.abs(p2.x - xBeforeAttack) > 1) throw new Error('player should not move while isAttacking is true (vx should just decay), moved by ' + (p2.x - xBeforeAttack));

// 敵がいない場合は例外にならず、その場に留まる
const p3 = new Player('p1', 'swordsman', true);
p3.x = 300;
p3.update(0.1, 0, []);
if (typeof p3.x !== 'number' || Number.isNaN(p3.x)) throw new Error('player x should remain a valid number with no enemies present');

console.log('AI MOVEMENT OK');
