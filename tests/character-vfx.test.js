ObjC.import('Foundation');
function readFile(path) {
    const data = $.NSString.stringWithContentsOfFileEncodingError($(path), $.NSUTF8StringEncoding, null);
    return ObjC.unwrap(data);
}
eval(readFile('./game.js'));
const { Renderer, Player, CHARACTERS } = globalThis.GameLogic;

function makeMockCtx() {
    const noop = () => {};
    const ctx = {};
    ['beginPath','arc','stroke','fill','moveTo','lineTo','closePath','save','restore',
     'translate','rotate','scale','drawImage','ellipse'].forEach(m => ctx[m] = noop);
    ['strokeStyle','fillStyle','lineWidth','shadowColor','shadowBlur','globalAlpha'].forEach(p => ctx[p] = '');
    return ctx;
}

const renderer = Object.create(Renderer.prototype);
const ctx = makeMockCtx();

CHARACTERS.forEach(char => {
    const p = new Player('p1', char.id, true);
    p.facing = 1;
    renderer.renderAttackEffect(ctx, p, 400, 600, {});
    renderer.renderAbilityEffect(ctx, p, 400, 600);
});

console.log('CHARACTER VFX OK');
