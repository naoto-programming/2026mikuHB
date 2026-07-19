ObjC.import('Foundation');
function readFile(path) {
    const data = $.NSString.stringWithContentsOfFileEncodingError($(path), $.NSUTF8StringEncoding, null);
    return ObjC.unwrap(data);
}
eval(readFile('./game.js'));
const { BGM_TRACKS, bpmFromTrackFilename, pickRandomTrack, computeTotalWaves } = globalThis.GameLogic;

if (BGM_TRACKS.length !== 22) throw new Error('expected 22 tracks, got ' + (BGM_TRACKS && BGM_TRACKS.length));
if (bpmFromTrackFilename('79拍:分1.mp3') !== 79) throw new Error('bpm parse 79-1 failed');
if (bpmFromTrackFilename('90拍:分.mp3') !== 90) throw new Error('bpm parse 90 failed');
if (bpmFromTrackFilename('110拍:分.mp3') !== 110) throw new Error('bpm parse 110 failed');

for (let i = 0; i < 50; i++) {
    const t = pickRandomTrack();
    if (!BGM_TRACKS.includes(t)) throw new Error('pickRandomTrack returned a track not in BGM_TRACKS');
}

// excludeTrackを渡すと、同じ曲が連続で選ばれない
for (let i = 0; i < 50; i++) {
    const prev = BGM_TRACKS[Math.floor(Math.random() * BGM_TRACKS.length)];
    const next = pickRandomTrack(prev);
    if (next.file === prev.file) throw new Error('pickRandomTrack should not repeat the excluded (previous) track');
    if (!BGM_TRACKS.includes(next)) throw new Error('pickRandomTrack(exclude) returned a track not in BGM_TRACKS');
}

const waves = computeTotalWaves(90, 15);
if (waves !== 3) throw new Error('computeTotalWaves(90,15) wrong: ' + waves);

console.log('BGM LOGIC OK');
