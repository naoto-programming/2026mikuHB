ObjC.import('Foundation');
function readFile(path) {
    const data = $.NSString.stringWithContentsOfFileEncodingError($(path), $.NSUTF8StringEncoding, null);
    return ObjC.unwrap(data);
}
eval(readFile('./game.js'));
const { Player } = globalThis.GameLogic;

// perfectDashは短時間のダッシュ状態を発生させる
const p = new Player('p1', 'swordsman', true);
p.perfectDash(1);
if (p.dashTimer <= 0) throw new Error('perfectDash should set a positive dashTimer');
if (p.dashDir !== 1) throw new Error('perfectDash should record the dash direction');

// ダッシュ中は通常より速く指定方向へ進む
const xBefore = p.x;
p.update(0.05, 0, []);
if (!(p.x > xBefore)) throw new Error('player should move forward while dashing, x moved by ' + (p.x - xBefore));
if (p.dashTimer <= 0) throw new Error('dashTimer should still be counting down mid-dash');

// ダッシュ時間を使い切ると速度がゼロにスナップする（ピシッと止まる）
p.update(1, 0, []);
if (p.dashTimer !== 0) throw new Error('dashTimer should be fully consumed and reset to 0, got ' + p.dashTimer);
if (p.vx !== 0) throw new Error('velocity should snap to 0 the instant the dash ends, got ' + p.vx);

// distanceを指定すると、ダッシュ時間内にちょうどその距離だけ移動する速度に調整される
// (獣人「突進引っ掻き」の突進が、実際の攻撃判定の範囲(250px)まで届くようにするための仕組み)
const beast = new Player('p2', 'beast', true);
const beastXBefore = beast.x;
beast.perfectDash(1, 250);
let travelled = 0;
for (let i = 0; i < 9; i++) { // dashTimer=0.15s、60fps換算で約9フレーム分
    const before = beast.x;
    beast.update(1 / 60, 0, []);
    travelled += beast.x - before;
}
if (Math.abs(travelled - 250) > 20) {
    throw new Error('perfectDash(dir, 250) should travel approximately 250px, got ' + travelled);
}

console.log('PERFECT DASH OK');
