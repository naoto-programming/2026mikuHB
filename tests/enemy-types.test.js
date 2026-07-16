ObjC.import('Foundation');
function readFile(path) {
    const data = $.NSString.stringWithContentsOfFileEncodingError($(path), $.NSUTF8StringEncoding, null);
    return ObjC.unwrap(data);
}
eval(readFile('./game.js'));
const { Enemy, ENEMY_TYPES } = globalThis.GameLogic;

// 自爆敵は命中の有無に関わらず攻撃解決時に自壊する
const suicide = new Enemy('suicide', 500, 600, 1);
suicide.isAttacking = true;
suicide.attackTimer = 0;
suicide.executeAttack([], []);
if (!suicide.dead) throw new Error('suicide enemy should self-destruct after attacking');

// ヒーラー敵は最もHPが減っている味方を回復する（プレイヤーにはダメージを与えない）
const healer = new Enemy('healer', 100, 600, 1);
const ally1 = new Enemy('normal', 200, 600, 1);
const ally2 = new Enemy('normal', 300, 600, 1);
ally1.hp = ally1.maxHp;
ally2.hp = 1;
healer.isAttacking = true;
healer.attackTimer = 0;
healer.executeAttack([], [healer, ally1, ally2]);
if (ally2.hp <= 1) throw new Error('healer should have healed the lowest-HP ally');
if (ally1.hp !== ally1.maxHp) throw new Error('healer should not touch the full-HP ally');


// エリートはmod補正込みでも過剰に高いatkにならないよう緩和されている
const eliteMod = 1.5; // spawnEliteが使うmod * 1.5相当
const eliteBaseAtk = ENEMY_TYPES.elite.atk * eliteMod;
const elite = new Enemy('elite', 500, 600, eliteMod);
if (elite.atk > eliteBaseAtk * 0.7) {
    throw new Error('elite atk should be reduced to at most 70% of its unmitigated value, got ' + elite.atk + ' vs unmitigated ' + eliteBaseAtk);
}

console.log('ENEMY TYPES OK');
