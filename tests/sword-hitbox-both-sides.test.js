ObjC.import('Foundation');
function readFile(path) {
    const data = $.NSString.stringWithContentsOfFileEncodingError($(path), $.NSUTF8StringEncoding, null);
    return ObjC.unwrap(data);
}
eval(readFile('./game.js'));
const { Player } = globalThis.GameLogic;

const p = new Player('p1', 'swordsman', true);
p.x = 500;
p.facing = 1;
const boxFacingRight = p.getAttackHitbox();

p.facing = -1;
const boxFacingLeft = p.getAttackHitbox();

if (boxFacingRight.x !== boxFacingLeft.x || boxFacingRight.w !== boxFacingLeft.w) {
    throw new Error('attack hitbox must not depend on facing direction');
}

const range = p.getAttackRange();
if (boxFacingRight.w !== range * 2) throw new Error('hitbox width should span both directions (range*2), got ' + boxFacingRight.w);
if (boxFacingRight.x !== p.x - range) throw new Error('hitbox should be centered on the player, got x=' + boxFacingRight.x);

console.log('SWORD HITBOX BOTH SIDES OK');
