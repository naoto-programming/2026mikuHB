ObjC.import('Foundation');
function readFile(path) {
    const data = $.NSString.stringWithContentsOfFileEncodingError($(path), $.NSUTF8StringEncoding, null);
    return ObjC.unwrap(data);
}
// eval is safe here: this is a local test runner loading our own trusted
// source file (game.js) from disk, not untrusted/external input. JXA/JSC has
// no native `require`/module loader, so eval is the standard way to load a
// classic (non-module) script into the global scope for testing.
eval(readFile('./game.js'));
const { applyAbility, Enemy, Player } = globalThis.GameLogic;

function makePlayer(charId) {
    return new Player('t1', charId, true);
}

// 剣士: 生存している敵全員にヒットする
{
    const player = makePlayer('swordsman');
    const enemies = [new Enemy('normal', 0, 0, 1), new Enemy('normal', 0, 0, 1)];
    const outcome = applyAbility('swordsman', 1, player, enemies);
    if (outcome.hits.length !== 2) throw new Error('swordsman ability should hit all alive enemies');
}

// 弓士: 最大5体まで
{
    const player = makePlayer('archer');
    const enemies = Array.from({ length: 8 }, () => new Enemy('normal', 0, 0, 1));
    const outcome = applyAbility('archer', 1, player, enemies);
    if (outcome.hits.length !== 5) throw new Error('archer ability should cap at 5 targets, got ' + outcome.hits.length);
}

// 盗賊: ダメージではなく速度バフ
{
    const player = makePlayer('thief');
    const enemies = [new Enemy('normal', 0, 0, 1)];
    const outcome = applyAbility('thief', 1, player, enemies);
    if (outcome.hits.length !== 0) throw new Error('thief ability should not deal direct damage');
    if (!outcome.buff || outcome.buff.type !== 'haste') throw new Error('thief ability should grant a haste buff');
}

// 拳士: 単体に複数回ヒット
{
    const player = makePlayer('fighter');
    const target = new Enemy('large', 0, 0, 1);
    const outcome = applyAbility('fighter', 1, player, [target]);
    if (outcome.hits.length < 2) throw new Error('fighter ability should hit the same target multiple times');
    if (outcome.hits.some(h => h.enemy !== target)) throw new Error('fighter ability should only hit the single target');
}

// 獣人: 最もHPが高い敵単体
{
    const player = makePlayer('beast');
    const weak = new Enemy('normal', 0, 0, 1);
    const strong = new Enemy('large', 0, 0, 1);
    const outcome = applyAbility('beast', 1, player, [weak, strong]);
    if (outcome.hits.length !== 1) throw new Error('beast ability should hit exactly one target');
    if (outcome.hits[0].enemy !== strong) throw new Error('beast ability should target the highest-HP enemy');
}

// 全Missでも最低性能で発動する(0ダメージにはならない)
{
    const player = makePlayer('swordsman');
    const enemies = [new Enemy('normal', 0, 0, 1)];
    const outcome = applyAbility('swordsman', 0, player, enemies);
    if (outcome.hits[0].dmg <= 0) throw new Error('all-miss ability should still deal reduced (non-zero) damage');
}

console.log('ABILITIES OK');
