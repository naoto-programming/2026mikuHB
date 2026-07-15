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

console.log('PERFECT DASH OK');
