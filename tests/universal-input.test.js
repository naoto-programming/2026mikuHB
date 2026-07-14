ObjC.import('Foundation');
function readFile(path) {
    const data = $.NSString.stringWithContentsOfFileEncodingError($(path), $.NSUTF8StringEncoding, null);
    return ObjC.unwrap(data);
}
eval(readFile('./game.js'));
const { RhythmSystem, AudioSystem } = globalThis.GameLogic;

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

// 剣ノーツしか無くても、種類を指定せず自動で見つけて判定できる
{
    const audio = makeAudio();
    const rhythm = new RhythmSystem(audio);
    rhythm.startSwordBurst(4);
    // startSwordBurstはLOOKAHEAD分先の小節頭にノーツを置くため、判定窓(GOOD_WINDOW)に
    // 入るには時間経過が必要。実プレイ同様にクロックを最初のノーツの拍まで進める。
    const beatInterval = 60 / audio.bpm;
    audio.ctx.currentTime = rhythm.swordNotes[0].beat * beatInterval;
    const result = rhythm.checkInputAny();
    if (!result) throw new Error('checkInputAny should find the nearest sword note without specifying a type');
    if (result.note.type !== 'sword') throw new Error('expected a sword note, got ' + result.note.type);
}

// 防御ノーツが剣ノーツより近ければ、防御が優先して判定される
{
    const audio = makeAudio();
    const rhythm = new RhythmSystem(audio);
    rhythm.startSwordBurst(4); // 現状のstartSwordBurstは小節頭+LOOKAHEAD分先から始まる
    rhythm.generateDefendNote(0); // ちょうど現在拍
    const result = rhythm.checkInputAny();
    if (!result) throw new Error('checkInputAny should find the nearest note across pools');
    if (result.note.type !== 'defend') throw new Error('expected the closer defend note to win, got ' + result.note.type);
}

// 何もノーツが無ければnull
{
    const audio = makeAudio();
    const rhythm = new RhythmSystem(audio);
    if (rhythm.checkInputAny() !== null) throw new Error('checkInputAny should return null when no note is in range');
}

console.log('UNIVERSAL INPUT OK');
