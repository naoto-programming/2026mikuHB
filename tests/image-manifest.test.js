ObjC.import('Foundation');
function readFile(path) {
    const data = $.NSString.stringWithContentsOfFileEncodingError($(path), $.NSUTF8StringEncoding, null);
    return ObjC.unwrap(data);
}
// eval is used here to load the game's own source into the JXA test
// harness's global scope (same pattern as every other test in tests/*.test.js);
// it only ever evaluates this repo's own trusted game.js, not external input.
eval(readFile('./game.js'));
const { IMAGE_MANIFEST, CHARACTERS, ENEMY_TYPES } = globalThis.GameLogic;

CHARACTERS.forEach(c => {
    if (!IMAGE_MANIFEST.charSprites[c.id]) throw new Error('missing sprite for character: ' + c.id);
});

Object.keys(ENEMY_TYPES).forEach(type => {
    if (!IMAGE_MANIFEST.enemySprites[type]) throw new Error('missing sprite for enemy type: ' + type);
});

console.log('IMAGE MANIFEST OK');
