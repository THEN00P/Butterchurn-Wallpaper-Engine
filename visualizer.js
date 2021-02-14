window.wallpaperSettings = {
    fps: 60
};

window.wallpaperPropertyListener = {
    applyGeneralProperties: function(properties) {
        if (properties.fps) {
            wallpaperSettings.fps = properties.fps;
        }
    },
    applyUserProperties: function(properties) {
        console.log(properties);
    }
};

var readyStateCheckInterval = setInterval(() => {
    if (document.readyState === "complete") {
        clearInterval(readyStateCheckInterval);

        const canvas = document.getElementById('canvas');
        const visualizer = butterchurn.default.createVisualizer(null, canvas , {
          width: 800,
          height: 600,
          mesh_width: 64,
          mesh_height: 48,
          pixelRatio: window.devicePixelRatio || 1,
          textureRatio: 1
        });
        visualizer.loadExtraImages(butterchurnExtraImages.default.getImages());

        const presets = Object.assign({},
            butterchurnPresets.getPresets(),
            butterchurnPresetsExtra.getPresets(),
            butterchurnPresetsExtra2.getPresets());
        const presetKeys = Object.keys(presets);
        const presetIndexHist = [];

        const fftConvert64 = new FFT(64, 1024, false);
        
        let presetCycle = true;
        let nextPreset, prevPreset, restartCycleInterval, cycleInterval, toggleRandomize;

        const setVisualizerSize = () => {
            const vizWidth = window.innerWidth;
            const vizHeight = window.innerHeight;

            canvas.width = vizWidth;
            canvas.height = vizHeight;
            visualizer.setRendererSize(vizWidth, vizHeight);
        };

        nextPreset = (blendTime) => {
            const presetIdx = presets[presetKeys[Math.floor(presetKeys.length * Math.random())]];
            presetIndexHist.push(presetIdx);
            visualizer.loadPreset(presetIdx, blendTime);
            restartCycleInterval();
        };

        prevPreset = (blendTime) => {
            let presetIdx;
            if (presetIndexHist.length > 0) {
                presetIndexHist.pop();
      
                if (presetIndexHist.length > 0) {
                    presetIdx = presetIndexHist[presetIndexHist.length - 1];
                } else {
                    presetIdx = presets[presetKeys[Math.floor(presetKeys.length * Math.random())]];
                }
            } else {
                presetIdx = presets[presetKeys[Math.floor(presetKeys.length * Math.random())]];
            }
      
            visualizer.loadPreset(presetIdx, blendTime);
            restartCycleInterval();
        };
      
        restartCycleInterval = () => {
            if (cycleInterval) {
                clearInterval(cycleInterval);
                cycleInterval = null;
            }
      
            if (presetCycle) {
                cycleInterval = setInterval(() => {
                    nextPreset(2.7);
                }, 24000);
            }
        };
      
        toggleRandomize = () => {
            presetCycle = !presetCycle;
            restartCycleInterval();
        };

        setVisualizerSize();
        nextPreset(0);

        let lastTime = +Date.now();

        let lastAudioArray = [];
        let newAudioArray = [];
        let interpolCycle = 1;

        audioListener = (audioArray) => {
            for(let i in audioArray) {
                audioArray[i] = 256*audioArray[i];
            }
            
            lastAudioArray = newAudioArray;
            newAudioArray = audioArray;

            interpolCycle = 1;
        }
        
        window.wallpaperRegisterAudioListener(audioListener);

        let x = 0;

        renderDbg = (audioArray) => {
            let audioCanvas = document.getElementById('dbgCanvas');
            let audioCanvasCtx = dbgCanvas.getContext('2d');

            audioCanvasCtx.fillStyle = 'rgb(0,0,0)';
            audioCanvasCtx.fillRect(0, 0, audioCanvas.width, audioCanvas.height);
    
            // Render bars along the full width of the canvas
            var barWidth = Math.round(1.0 / 128.0 * audioCanvas.width);
    
            if(x>dbgCanvas.width) x = 0
            else x+=5;

            audioCanvasCtx.fillStyle = 'rgb(255,0,0)';
            audioCanvasCtx.fillRect(x,0,10,10)
            // Begin with the left channel in red
            // Iterate over the first 64 array elements (0 - 63) for the left channel audio data
            for (var i = 0; i < audioArray.length; ++i) {
                audioCanvasCtx.fillRect(barWidth * i, audioCanvas.height - audioArray[i]/5, barWidth, audioArray[i]/2);
            }
        }

        animationStep = () => {
            const currentTime = +Date.now();
            const elapsedTime = (currentTime - lastTime) / 1000;
            lastTime = currentTime;

            let audioArray = [];

            if(interpolCycle < (wallpaperSettings.fps / 30)) {
                for(let i in newAudioArray) {
                    audioArray[i] = lastAudioArray[i]+(((newAudioArray[i] - lastAudioArray[i]) / (wallpaperSettings.fps / 30)) * interpolCycle)
                }

                interpolCycle++;
            }
            else {
                audioArray = newAudioArray;
            }

            let audioArrayL = audioArray.slice(0,64);
            let audioArrayR = audioArray.slice(64,128);
            
            let combinedArray = audioArrayL.map(function (num, idx) {
                return (num + audioArrayR[idx])/2;
            });

            // renderDbg(fftConvert64.timeToFrequencyDomain(combinedArray));

            visualizer.render({
                elapsedTime: elapsedTime,
                audioLevels: {
                    timeByteArray: fftConvert64.timeToFrequencyDomain(combinedArray),
                    timeByteArrayL: fftConvert64.timeToFrequencyDomain(audioArrayL),
                    timeByteArrayR: fftConvert64.timeToFrequencyDomain(audioArrayR)
                }
            });

            let renderTime = (Date.now() - currentTime) / 1000

            setTimeout(() => {
                window.requestAnimationFrame(animationStep)
            }, (1/wallpaperSettings.fps - renderTime)*1000);
        }
        
        window.requestAnimationFrame(animationStep);

        let mouseClicks = 0;
        let timeout = null;

        canvas.onclick = () => {
            mouseClicks++;
            if(!timeout) timeout = setTimeout(() => {
                if(mouseClicks == 3) toggleRandomize();
                if(mouseClicks > 3) nextPreset(2.7);
                clearTimeout(timeout);
                mouseClicks = 0;
                timeout = null;
            }, 1000);
        };
    }
}, 10);