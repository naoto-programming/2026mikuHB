ObjC.import('Foundation');
function readFile(path) {
    const data = $.NSString.stringWithContentsOfFileEncodingError($(path), $.NSUTF8StringEncoding, null);
    return ObjC.unwrap(data);
}
eval(readFile('./game.js'));
const { Player } = globalThis.GameLogic;

// perfectPulseは移動せず、その場でタイマーのみ進行する
const p = new Player('p1', 'mage', true);
p.perfectPulse();
if (p.pulseTimer <= 0) throw new Error('perfectPulse should set a positive pulseTimer');

const xBefore = p.x;
p.update(0.05, 0, []);
if (p.x !== xBefore) throw new Error('perfectPulse should not move the player, x changed by ' + (p.x - xBefore));
if (p.pulseTimer <= 0) throw new Error('pulseTimer should still be counting down mid-pulse');

p.update(1, 0, []);
if (p.pulseTimer !== 0) throw new Error('pulseTimer should be fully consumed, got ' + p.pulseTimer);

console.log('PERFECT PULSE OK');
