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

console.log('KNOCKBACK OK');
