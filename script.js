const url = "https://script.google.com/macros/s/AKfycbzxW6ws7_0IXkqLIeXO6DVeJGnnKudpSJyZUYk4-Nt2yvR16gtCzpK__0gfCqWfxTke/exec"; 

let myChart;
let fetchInterval;

// Wait for the HTML to be fully loaded before running JavaScript
window.addEventListener('DOMContentLoaded', (event) => {
    addLog("HTML loaded. Initializing system...");
    initChart();
    
    // ENSURE THE START BUTTON IS VISIBLE ON LOAD
    const connBtn = document.getElementById('connect-btn');
    if(connBtn) {
        addLog("Found Start button. Forcing visibility.");
        connBtn.style.setProperty('display', 'inline-block', 'important'); // Overrides any other CSS
    } else {
        addLog("ERROR: Connect button not found!", "error");
    }
});

function initChart() {
    // ... (Your existing chart initialization code)
}

async function startMonitoring() {
    addLog("Start Live Sync clicked. Connecting to cloud...");
    
    const connBtn = document.getElementById('connect-btn');
    const discBtn = document.getElementById('disconnect-btn');
    const motorCube = document.getElementById('motor-cube');
    
    // THE CRITICAL FIX: Explicitly forcing the style changes
    if(connBtn) connBtn.style.setProperty('display', 'none', 'important');
    if(discBtn) discBtn.style.setProperty('display', 'inline-block', 'important');
    
    // START ANIMATION: Cube begins rotating
    if(motorCube) motorCube.classList.add('cube-rotating');
    
    fetchDataFromSheets();
    fetchInterval = setInterval(fetchDataFromSheets, 5000);
}

function stopMonitoring() {
    clearInterval(fetchInterval);
    
    addLog("PAUSE SYNC clicked. Monitoring stopped.");
    
    const connBtn = document.getElementById('connect-btn');
    const discBtn = document.getElementById('disconnect-btn');
    const syncLabel = document.getElementById('sync-status');
    const motorCube = document.getElementById('motor-cube');
    
    // THE CRITICAL FIX: Explicitly forcing the style changes back
    if(connBtn) connBtn.style.setProperty('display', 'inline-block', 'important');
    if(discBtn) discBtn.style.setProperty('display', 'none', 'important');
    
    if(syncLabel) {
        syncLabel.innerText = "Paused";
        syncLabel.style.color = "#8892b0";
    }

    // STOP ANIMATION: Cube rotation stops
    if(motorCube) {
        motorCube.classList.remove('cube-rotating', 'cube-vibrate');
    }
}

async function fetchDataFromSheets() {
    // ... (Your existing fetch and data update code)
    // IMPORTANT: Within fetchDataFromSheets, ensure updateDashboard is called properly.
}

function updateDashboard(t, v) {
    // ... (Your existing data display code for Temp/Vibration)

    const motorCube = document.getElementById('motor-cube');
    
    // VIBRATION ALERT ANIMATION
    const vibVal = parseFloat(v);
    if(vibVal >= 3.0) {
        addLog(`WARNING: High vibration detected (${vibVal}G)!`, "error");
        if(motorCube) motorCube.classList.add('cube-vibrate');
    } else {
        if(motorCube) motorCube.classList.remove('cube-vibrate');
    }
    
    // ... (The rest of your existing AI suggestion logic)
}

// RESTORED Troubleshooting Log Function
function addLog(message, type = '') {
    const logBox = document.getElementById('system-logs');
    const now = new Date();
    const timeStr = `[${now.getHours()}:${now.getMinutes()}:${now.getSeconds()}]`;
    const entry = document.createElement('div');
    entry.className = 'log-entry';
    if(type === 'error') entry.style.color = "#ff3131";
    entry.innerHTML = `<span class="log-time">${timeStr}</span> ${message}`;
    if(logBox) {
        logBox.prepend(entry);
    }
}
