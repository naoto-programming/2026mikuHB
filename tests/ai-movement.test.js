ObjC.import('Foundation');
function readFile(path) {
    const data = $.NSString.stringWithContentsOfFileEncodingError($(path), $.NSUTF8StringEncoding, null);
    return ObjC.unwrap(data);
}
// eval is safe here: this is a local JXA test harness loading this repo's own
// trusted game.js (same pattern used by every other test in tests/*.test.js).
eval(readFile('./game.js'));
const { Player, Enemy, CONSTANTS } = globalThis.GameLogic;

// 複数人プレイで全員が重ならないよう、各プレイヤーは個別のcenterOffsetを持つ(ランダム)。
// この基本AIの挙動テストでは、それを0に固定して決定的に検証する
function makeTestPlayer(charId) {
    const p = new Player('p1', charId, true);
    p.centerOffset = 0;
    return p;
}

// 敵が遠く（間合いの4倍より外）にいる間は中央付近に留まろうとする
const p = makeTestPlayer('swordsman');
const centerX = CONSTANTS.CANVAS_WIDTH / 2;
p.x = centerX + 300; // 中央から大きくズレた位置からスタート
const farEnemy = new Enemy('normal', centerX + 300 + 2000, 600, 1);
for (let i = 0; i < 200; i++) p.update(0.1, 0, [farEnemy]);
if (Math.abs(p.x - centerX) > 100) throw new Error('player should settle back near center when no enemy is close, x=' + p.x);

// 間合いの近くまで来た敵には少しだけ迎撃に動く
const p2 = makeTestPlayer('swordsman');
p2.x = centerX;
const nearEnemy = new Enemy('normal', centerX + p2.getAttackRange() * 2, 600, 1);
const xBefore = p2.x;
p2.update(0.1, 0, [nearEnemy]);
if (!(p2.x > xBefore)) throw new Error('player should nudge toward a nearby approaching enemy, x moved by ' + (p2.x - xBefore));

// 攻撃中は移動しない（既存の仕様を維持）
const p3 = makeTestPlayer('swordsman');
p3.x = centerX;
p3.attack();
const xBeforeAttack = p3.x;
p3.update(0.1, 0, [nearEnemy]);
if (Math.abs(p3.x - xBeforeAttack) > 1) throw new Error('player should not move while isAttacking is true, moved by ' + (p3.x - xBeforeAttack));

// 複数人プレイでの重なり防止: 各プレイヤーはcenterOffsetを持ち、遠くに敵がいない間は
// それぞれ自分のオフセット分だけずれた位置に落ち着く(全員が同じ座標に重ならない)
const p4 = new Player('p1', 'swordsman', true);
p4.centerOffset = 70;
p4.x = centerX;
for (let i = 0; i < 200; i++) p4.update(0.1, 0, [farEnemy]);
if (Math.abs(p4.x - (centerX + 70)) > 20) {
    throw new Error('a player with a nonzero centerOffset should settle near center+offset, x=' + p4.x);
}

console.log('AI MOVEMENT OK');
