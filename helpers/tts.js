// azure-cognitiveservices-speech.js
require('dotenv').config()
const sdk = require('microsoft-cognitiveservices-speech-sdk');
const blendShapeNames = require('./blendshapeNames');
const _ = require('lodash');

// e.g. Drive metahuman with blend shapes/visme id https://github.com/lucoiso/UEAzSpeech/issues/235  https://learn.microsoft.com/en-us/answers/questions/1185396/azure-speech-poor-viseme-blendshape-quality

// NOTE: FacialExpression (blend shapes) supports neural voices only in en-US and zh-CN locales. redlips_front – (lip-sync with viseme ID and audio offset output) only supports neural voices in en-US locale.
let SSML = `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xmlns:mstts="http://www.w3.org/2001/mstts" xml:lang="en-US">
<voice name="en-US-AnaNeural">
  <mstts:viseme type="FacialExpression"/>
  __TEXT__
</voice>
</speak>`;

const key = process.env.SPEECH_KEY;//AZURE_KEY;
const region = process.env.SPEECH_REGION;//AZURE_REGION;
        
/**
 * Node.js server code to convert text to speech
 * @returns stream
 * @param {*} key your resource key
 * @param {*} region your resource region
 * @param {*} text text to convert to audio/speech
 * @param {*} filename optional - best for long text - temp file for converted speech/audio
 */
const textToSpeech = async (text, voice) => {
  return new Promise((resolve, reject) => {
    let ssml = SSML.replace("__TEXT__", text);
    
    const speechConfig = sdk.SpeechConfig.fromSubscription(key, region);
    speechConfig.speechSynthesisOutputFormat = sdk.SpeechSynthesisOutputFormat.Audio48Khz192KBitRateMonoMp3;

    let randomString = Math.random().toString(36).slice(2, 7);
    let filename = `./public/speech-${randomString}.mp3`;
    let audioConfig = sdk.AudioConfig.fromAudioFileOutput(filename);

    let blendData = [];
    let timeStep = 1/60;
    let timeStamp = 0;

    const synthesizer = new sdk.SpeechSynthesizer(speechConfig, audioConfig);

    synthesizer.visemeReceived = function (s, e) {
      try {
        if (!e.animation) {
          console.error("No animation data received", JSON.stringify(e));
          return;
        }
        console.log("(Viseme), Audio offset: " + e.audioOffset / 10000 + "ms. Viseme ID: " + e.visemeId);

        console.debug("Viseme animation:", JSON.stringify(e.animation));
        var animation = /*e.animation;*/JSON.parse(e.animation);

        _.each(animation.BlendShapes, blendArray => {
          let blend = {};
          _.each(blendShapeNames, (shapeName, i) => {
            blend[shapeName] = blendArray[i];
          });
          blendData.push({
            time: timeStamp,
            blendshapes: blend
          });
          timeStamp += timeStep;
        });
      } catch (err) {
        console.error("Error parsing viseme animation:", err);
      }
      console.debug("Viseme animation blendData:", JSON.stringify(blendData));
    }

    synthesizer.speakSsmlAsync(
      ssml,
      result => {
        synthesizer.close();
        console.log(`Speech synthesis succeeded: filename: /speech-${randomString}.mp3`);
        resolve({ blendData, filename: `/speech-${randomString}.mp3` });
      },
      error => {
        console.error("Error during speech synthesis:", error);
        synthesizer.close();
        reject(error);
      }
    );
  });
};

module.exports = textToSpeech;
