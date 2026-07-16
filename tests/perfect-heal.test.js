ObjC.import('Foundation');
function readFile(path) {
    const data = $.NSString.stringWithContentsOfFileEncodingError($(path), $.NSUTF8StringEncoding, null);
    return ObjC.unwrap(data);
}
eval(readFile('./game.js'));
const { Player, resolvePerfectHeal } = globalThis.GameLogic;

// resolvePerfectHealが15%判定のロジックを持つことを、Math.randomを差し替えて検証する
const p = new Player('p1', 'swordsman', true);
p.hp = p.maxHp - 50;

const origRandom = Math.random;

Math.random = () => 0.1; // 0.15未満 -> 回復する
const hpBefore1 = p.hp;
resolvePerfectHeal(p);
if (p.hp === hpBefore1) throw new Error('resolvePerfectHeal should heal when the roll is below the threshold');

Math.random = () => 0.9; // 0.15以上 -> 回復しない
const hpBefore2 = p.hp;
resolvePerfectHeal(p);
if (p.hp !== hpBefore2) throw new Error('resolvePerfectHeal should not heal when the roll is above the threshold');

Math.random = origRandom;
console.log('PERFECT HEAL OK');
