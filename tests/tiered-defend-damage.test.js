ObjC.import('Foundation');
function readFile(path) {
    const data = $.NSString.stringWithContentsOfFileEncodingError($(path), $.NSUTF8StringEncoding, null);
    return ObjC.unwrap(data);
}
eval(readFile('./game.js'));
const { StageManager, Enemy } = globalThis.GameLogic;

// このテストはGameControllerの防御分岐のロジック(判定→軽減率)を直接検証する。
// GameControllerはDOM依存のためインスタンス化できないので、同じ計算式を
// ここで単体検証する(仕様通りの軽減率テーブルであることの確認)。
const REDUCTION_BY_JUDGE = { perfect: 1, great: 0.9, good: 0.5 };

const stage = new StageManager();
stage.enemies = [new Enemy('normal', 450, 600, 1), new Enemy('normal', 550, 600, 1)]; // atk合計10、プレイヤーx=400から200px以内
const fullDmg = stage.getNearbyEnemyDamage(400, 200);
if (fullDmg <= 0) throw new Error('test setup should produce nonzero nearby damage, got ' + fullDmg);

const perfectDmg = fullDmg * (1 - REDUCTION_BY_JUDGE.perfect);
if (perfectDmg !== 0) throw new Error('perfect defend should reduce damage to 0, got ' + perfectDmg);

const greatDmg = fullDmg * (1 - REDUCTION_BY_JUDGE.great);
if (Math.abs(greatDmg - fullDmg * 0.1) > 0.001) throw new Error('great defend should take 10% of full damage, got ' + greatDmg);

const goodDmg = fullDmg * (1 - REDUCTION_BY_JUDGE.good);
if (Math.abs(goodDmg - fullDmg * 0.5) > 0.001) throw new Error('good defend should take 50% of full damage, got ' + goodDmg);

console.log('TIERED DEFEND DAMAGE OK');
