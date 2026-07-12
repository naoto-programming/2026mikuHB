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
const { GameLogic } = globalThis;
if (!GameLogic) throw new Error('GameLogic not exported');
if (typeof GameLogic.Player !== 'function') throw new Error('Player class missing');
if (typeof GameLogic.Enemy !== 'function') throw new Error('Enemy class missing');
if (!Array.isArray(GameLogic.CHARACTERS) || GameLogic.CHARACTERS.length === 0) throw new Error('CHARACTERS missing');
console.log('SMOKE OK');
