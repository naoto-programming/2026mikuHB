ObjC.import('Foundation');
function readFile(path) {
    const data = $.NSString.stringWithContentsOfFileEncodingError($(path), $.NSUTF8StringEncoding, null);
    return ObjC.unwrap(data);
}
// eval() here loads the local, trusted game.js (not external/untrusted input) to expose
// globalThis.GameLogic for testing - the same established pattern used by every test in this suite.
eval(readFile('./game.js'));
const { RhythmSystem, AudioSystem, CONSTANTS, Enemy, Player, applyAbility,
    MAGE_WATER_RADIUS, MAGE_FIRE_RADIUS, MAGE_WIND_RADIUS, MAGE_THUNDER_RANGE } = globalThis.GameLogic;

function audioNodeStub() {
    return {
        connect: () => {}, disconnect: () => {}, start: () => {}, stop: () => {},
        frequency: { setValueAtTime: () => {}, exponentialRampToValueAtTime: () => {} },
        gain: { setValueAtTime: () => {}, exponentialRampToValueAtTime: () => {} },
    };
}
function makeAudio(bpm) {
    const audio = new AudioSystem();
    audio.bpm = bpm; audio.isPlaying = true;
    audio.ctx = { currentTime: 0, createOscillator: () => audioNodeStub(), createGain: () => audioNodeStub() };
    audio.masterGain = audioNodeStub();
    audio.startTime = 0;
    return audio;
}

// 魔法使いB「イベントノーツ」: ノーツを取りこぼした(タップせず素通りさせた)時、レーンの
// 種類(攻撃/防御/能力)に関わらず、そのノーツが持つeventColorがonJudgeへ渡される
const audio = makeAudio(120);
const rhythm = new RhythmSystem(audio);
const beatInterval = 60 / 120;
rhythm.combo = 5;
rhythm.abilityActive = true;
const abilityLaneEventNote = {
    id: rhythm.noteId++, beat: 1, type: 'ability', hit: false, missed: false,
    eventNote: true, eventColor: 'fire',
};
rhythm.abilityNotes.push(abilityLaneEventNote);
let captured = null;
rhythm.onJudge = (judge, points, combo, eventColor) => { captured = { judge, points, combo, eventColor }; };
audio.ctx.currentTime = (1 * beatInterval) + CONSTANTS.GOOD_WINDOW + 0.01;
rhythm.update();
if (!abilityLaneEventNote.missed) throw new Error('an untapped event note should eventually be marked missed');
if (!captured || captured.judge !== 'miss' || captured.eventColor !== 'fire') {
    throw new Error('a missed event note (even on the ability lane) must fire onJudge with its eventColor, got ' + JSON.stringify(captured));
}
if (rhythm.combo !== 5) {
    throw new Error('missing an event note must not touch the normal combo (it is a fully separate, self-contained mechanic), expected combo to stay 5, got ' + rhythm.combo);
}

// getNotesForRender: 描画上の消失タイミングは、実際に判定不能になる猶予(GOOD_WINDOW)と
// 一致していなければならない(以前は固定-0.5拍だったため、BPMが速い曲ではまだ判定可能な
// ノーツが先に見えなくなってしまうズレがあった)
const audio2 = makeAudio(134);
const rhythm2 = new RhythmSystem(audio2);
const beatInterval2 = 60 / 134;
const missWindowBeats = CONSTANTS.GOOD_WINDOW * (134 / 60);
rhythm2.swordNotes.push({ id: 0, beat: 4, type: 'sword', hit: false, missed: false });
// GOOD_WINDOWのほんの少し内側(まだ判定可能なはず)
audio2.ctx.currentTime = (4 + missWindowBeats * 0.9) * beatInterval2;
const stillVisible = rhythm2.getNotesForRender({});
if (!stillVisible.some(n => n.beat === 4)) {
    throw new Error('a note still within its hittable GOOD_WINDOW must still be visible on screen');
}

// 魔法使い「ノーツメテオ」(能力ノーツのバースト効果): 即座にダメージを適用せず、対象と
// 予定ダメージだけをpendingMeteorとして返す(実際のダメージは呼び出し側でメテオ演出が
// 着地した瞬間まで遅延させ、「ノーツ直撃→爆発→ダメージ」の順に見えるようにするため)
const mageEnemies = [new Enemy('normal', 500, CONSTANTS.GROUND_Y, 1)];
const mage = new Player('p1', 'mage', true);
const outcome = applyAbility('mage', 1, mage, mageEnemies, mage.x);
if (outcome.hits.length !== 0) {
    throw new Error('mage ability damage must not be applied immediately via result.hits, got ' + outcome.hits.length + ' immediate hits');
}
if (!outcome.pendingMeteor || outcome.pendingMeteor.length === 0) {
    throw new Error('mage ability should report its intended target(s) via pendingMeteor');
}
if (mageEnemies[0].hp !== mageEnemies[0].maxHp) {
    throw new Error('the target enemy HP must not be reduced yet at the moment applyAbility returns');
}

// イベントノーツ各色の射程は、水→炎→風→雷の順に段階的に大きくなる
// (地震は全体攻撃なので射程という概念自体が無く、この比較には含めない)
if (!(MAGE_WATER_RADIUS < MAGE_FIRE_RADIUS)) {
    throw new Error('water\'s range should be smaller than fire\'s, water=' + MAGE_WATER_RADIUS + ' fire=' + MAGE_FIRE_RADIUS);
}
if (!(MAGE_FIRE_RADIUS < MAGE_WIND_RADIUS)) {
    throw new Error('fire\'s range should be smaller than wind\'s, fire=' + MAGE_FIRE_RADIUS + ' wind=' + MAGE_WIND_RADIUS);
}
if (!(MAGE_WIND_RADIUS < MAGE_THUNDER_RANGE)) {
    throw new Error('wind\'s range should be smaller than thunder\'s, wind=' + MAGE_WIND_RADIUS + ' thunder=' + MAGE_THUNDER_RANGE);
}

console.log('MAGE EVENT NOTES OK');
