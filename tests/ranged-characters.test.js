ObjC.import('Foundation');
function readFile(path) {
    const data = $.NSString.stringWithContentsOfFileEncodingError($(path), $.NSUTF8StringEncoding, null);
    return ObjC.unwrap(data);
}
eval(readFile('./game.js'));
const { Player, CHARACTERS } = globalThis.GameLogic;

const archerChar = CHARACTERS.find(c => c.id === 'archer');
const mageChar = CHARACTERS.find(c => c.id === 'mage');
if (archerChar.rangeMultiplier !== 3) throw new Error('archer should have rangeMultiplier 3, got ' + archerChar.rangeMultiplier);
if (mageChar.rangeMultiplier !== 3) throw new Error('mage should have rangeMultiplier 3, got ' + mageChar.rangeMultiplier);

const swordsman = new Player('p1', 'swordsman', true);
const archer = new Player('p1', 'archer', true);
if (archer.getAttackRange() !== swordsman.getAttackRange() * 3) {
    throw new Error('archer attack range should be 3x swordsman, got ' + archer.getAttackRange() + ' vs ' + swordsman.getAttackRange());
}

console.log('RANGED CHARACTERS OK');
