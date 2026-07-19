ObjC.import('Foundation');
function readFile(path) {
    const data = $.NSString.stringWithContentsOfFileEncodingError($(path), $.NSUTF8StringEncoding, null);
    return ObjC.unwrap(data);
}
eval(readFile('./game.js'));
const { applyAbility, Enemy, Player } = globalThis.GameLogic;

function makePlayer(charId) {
    return new Player('t1', charId, true);
}

// 剣士「回転切り」: 範囲(250px)内の全敵にヒットする
{
    const player = makePlayer('swordsman');
    const near = new Enemy('normal', 100, 0, 1);
    const far = new Enemy('normal', 1000, 0, 1);
    const outcome = applyAbility('swordsman', 1, player, [near, far], 100);
    if (outcome.hits.length !== 1) throw new Error('swordsman ability should only hit enemies within 250px, got ' + outcome.hits.length);
    if (outcome.hits[0].enemy !== near) throw new Error('swordsman ability hit the wrong enemy');
}

// 弓士「貫通弓」: 向いている方向ではなく、能力範囲(450px)内で敵がより多くいる側にヒットする
{
    const player = makePlayer('archer');
    player.facing = -1; // 向いている方向は後方(敵が少ない側)
    const behind = new Enemy('normal', -50, 0, 1); // facingと同じ側だが1体だけ
    const ahead1 = new Enemy('normal', 100, 0, 1); // facingと逆側に2体
    const ahead2 = new Enemy('normal', 300, 0, 1);
    const outcome = applyAbility('archer', 1, player, [behind, ahead1, ahead2], 0);
    if (outcome.hits.length !== 2) throw new Error('archer ability should aim toward the side with more enemies in range, got ' + outcome.hits.length);
    if (outcome.hits.some(h => h.enemy === behind)) throw new Error('archer ability should not hit the side with fewer enemies, hit ' + JSON.stringify(outcome.hits));
}

// 盗賊「4回攻撃」(1回分): 基本攻撃と同じ間合いの敵全てにヒットする(単体攻撃ではない)、バフは発生しない
{
    const player = makePlayer('thief');
    player.x = 0;
    const range = player.getAttackRange();
    const near1 = new Enemy('normal', range * 0.3, 0, 1);
    const near2 = new Enemy('normal', -range * 0.5, 0, 1);
    const far = new Enemy('normal', range + 50, 0, 1);
    const outcome = applyAbility('thief', 1, player, [near1, near2, far], 0);
    if (outcome.hits.length !== 2) throw new Error('thief ability should hit every enemy within the basic attack range in one call, got ' + outcome.hits.length);
    if (outcome.hits.some(h => h.enemy === far)) throw new Error('thief ability should not hit enemies outside the basic attack range');
    if (outcome.buff) throw new Error('thief ability should no longer grant any buff');
}

// 拳士「吹き飛ばし」: 長距離(450px)の全敵にヒットし、ノックバックで位置がプレイヤーから離れる
{
    const player = makePlayer('fighter');
    player.x = 0;
    const target = new Enemy('normal', 100, 0, 1);
    const xBefore = target.x;
    const outcome = applyAbility('fighter', 1, player, [target], 0);
    if (outcome.hits.length !== 1) throw new Error('fighter ability should hit the enemy within 450px');
    if (!(target.x > xBefore)) throw new Error('fighter ability should knock the enemy further away from the player, x moved by ' + (target.x - xBefore));
}

// 獣人「突進引っ掻き」: facing方向・中距離(250px)の敵にヒットし、弱いノックバックが発生する
{
    const player = makePlayer('beast');
    player.facing = 1;
    player.x = 0;
    const ahead = new Enemy('normal', 100, 0, 1);
    const behind = new Enemy('normal', -100, 0, 1);
    const xBefore = ahead.x;
    const outcome = applyAbility('beast', 1, player, [ahead, behind], 0);
    if (outcome.hits.length !== 1) throw new Error('beast ability should only hit the enemy ahead, got ' + outcome.hits.length);
    if (!(ahead.x > xBefore)) throw new Error('beast ability should knock the target back a little, x moved by ' + (ahead.x - xBefore));
}

// 魔法使い「ノーツメテオ」: 距離を問わず生存中の敵から、全員ではなくランダムな数体(1体以上、
// 生存数以下)にだけヒットする
{
    const player = makePlayer('mage');
    for (let trial = 0; trial < 20; trial++) {
        // 弱ダメージとはいえ繰り返し当てると倒れてしまうため、毎回新しい敵で試行する
        const enemies = [new Enemy('normal', 100, 0, 1), new Enemy('normal', 5000, 0, 1), new Enemy('normal', -300, 0, 1)];
        const outcome = applyAbility('mage', 1, player, enemies, 0);
        if (outcome.hits.length < 1 || outcome.hits.length > enemies.length) {
            throw new Error('mage ability should hit between 1 and all alive enemies, got ' + outcome.hits.length);
        }
        const hitEnemies = new Set(outcome.hits.map(h => h.enemy));
        if (hitEnemies.size !== outcome.hits.length) throw new Error('mage ability should not hit the same enemy twice');
        outcome.hits.forEach(h => {
            if (!enemies.includes(h.enemy)) throw new Error('mage ability hit an enemy that was not in the provided list');
        });
    }
}

// 全Missでも最低性能で発動する(0ダメージにはならない)
{
    const player = makePlayer('swordsman');
    const enemies = [new Enemy('normal', 0, 0, 1)];
    const outcome = applyAbility('swordsman', 0, player, enemies, 0);
    if (outcome.hits[0].dmg <= 0) throw new Error('all-miss ability should still deal reduced (non-zero) damage');
}

console.log('ABILITIES OK');
