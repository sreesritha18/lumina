const $ = (id) => document.getElementById(id);

const OPENTOK_SDK_URL = 'https://unpkg.com/@vonage/client-sdk-video@latest/dist/js/opentok.js';
const FIRST_READ_DELAY_MS = 1800;
const NEXT_ITEM_DELAY_MS = 3000;
const MAX_FRAME_WIDTH = 1024;

let mediaStream = null;
let vonageSession = null;
let vonagePublisher = null;
let activeVideoEl = null;
let canvas = null;
let readTimer = null;
let speechWatchdog = null;
let isBusy = false;
let isStarting = false;
let sessionActive = false;
let latestDescription = '';
let speechEnabled = true;

function once(fn) {
  let called = false;
  return () => {
    if (called) return;
    called = true;
    fn();
  };
}

function cancelSpeech() {
  if ('speechSynthesis' in window) window.speechSynthesis.cancel();
  clearTimeout(speechWatchdog);
  speechWatchdog = null;
}

function speak(text, onDone) {
  const done = once(() => {
    clearTimeout(speechWatchdog);
    speechWatchdog = null;
    if (onDone) onDone();
  });

  if (!speechEnabled || !('speechSynthesis' in window) || !text) {
    done();
    return;
  }

  cancelSpeech();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.onend = done;
  utterance.onerror = done;
  window.speechSynthesis.speak(utterance);

  // Chrome occasionally drops onend; without this the app would stay busy forever.
  speechWatchdog = setTimeout(done, 6000 + text.length * 90);
}

function setStatus(text) {
  $('status-text').textContent = text;
}

function setDescription(text) {
  $('description-text').textContent = text;
  latestDescription = text;
}

function setDescriptionTitle(text) {
  $('description-label').textContent = text;
}

function setSoundEnabled(enabled, announce = true) {
  speechEnabled = enabled;
  const button = $('sound-btn');
  button.setAttribute('aria-pressed', String(enabled));
  button.setAttribute('aria-label', enabled ? 'Turn spoken descriptions off' : 'Turn spoken descriptions on');

  if (!enabled) cancelSpeech();
  if (announce) {
    setStatus(enabled ? 'Spoken descriptions are on.' : 'Spoken descriptions are off.');
    if (enabled) speak('Spoken descriptions are on.');
  }
}

function scheduleRead(delayMs) {
  clearTimeout(readTimer);
  readTimer = setTimeout(() => takeReading(), delayMs);
}

function cancelScheduledRead() {
  clearTimeout(readTimer);
  readTimer = null;
}

function loadOpenTok() {
  return new Promise((resolve, reject) => {
    if (window.OT) return resolve(window.OT);
    const script = document.createElement('script');
    script.src = OPENTOK_SDK_URL;
    script.onload = () => (window.OT ? resolve(window.OT) : reject(new Error('Vonage Video SDK did not initialize')));
    script.onerror = () => reject(new Error('Failed to load Vonage Video SDK'));
    document.head.appendChild(script);
  });
}

async function startCamera(container) {
  mediaStream = await navigator.mediaDevices.getUserMedia({
    video: {
      facingMode: { ideal: 'environment' },
      width: { ideal: 1280 },
      height: { ideal: 960 },
    },
    audio: false,
  });

  const video = document.createElement('video');
  video.autoplay = true;
  video.playsInline = true;
  video.muted = true;
  video.srcObject = mediaStream;
  container.appendChild(video);
  await video.play().catch(() => {});
  await waitForFrames(video);
  return video;
}

function waitForFrames(video) {
  if (video.videoWidth) return Promise.resolve();
  return new Promise((resolve) => {
    const done = once(() => {
      video.removeEventListener('loadedmetadata', done);
      resolve();
    });
    video.addEventListener('loadedmetadata', done);
    setTimeout(done, 4000);
  });
}

// Best-effort only: shares the camera track already in use, so it never prompts
// again and never blocks the reading flow if Vonage is unavailable.
async function publishToVonage(stream) {
  const res = await fetch('/api/video-session');
  const data = await res.json();
  if (!data.available) throw new Error(data.reason || 'Vonage Video session unavailable');

  const OT = await loadOpenTok();
  const videoTrack = stream.getVideoTracks()[0];
  if (!videoTrack) throw new Error('No camera track to publish');

  await new Promise((resolve, reject) => {
    const publisher = OT.initPublisher(
      null,
      { videoSource: videoTrack, audioSource: null, insertDefaultUI: false },
      (err) => {
        if (err) reject(err);
      }
    );

    const cleanup = () => {
      try {
        publisher.destroy();
      } catch (e) {
        /* already torn down */
      }
    };

    const session = OT.initSession(data.applicationId, data.sessionId);
    session.connect(data.token, (err) => {
      if (err) {
        cleanup();
        return reject(err);
      }
      session.publish(publisher, (pubErr) => {
        if (pubErr) {
          cleanup();
          try {
            session.disconnect();
          } catch (e) {
            /* already disconnected */
          }
          return reject(pubErr);
        }
        vonageSession = session;
        vonagePublisher = publisher;
        resolve();
      });
    });
  });
}

function captureFrame() {
  if (!activeVideoEl || !activeVideoEl.videoWidth) return null;

  const scale = Math.min(1, MAX_FRAME_WIDTH / activeVideoEl.videoWidth);
  if (!canvas) canvas = document.createElement('canvas');
  canvas.width = Math.round(activeVideoEl.videoWidth * scale);
  canvas.height = Math.round(activeVideoEl.videoHeight * scale);
  canvas.getContext('2d').drawImage(activeVideoEl, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', 0.82).split(',')[1];
}

async function takeReading({ interrupt = false } = {}) {
  if (!sessionActive) return;
  if (isBusy) {
    if (!interrupt) return;
    cancelSpeech();
    isBusy = false;
  }

  const frame = captureFrame();
  if (!frame) {
    setStatus('Camera is still warming up…');
    scheduleRead(1200);
    return;
  }

  isBusy = true;
  cancelScheduledRead();
  setDescriptionTitle('Reading your item');
  setStatus('Looking at your item…');

  try {
    const res = await fetch('/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: frame }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Analysis failed');
    if (!sessionActive) return;

    setDescriptionTitle('Here’s what I notice');
    setDescription(data.description);
    setStatus('Describing what I see…');
    speak(data.description, () => {
      isBusy = false;
      if (sessionActive) setStatus('Tap “Describe this item again” or “Try another item” when you’re ready.');
    });
  } catch (err) {
    console.error(err);
    isBusy = false;
    if (!sessionActive) return;
    setDescriptionTitle('I couldn’t read that');
    setDescription('Something went wrong reading the item. Tap “Describe this item again” to retry.');
    setStatus('Reading failed. Tap “Describe this item again” to retry.');
    speak('Sorry, I could not read that item. Tap describe this item again to retry.');
  }
}

function showStartScreen() {
  $('app-screen').hidden = true;
  $('start-screen').hidden = false;
  $('start-btn').disabled = false;
}

async function startApp() {
  if (isStarting || sessionActive) return;
  isStarting = true;
  $('start-btn').disabled = true;

  $('start-screen').hidden = true;
  $('app-screen').hidden = false;
  setDescriptionTitle('Getting ready');
  setDescription('I’m turning on your camera now.');
  setStatus('Turning on your camera…');
  speak('Starting Lumina.');

  const container = $('video-container');
  container.innerHTML = '';

  try {
    activeVideoEl = await startCamera(container);
  } catch (err) {
    console.error('Camera unavailable:', err);
    isStarting = false;
    releaseCamera();
    showStartScreen();
    setDescriptionTitle('Camera needs permission');
    setDescription('Lumina needs camera access. Allow it in your browser, then start again.');
    setStatus('Camera access was blocked.');
    speak('I could not open your camera. Please allow camera access, then start again.');
    return;
  }

  sessionActive = true;
  isStarting = false;

  setDescriptionTitle('Waiting for an item');
  setDescription('Hold a garment in front of the camera.');
  setStatus('Camera on. Hold an item in front of the camera…');
  speak('Camera on. Hold an item in front of the camera.');

  publishToVonage(mediaStream).catch((err) => {
    console.warn('Vonage Video publish skipped:', err.message);
  });

  scheduleRead(FIRST_READ_DELAY_MS);
}

function resetForNextItem() {
  if (!sessionActive) return;
  cancelSpeech();
  cancelScheduledRead();
  isBusy = false;
  latestDescription = '';

  setDescriptionTitle('Waiting for an item');
  setDescription('Hold your next garment in front of the camera.');
  setStatus('Ready for your next item…');
  speak('Ready for your next item. Hold it up now.');
  scheduleRead(NEXT_ITEM_DELAY_MS);
}

function releaseCamera() {
  if (vonagePublisher) {
    try {
      vonagePublisher.destroy();
    } catch (e) {
      /* already destroyed */
    }
    vonagePublisher = null;
  }

  if (vonageSession) {
    try {
      vonageSession.disconnect();
    } catch (e) {
      /* already disconnected */
    }
    vonageSession = null;
  }

  if (mediaStream) {
    mediaStream.getTracks().forEach((track) => track.stop());
    mediaStream = null;
  }

  activeVideoEl = null;
  $('video-container').innerHTML = '';
}

function stopApp() {
  sessionActive = false;
  isBusy = false;
  cancelScheduledRead();
  cancelSpeech();
  releaseCamera();
  showStartScreen();

  setStatus('');
  setDescription('Point your camera at a garment and I’ll describe it aloud.');
  setDescriptionTitle('Waiting for an item');
  latestDescription = '';
}

async function callAssistant() {
  setStatus('Calling a shopping assistant…');
  speak('Calling the shopping assistant now.');
  try {
    const res = await fetch('/api/call-assistant', { method: 'POST' });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'Call failed');

    setStatus('Assistant call placed.');
    speak('The assistant phone is now ringing.');
  } catch (err) {
    console.error(err);
    setStatus('Could not place the call.');
    speak('Sorry, the assistant call could not be placed.');
  }
}

window.addEventListener('DOMContentLoaded', () => {
  $('start-btn').addEventListener('click', startApp);
  $('describe-btn').addEventListener('click', () => takeReading({ interrupt: true }));
  $('reset-btn').addEventListener('click', resetForNextItem);
  $('call-btn').addEventListener('click', callAssistant);
  $('stop-btn').addEventListener('click', stopApp);
  $('sound-btn').addEventListener('click', () => setSoundEnabled(!speechEnabled));

  document.addEventListener('keydown', (event) => {
    if (event.key.toLowerCase() !== 'm' || event.metaKey || event.ctrlKey || event.altKey) return;
    const target = event.target;
    if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return;
    if (!latestDescription) {
      speak('There is no description to repeat yet.');
      return;
    }
    speak(latestDescription);
    setStatus('Repeating the latest description.');
  });

  window.addEventListener('pagehide', releaseCamera);
});
