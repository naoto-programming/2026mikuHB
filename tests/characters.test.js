ObjC.import('Foundation');
function readFile(path) {
    const data = $.NSString.stringWithContentsOfFileEncodingError($(path), $.NSUTF8StringEncoding, null);
    return ObjC.unwrap(data);
}
eval(readFile('./game.js'));
const { CHARACTERS } = globalThis.GameLogic;

if (CHARACTERS.length !== 6) throw new Error('expected 6 characters, got ' + CHARACTERS.length);
const ids = CHARACTERS.map(c => c.id);
if (ids.includes('spirit') || ids.includes('dragon')) throw new Error('spirit/dragon should be removed');
const diffs = CHARACTERS.map(c => c.diff);
if (JSON.stringify(diffs) !== JSON.stringify([1,2,3,4,5,6])) throw new Error('diff should be 1..6, got ' + JSON.stringify(diffs));
console.log('CHARACTERS OK');
