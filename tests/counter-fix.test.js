ObjC.import('Foundation');
function readFile(path) {
    const data = $.NSString.stringWithContentsOfFileEncodingError($(path), $.NSUTF8StringEncoding, null);
    return ObjC.unwrap(data);
}
eval(readFile('./game.js'));
const { Enemy } = globalThis.GameLogic;

// 致死ダメージの場合: 敵は死に、攻撃状態は解除される
const e = new Enemy('normal', 400, 600, 1);
e.startAttack();
e.attackTimer = 0.5;
e.attackWarning = true;
e.counterable = true;
e.resolveCounter(9999);

if (!e.dead) throw new Error('enemy should die from lethal counter damage');
if (e.isAttacking) throw new Error('isAttacking should be reset by resolveCounter');
if (e.attackWarning) throw new Error('attackWarning should be reset by resolveCounter');

// 生存する場合でも、元の攻撃サイクルは完全にキャンセルされ、スタン明けに再着弾しない
const e2 = new Enemy('large', 400, 600, 1);
e2.startAttack();
e2.attackTimer = 0.5;
e2.attackWarning = true;
e2.counterable = true;
e2.resolveCounter(1);

if (e2.dead) throw new Error('e2 should survive a weak counter hit');
if (e2.isAttacking) throw new Error('surviving enemy should still have its attack cycle cancelled');

const players = [];
for (let i = 0; i < 200; i++) {
    e2.update(1/60, players, 0, [e2]);
}
if (e2.isAttacking) throw new Error('cancelled attack must not resume after stun expires');

console.log('COUNTER FIX OK');
