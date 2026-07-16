ObjC.import('Foundation');
function readFile(path) {
    const data = $.NSString.stringWithContentsOfFileEncodingError($(path), $.NSUTF8StringEncoding, null);
    return ObjC.unwrap(data);
}
eval(readFile('./game.js'));
const { Enemy, Player, ENEMY_TYPES } = globalThis.GameLogic;

if (typeof ENEMY_TYPES.normal.counterable !== 'boolean') throw new Error('ENEMY_TYPES entries need a counterable flag');

// カウンター可能な敵: 防御成功で大ダメージ+スタン、被弾なし
const counterableEnemy = new Enemy('normal', 400, 600, 1);
counterableEnemy.startAttack();
counterableEnemy.attackTimer = 0.01; // 直後に解決させる
const p1 = new Player('p1', 'swordsman', true);
p1.x = 400; p1.y = 600;
p1.defend();
const hpBefore1 = p1.hp;
counterableEnemy.executeAttack([p1], []);
if (p1.hp !== hpBefore1) throw new Error('defending against a counterable attack should prevent all damage');
if (!(counterableEnemy.stunTimer > 0)) throw new Error('counterable enemy should be stunned after a successful defend');

// 回避のみ可能な敵: 防御成功で被弾は防ぐが、大ダメージ・スタンは無し
const dodgeEnemy = new Enemy('ranged', 400, 600, 1);
dodgeEnemy.startAttack();
dodgeEnemy.attackTimer = 0.01;
const p2 = new Player('p1', 'swordsman', true);
p2.x = 400; p2.y = 600;
p2.defend();
const hpBefore2 = p2.hp;
dodgeEnemy.executeAttack([p2], []);
if (p2.hp !== hpBefore2) throw new Error('defending against a dodge-only attack should still prevent damage');
if (dodgeEnemy.stunTimer > 0) throw new Error('dodge-only enemy should not be stunned by a defend');

// executeAttack自体はもう被弾ダメージを発生させない（ダメージは防御ノーツmiss時にRhythmSystem/StageManager経由でのみ発生する）
const p3 = new Player('p1', 'swordsman', true);
p3.x = 400; p3.y = 600;
const plainEnemy = new Enemy('normal', 400, 600, 1);
plainEnemy.startAttack();
plainEnemy.attackTimer = 0.01;
const hpBefore3 = p3.hp;
plainEnemy.executeAttack([p3], []);
if (p3.hp !== hpBefore3) throw new Error('executeAttack should no longer deal direct damage; damage now comes only from missed defend notes');

console.log('DEFEND SYSTEM OK');
