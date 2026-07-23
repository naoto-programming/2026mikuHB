ObjC.import('Foundation');
function readFile(path) {
    const data = $.NSString.stringWithContentsOfFileEncodingError($(path), $.NSUTF8StringEncoding, null);
    return ObjC.unwrap(data);
}
// eval() here loads the local, trusted game.js (not external/untrusted input) to expose
// globalThis.GameLogic for testing - the same established pattern used by every test in this suite.
eval(readFile('./game.js'));
const { CHARACTERS, CHARACTER_GIMMICKS, ABILITY_FUSION_TABLE,
    ABILITY_SHOWCASE_ABILITIES, ABILITY_SHOWCASE_GIMMICKS, ABILITY_FUSION_EFFECT_TEXT } = globalThis.GameLogic;

// 能力・ギミック図鑑: 各キャラの「能力」紹介データが、CHARACTERS全員分きちんと揃っていること
CHARACTERS.forEach(c => {
    const entry = ABILITY_SHOWCASE_ABILITIES.find(a => a.charId === c.id);
    if (!entry) throw new Error('missing ability showcase entry for character: ' + c.id);
    if (!['circle', 'directional', 'meteor'].includes(entry.shape)) {
        throw new Error('ability showcase entry for ' + c.id + ' has an invalid shape: ' + entry.shape);
    }
});

// 固有ギミック紹介データが、CHARACTER_GIMMICKSの全キャラ×2ギミック分きちんと揃っていること
Object.keys(CHARACTER_GIMMICKS).forEach(charId => {
    CHARACTER_GIMMICKS[charId].forEach((gimmick, idx) => {
        const entry = ABILITY_SHOWCASE_GIMMICKS.find(g => g.charId === charId && g.idx === idx);
        if (!entry) throw new Error('missing gimmick showcase entry for ' + charId + ' idx=' + idx);
        if (!entry.name || !entry.desc) throw new Error('gimmick showcase entry for ' + charId + ' idx=' + idx + ' is missing name/desc');
        if (!['circle', 'directional', 'random', 'none', 'launchedNote'].includes(entry.shape)) {
            throw new Error('gimmick showcase entry for ' + charId + ' idx=' + idx + ' has an invalid shape: ' + entry.shape);
        }
        if (entry.special !== gimmick.special) {
            throw new Error('gimmick showcase entry for ' + charId + ' idx=' + idx + ' has special="' + entry.special +
                '" but CHARACTER_GIMMICKS says "' + gimmick.special + '" - practice mode needs these to match exactly');
        }
        if (!['sword', 'ability'].includes(entry.laneType)) {
            throw new Error('gimmick showcase entry for ' + charId + ' idx=' + idx + ' has an invalid laneType: ' + entry.laneType);
        }
        if (!(entry.noteInterval > 0)) {
            throw new Error('gimmick showcase entry for ' + charId + ' idx=' + idx + ' needs a positive noteInterval to drive its practice note stream');
        }
    });
});
if (ABILITY_SHOWCASE_GIMMICKS.length !== Object.values(CHARACTER_GIMMICKS).reduce((n, g) => n + g.length, 0)) {
    throw new Error('ABILITY_SHOWCASE_GIMMICKS should have exactly one entry per character gimmick, no extras');
}

// 融合技一覧は既存のABILITY_FUSION_TABLE(15組)をそのまま流用しているので、
// ここでも同じ15件が揃っていることだけ確認する(重複データを持たないため)
if (Object.keys(ABILITY_FUSION_TABLE).length !== 15) {
    throw new Error('expected 15 fusion techniques to be available for the showcase, got ' + Object.keys(ABILITY_FUSION_TABLE).length);
}

// 融合技の説明文(「〇〇の効果がある能力である」の〇〇部分)が、15組全てに具体的な
// 効果の説明として用意されていること(抽象的な「組み合わせた能力」だけで終わらないため)
Object.keys(ABILITY_FUSION_TABLE).forEach(key => {
    const text = ABILITY_FUSION_EFFECT_TEXT[key];
    if (!text) throw new Error('missing a concrete effect description for fusion: ' + key);
});

console.log('ABILITY SHOWCASE OK');
