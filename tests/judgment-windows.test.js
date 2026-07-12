ObjC.import('Foundation');
function readFile(path) {
    const data = $.NSString.stringWithContentsOfFileEncodingError($(path), $.NSUTF8StringEncoding, null);
    return ObjC.unwrap(data);
}
eval(readFile('./game.js'));
const { CONSTANTS } = globalThis.GameLogic;

if (CONSTANTS.PERFECT_WINDOW !== 0.09) throw new Error('PERFECT_WINDOW should be 0.09, got ' + CONSTANTS.PERFECT_WINDOW);
if (CONSTANTS.GREAT_WINDOW !== 0.18) throw new Error('GREAT_WINDOW should be 0.18, got ' + CONSTANTS.GREAT_WINDOW);
if (CONSTANTS.GOOD_WINDOW !== 0.30) throw new Error('GOOD_WINDOW should be 0.30, got ' + CONSTANTS.GOOD_WINDOW);

console.log('JUDGMENT WINDOWS OK');
