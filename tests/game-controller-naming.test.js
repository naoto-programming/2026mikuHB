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

// Regression lock-in for the "Game.showModeSelect is not a function" bug.
//
// Root cause: game.js used to declare `class Game { ... }` at top level AND
// separately assign `window.Game = { showModeSelect: ..., ... }` as a plain
// object exposing methods for index.html's `onclick="Game.showModeSelect()"`
// attributes. In a real (non-module) <script> tag, top-level class/let/const
// declarations live in the global lexical environment, which shadows same-named
// properties on `window` when a bare identifier is resolved. So the bare `Game`
// in onclick="Game.showModeSelect()" resolved to the ENGINE CLASS, not the
// window.Game wrapper object.
//
// Critically, `showModeSelect` is an INSTANCE method (defined in the class
// body, living on `Game.prototype.showModeSelect`) - it is NOT a static
// method on the class function object itself (`Game.showModeSelect`). So
// when the bare identifier `Game` resolved to the class, `Game.showModeSelect`
// (property lookup directly on the class/function object, not on its
// prototype, and with no instance in sight) was undefined, producing
// "Game.showModeSelect is not a function" for every single onclick button.
//
// The fix renames the engine class to `GameController`, leaving `window.Game`
// as the sole thing named `Game` in scope, so onclick handlers resolve to the
// wrapper object's bound instance methods correctly.
//
// This test cannot reproduce real browser lexical-scope shadowing (JXA's eval
// sandbox doesn't have the same classic-script global-lexical-environment
// semantics as an actual <script> tag), so it can't directly re-create the
// TypeError. What it CAN and does lock in:
//   1. There is no longer any top-level class named exactly `Game` - the
//      engine class now lives under `GameLogic.GameController`.
//   2. That class genuinely has no STATIC `showModeSelect` property directly
//      on the class/function object - this confirms *why* the old collision
//      was fatal (`Game.showModeSelect` - class-as-static-lookup - was always
//      undefined, even though `Game.prototype.showModeSelect` exists), and
//      guards against a future refactor re-introducing a class literally
//      named `Game` that would again collide with `window.Game`.
//   3. The instance method DOES exist on the prototype (sanity check that
//      we're testing the real shape of the class, not an empty stub).
if (typeof GameLogic.GameController !== 'function') {
    throw new Error('GameLogic.GameController should be the renamed engine class (a function/constructor)');
}
if (typeof GameLogic.GameController.showModeSelect === 'function') {
    throw new Error('GameController.showModeSelect (static, directly on the class) should NOT exist - this is what made the original naming collision produce "is not a function" when bare `Game.showModeSelect()` resolved to the class itself');
}
if (typeof GameLogic.GameController.prototype.showModeSelect !== 'function') {
    throw new Error('GameController.prototype.showModeSelect should exist as an instance method (sanity check that this is really the game engine class)');
}
if (typeof GameLogic.Game !== 'undefined') {
    throw new Error('GameLogic should no longer export anything named Game (the engine class was renamed to GameController)');
}

console.log('GAME-CONTROLLER-NAMING OK');
