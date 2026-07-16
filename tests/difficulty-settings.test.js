ObjC.import('Foundation');
function readFile(path) {
    const data = $.NSString.stringWithContentsOfFileEncodingError($(path), $.NSUTF8StringEncoding, null);
    return ObjC.unwrap(data);
}
eval(readFile('./game.js'));
const { pickBurstPattern, BURST_PATTERNS, DIFFICULTY_BONUS, StageManager } = globalThis.GameLogic;

if (DIFFICULTY_BONUS.easy !== -2) throw new Error('easy bonus should be -2');
if (DIFFICULTY_BONUS.normal !== 0) throw new Error('normal bonus should be 0');
if (DIFFICULTY_BONUS.hard !== 2) throw new Error('hard bonus should be 2');

// pickBurstPatternはBURST_PATTERNSのいずれかを返す
for (let i = 0; i < 20; i++) {
    const pattern = pickBurstPattern(3);
    if (!BURST_PATTERNS.includes(pattern)) throw new Error('pickBurstPattern should return one of BURST_PATTERNS');
}

// effectiveDiffが高いほど、後半（密な）インデックスが選ばれる割合が高くなる
function countLastIndexPicks(diff, trials) {
    let count = 0;
    for (let i = 0; i < trials; i++) {
        const pattern = pickBurstPattern(diff);
        if (pattern === BURST_PATTERNS[BURST_PATTERNS.length - 1]) count++;
    }
    return count;
}
const lowDiffCount = countLastIndexPicks(1, 500);
const highDiffCount = countLastIndexPicks(8, 500);
if (highDiffCount <= lowDiffCount) {
    throw new Error('higher effectiveDiff should pick the densest pattern more often: low=' + lowDiffCount + ' high=' + highDiffCount);
}

// effectiveDiffが0以下でも重みが負にならず、正常に動作する
const patternAtZero = pickBurstPattern(0);
if (!BURST_PATTERNS.includes(patternAtZero)) throw new Error('pickBurstPattern should handle effectiveDiff <= 0 safely');

// StageManager.getStageModは難易度ボーナスを乗算する
const stage = new StageManager();
stage.stage = 1;
stage.subStage = 1;
stage.difficultyMult = 1;
const normalMod = stage.getStageMod();
stage.difficultyMult = 1.5;
const hardMod = stage.getStageMod();
if (hardMod !== normalMod * 1.5) throw new Error('getStageMod should multiply by difficultyMult');

console.log('DIFFICULTY SETTINGS OK');
