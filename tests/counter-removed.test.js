ObjC.import('Foundation');
function readFile(path) {
    const data = $.NSString.stringWithContentsOfFileEncodingError($(path), $.NSUTF8StringEncoding, null);
    return ObjC.unwrap(data);
}
eval(readFile('./game.js'));
const { Enemy, Player } = globalThis.GameLogic;

const e = new Enemy('normal', 400, 600, 1);
if (typeof e.resolveCounter === 'function') throw new Error('Enemy.resolveCounter should be removed');
if ('attackWarning' in e) throw new Error('Enemy should no longer have attackWarning');
if ('counterable' in e) throw new Error('Enemy should no longer have counterable');

// 敵の攻撃は無条件でプレイヤーにダメージを与える（カウンター分岐が無い）
const p = new Player('p1', 'swordsman', true);
p.x = 400; p.y = 600;
e.x = 400; e.y = 600;
const hpBefore = p.hp;
e.executeAttack([p], []);
if (p.hp !== hpBefore - e.atk) throw new Error('enemy attack should always deal atk damage now, no counter branch');

if (typeof p.counter === 'function') throw new Error('Player.counter should be removed');
if ('isCountering' in p) throw new Error('Player should no longer have isCountering');

console.log('COUNTER REMOVED OK');
