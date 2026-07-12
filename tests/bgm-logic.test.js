ObjC.import('Foundation');
function readFile(path) {
    const data = $.NSString.stringWithContentsOfFileEncodingError($(path), $.NSUTF8StringEncoding, null);
    return ObjC.unwrap(data);
}
eval(readFile('./game.js'));
const { BGM_TRACKS, bpmFromTrackFilename, pickRandomTrack, computeStageMaxDistance } = globalThis.GameLogic;

if (BGM_TRACKS.length !== 4) throw new Error('expected 4 tracks, got ' + (BGM_TRACKS && BGM_TRACKS.length));
if (bpmFromTrackFilename('79拍:分1.mp3') !== 79) throw new Error('bpm parse 79-1 failed');
if (bpmFromTrackFilename('90拍:分.mp3') !== 90) throw new Error('bpm parse 90 failed');
if (bpmFromTrackFilename('110拍:分.mp3') !== 110) throw new Error('bpm parse 110 failed');

for (let i = 0; i < 50; i++) {
    const t = pickRandomTrack();
    if (!BGM_TRACKS.includes(t)) throw new Error('pickRandomTrack returned a track not in BGM_TRACKS');
}

const dist = computeStageMaxDistance(90, 2);
if (dist !== 90 * 2 * 60) throw new Error('computeStageMaxDistance wrong: ' + dist);

console.log('BGM LOGIC OK');
