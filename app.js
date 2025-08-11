/* Main app logic for Zepta Toernooi Jury */

/**
 * Get settings from localStorage or defaults
 */
function getSettings() {
  const defaults = {
    periods: 2,
    playtime: '08:00',
    attack: 28,
    attack2: 18
  };
  try {
    const s = JSON.parse(localStorage.getItem('jury-settings'));
    return Object.assign({}, defaults, s || {});
  } catch {
    return defaults;
  }
}

/**
 * Save settings to localStorage
 */
function saveSettings(settings) {
  localStorage.setItem('jury-settings', JSON.stringify(settings));
}

/**
 * Get state from localStorage or defaults
 */
function getState(settings) {
  const defaults = {
    period: 1,
    time: settings.playtime,
    attack: settings.attack,
    running: false,
  };
  try {
    const s = JSON.parse(localStorage.getItem('jury-state'));
    return Object.assign({}, defaults, s || {});
  } catch {
    return defaults;
  }
}

/**
 * Save state to localStorage
 */
function saveState(state) {
  localStorage.setItem('jury-state', JSON.stringify(state));
}

// DOM elements
const periodSelect = document.getElementById('period-select');
const mainClock = document.getElementById('main-clock');
const startPauseBtn = document.getElementById('start-pause-btn');
const resetBtn = document.getElementById('reset-btn');
const attackTimer = document.getElementById('attack-timer');
const attackBtn = document.getElementById('attack-btn');
const attack2Btn = document.getElementById('attack2-btn');
const shareBtn = document.getElementById('share-btn');
const settingsBtn = document.getElementById('settings-btn');
const shareDialog = document.getElementById('share-dialog');
const closeShare = document.getElementById('close-share');
const settingsDialog = document.getElementById('settings-dialog');
const settingsForm = document.getElementById('settings-form');
const closeSettings = document.getElementById('close-settings');
const settingPeriods = document.getElementById('setting-periods');
const settingPlaytime = document.getElementById('setting-playtime');
const settingAttack = document.getElementById('setting-attack');
const settingAttack2 = document.getElementById('setting-attack2');
const periodEndDialog = document.getElementById('period-end-dialog');
const periodEndMessage = document.getElementById('period-end-message');
const periodEndOk = document.getElementById('period-end-ok');

let settings = getSettings();
let state = getState(settings);
let mainInterval = null;
let attackInterval = null;
let lastSave = Date.now();
let wakeLock = null;

function updatePeriodSelect() {
  periodSelect.innerHTML = '';
  for (let i = 1; i <= settings.periods; i++) {
    const opt = document.createElement('option');
    opt.value = i;
    opt.textContent = i;
    periodSelect.appendChild(opt);
  }
  periodSelect.value = state.period;
}

function updateAttackButtons() {
  attackBtn.textContent = settings.attack + 's';
  attack2Btn.textContent = settings.attack2 + 's';
}

function formatTime(t) {
  const [m, s] = t.split(':').map(Number);
  return m * 60 + s;
}
function secondsToMMSS(sec) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s;
}

function updateUI() {
  mainClock.textContent = state.time;
  attackTimer.textContent = state.attack;
  periodSelect.value = state.period;
  startPauseBtn.textContent = state.running ? 'Pauze' : 'Start';
}

function vibrate(pattern) {
  if (navigator.vibrate) navigator.vibrate(pattern);
}

function requestWakeLock() {
  if ('wakeLock' in navigator) {
    navigator.wakeLock.request('screen').then(lock => {
      wakeLock = lock;
      lock.addEventListener('release', () => { wakeLock = null; });
    }).catch(() => {});
  }
}

function releaseWakeLock() {
  if (wakeLock) wakeLock.release();
}

function startTimers() {
  if (mainInterval) clearInterval(mainInterval);
  if (attackInterval) clearInterval(attackInterval);
  let mainSec = formatTime(state.time);
  let attackSec = Number(state.attack);
  // Allow external update of attackSec
  state._setAttackSec = (val) => { attackSec = val; };
  mainInterval = setInterval(() => {
    if (!state.running) return;
    if (mainSec > 0) {
      mainSec--;
      state.time = secondsToMMSS(mainSec);
      if (settings.periods == state.period && mainSec === 60) {
        vibrate(1000);
      }
      if (mainSec === 0) {
        state.running = false;
        updateUI();
        vibrate([600, 200, 600, 200, 600]);
        if (state.period == settings.periods) {
          showPeriodEndDialog('Wedstrijd afgelopen', true);
        } else {
          showPeriodEndDialog('Einde periode', false);
        }
      }
    }
    updateUI();
    saveStateIfNeeded();
  }, 1000);
  attackInterval = setInterval(() => {
    if (!state.running) return;
    if (attackSec > 0) {
      attackSec--;
      state.attack = attackSec;
      if (attackSec === 0) {
        vibrate([200, 100, 200, 100, 200]);
      }
    }
    updateUI();
    saveStateIfNeeded();
  }, 1000);
}

function stopTimers() {
  if (mainInterval) clearInterval(mainInterval);
  if (attackInterval) clearInterval(attackInterval);
}

function saveStateIfNeeded() {
  if (Date.now() - lastSave > 1000) {
    saveState(state);
    lastSave = Date.now();
  }
}

function showPeriodEndDialog(msg, isGameOver) {
  periodEndMessage.textContent = msg;
  periodEndDialog.showModal();
  periodEndOk.onclick = function() {
    periodEndDialog.close();
    if (isGameOver) {
      state.period = 1;
      state.time = settings.playtime;
      state.attack = settings.attack;
    } else {
      state.period++;
      state.time = settings.playtime;
      state.attack = settings.attack;
    }
    state.running = false;
    updateUI();
    saveState(state);
  };
}

// Event listeners
startPauseBtn.onclick = function() {
  state.running = !state.running;
  updateUI();
  if (state.running) {
    startTimers();
    requestWakeLock();
  } else {
    stopTimers();
    releaseWakeLock();
  }
  saveState(state);
};

resetBtn.onclick = function() {
  const dlg = document.createElement('dialog');
  dlg.innerHTML = `
    <form method="dialog" class="settings-dialog-form">
      <h2>Reset klok</h2>
      <label for="reset-time">Op welk tijdstip wil je resetten?</label>
      <input type="text" id="reset-time" pattern="\\d{2}:\\d{2}" value="${settings.playtime}">
      <div class="settings-actions">
        <button value="ok">OK</button>
        <button value="cancel">Annuleren</button>
      </div>
    </form>
  `;
  document.body.appendChild(dlg);
  dlg.showModal();
  dlg.querySelector('form').onsubmit = function(e) {
    e.preventDefault();
    const val = dlg.querySelector('#reset-time').value;
    if (/^\d{2}:\d{2}$/.test(val)) {
      state.time = val;
      state.attack = settings.attack;
      state.running = false;
      updateUI();
      saveState(state);
      dlg.close();
      document.body.removeChild(dlg);
    }
  };
  dlg.querySelector('button[value="cancel"]').onclick = function() {
    dlg.close();
    document.body.removeChild(dlg);
  };
};

attackBtn.onclick = function() {
  state.attack = settings.attack;
  if (typeof state._setAttackSec === 'function') state._setAttackSec(settings.attack);
  updateUI();
  saveState(state);
};
attack2Btn.onclick = function() {
  if (state.attack < settings.attack2) {
    state.attack = settings.attack2;
    if (typeof state._setAttackSec === 'function') state._setAttackSec(settings.attack2);
    updateUI();
    saveState(state);
  }
};

periodSelect.onchange = function() {
  state.period = Number(periodSelect.value);
  updateUI();
  saveState(state);
};

shareBtn.onclick = function() {
  shareDialog.showModal();
};
closeShare.onclick = function() {
  shareDialog.close();
};

settingsBtn.onclick = function() {
  settingPeriods.value = settings.periods;
  settingPlaytime.value = settings.playtime;
  settingAttack.value = settings.attack;
  settingAttack2.value = settings.attack2;
  settingsDialog.showModal();
};
closeSettings.onclick = function() {
  settingsDialog.close();
};
settingsForm.onsubmit = function(e) {
  e.preventDefault();
  settings = {
    periods: Math.max(1, Math.min(4, Number(settingPeriods.value))),
    playtime: settingPlaytime.value,
    attack: Number(settingAttack.value),
    attack2: Number(settingAttack2.value)
  };
  saveSettings(settings);
  updatePeriodSelect();
  updateAttackButtons();
  state.period = 1;
  state.time = settings.playtime;
  state.attack = settings.attack;
  state.running = false;
  updateUI();
  saveState(state);
  settingsDialog.close();
};

window.addEventListener('beforeunload', () => {
  saveState(state);
});

// Initial setup
updatePeriodSelect();
updateAttackButtons();
updateUI();
if (state.running) {
  startTimers();
  requestWakeLock();
}

// Show iOS warning if on iOS
document.addEventListener('DOMContentLoaded', () => {
  const ua = window.navigator.userAgent;
  if (/iPad|iPhone|iPod/.test(ua) && !window.MSStream) {
    const warn = document.getElementById('ios-warning');
    if (warn) warn.style.display = 'block';
  }
});
