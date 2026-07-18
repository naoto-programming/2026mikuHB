ObjC.import('Foundation');
function readFile(path) {
    const data = $.NSString.stringWithContentsOfFileEncodingError($(path), $.NSUTF8StringEncoding, null);
    return ObjC.unwrap(data);
}
eval(readFile('./game.js'));
const { AudioSystem, RhythmSystem } = globalThis.GameLogic;

function makeAudio() {
    const audio = new AudioSystem();
    audio.bpm = 120;
    audio.isPlaying = true;
    audio.ctx = {
        currentTime: 0,
        createOscillator() { return { connect(){}, start(){}, stop(){}, frequency:{setValueAtTime(){}, exponentialRampToValueAtTime(){}} }; },
        createGain() { return { connect(){}, gain:{value:0, setValueAtTime(){}, exponentialRampToValueAtTime(){}} }; },
        createBufferSource() { return { connect(){}, start(){}, stop(){} }; },
        createBuffer() { return { getChannelData(){ return new Float32Array(100); } }; },
        createBiquadFilter() { return { connect(){}, frequency:{value:0} }; },
    };
    audio.startTime = 0;
    return audio;
}

// latencyOffsetが0の間はgetInputBeatとgetCurrentBeatは一致する
const audio = makeAudio();
audio.ctx.currentTime = 1.0;
if (Math.abs(audio.getInputBeat() - audio.getCurrentBeat()) > 1e-9) {
    throw new Error('getInputBeat should match getCurrentBeat when latencyOffset is 0');
}

// latencyOffsetを設定すると、その分だけgetInputBeatが過去側にずれる
audio.latencyOffset = 0.2; // 200ms
const beatInterval = 60 / audio.bpm;
const expectedShift = 0.2 / beatInterval;
if (Math.abs((audio.getCurrentBeat() - audio.getInputBeat()) - expectedShift) > 1e-9) {
    throw new Error('getInputBeat should be shifted earlier by latencyOffset/beatInterval beats');
}

// checkInputAny/checkInputは判定にgetInputBeatを使うため、出力遅延がある状態で
// 「音を聞いてから遅れて叩いた」タップも正しく拾える
const rhythm = new RhythmSystem(audio);
rhythm.startSwordBurst(4, {});
rhythm.swordNotes.forEach((n, i) => { if (i > 0) n.missed = true; });
const noteBeat = rhythm.swordNotes[0].beat;
// 遅延分だけ遅れてタップした状況を再現する(本来のノーツのタイミングにlatencyOffset秒を足す)
audio.ctx.currentTime = (noteBeat * beatInterval) + audio.latencyOffset;
const result = rhythm.checkInputAny({});
if (!result || result.judge !== 'perfect') {
    throw new Error('a tap delayed by exactly the calibrated latency should still resolve as perfect, got ' + JSON.stringify(result));
}

console.log('AUDIO LATENCY OFFSET OK');
