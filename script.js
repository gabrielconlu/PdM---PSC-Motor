const url = "https://script.google.com/macros/s/AKfycbzxW6ws7_0IXkqLIeXO6DVeJGnnKudpSJyZUYk4-Nt2yvR16gtCzpK__0gfCqWfxTke/exec"; 

let myChart;
let fetchInterval;

window.addEventListener('DOMContentLoaded', (event) => {
    logEvent("SYSTEM READY: Initializing dashboard...");
    initChart();
});

function initChart() {
    const ctx = document.getElementById('myChart');
    if (!ctx) return;

    myChart = new Chart(ctx.getContext('2d'), {
        type: 'line',
        data: {
            labels: [],
            datasets: [
                { 
                    label: 'Temp (°C)', 
                    data: [], 
                    borderColor: '#ef4444', 
                    backgroundColor: 'rgba(239, 68, 68, 0.1)',
                    borderWidth: 2, 
                    tension: 0.3, 
                    yAxisID: 'y' 
                },
                { 
                    label: 'Vibration (G)', 
                    data: [], 
                    borderColor: '#22c55e', 
                    borderWidth: 2, 
                    tension: 0.3, 
                    yAxisID: 'y1' 
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: { type: 'linear', position: 'left', title: { display: true, text: 'Temp (°C)' } },
                y1: { type: 'linear', position: 'right', display: false }
            }
        }
    });
}

async function startMonitoring() {
    const connBtn = document.getElementById('connect-btn');
    const discBtn = document.getElementById('disconnect-btn');
    
    if(connBtn) connBtn.style.setProperty('display', 'none', 'important');
    if(discBtn) discBtn.style.setProperty('display', 'inline-block', 'important');
    
    logEvent("START: Checking for real-time sensor data...");
    fetchDataFromSheets();
    fetchInterval = setInterval(fetchDataFromSheets, 5000);
}

async function fetchDataFromSheets() {
    try {
        const syncLabel = document.getElementById('sync-status');
        if(syncLabel) {
            syncLabel.innerText = "Syncing...";
            syncLabel.style.color = "#3b82f6";
        }

        const response = await fetch(`${url}?read=true&t=${new Date().getTime()}`);
        const data = await response.json();

        // Check if data is fresh (within 60 seconds)
        if (data.timestamp) {
            const dataTime = new Date(data.timestamp).getTime(); 
            const currentTime = new Date().getTime();
            const diffInSeconds = (currentTime - dataTime) / 1000;

            if (diffInSeconds > 60) {
                if(syncLabel) {
                    syncLabel.innerText = "No Recent Data";
                    syncLabel.style.color = "#fbbf24"; 
                }
                // RESET TO ZERO if no recent data is sent from ESP32
                updateDashboard(0, 0, "OFFLINE");
                return; 
            }

            // Fresh data found
            updateDashboard(data.temp, data.vibration || 0, data.status || "Normal");
            
            if(syncLabel) {
                syncLabel.innerText = "Live";
                syncLabel.style.color = "#22c55e"; 
            }
        }
    } catch (e) {
        logEvent("ERROR: Connection failed", "error");
        const syncLabel = document.getElementById('sync-status');
        if(syncLabel) {
            syncLabel.innerText = "Offline";
            syncLabel.style.color = "#ef4444";
        }
    }
}

function updateDashboard(t, v, s) {
    const tempVal = parseFloat(t);
    const vibVal = parseFloat(v);

    const tDisp = document.getElementById('temp-val') || document.getElementById('temp-display');
    const vDisp = document.getElementById('vib-val') || document.getElementById('vib-display');
    const statLabel = document.getElementById('status-label');
    const aiAction = document.getElementById('ai-action-step');
    const light = document.querySelector('.status-light');
    const motorCube = document.getElementById('motor-cube');
    const healthDisp = document.getElementById('motor-health-score');

    if(tDisp) tDisp.innerText = tempVal.toFixed(1);
    if(vDisp) vDisp.innerText = vibVal.toFixed(2);

    let currentStatus = "SYSTEM NORMAL";
    let statusClass = "status-normal";
    let actionText = "Motor operating within predicted baseline.";
    let healthScore = 100;

    // --- LOGIC RESET / OFFLINE CASE ---
    if (s === "OFFLINE" || (tempVal === 0 && vibVal === 0)) {
        currentStatus = "NO DATA / DISCONNECTED";
        statusClass = "status-idle";
        actionText = "Waiting for fresh sensor data from ESP32...";
        healthScore = 0;
    } 
    // --- NORMAL INTERPRETATION FRAMEWORK ---
    else if (tempVal >= 95) {
        currentStatus = "CRITICAL: OVERHEATING";
        statusClass = "status-critical";
        actionText = "🔥 <b>STOP:</b> Check for burning smell and shutdown immediately!";
        healthScore = 10;
        if(motorCube) motorCube.classList.add('cube-vibrate');
    } 
    else if (tempVal >= 85) {
        currentStatus = "WARNING: HIGH TEMP";
        statusClass = "status-warning";
        actionText = "⚠️ <b>HUMAN VALIDATION:</b> Check for burning smell. Monitor load.";
        healthScore = 50;
    }

    // Vibration Checks
    if (s !== "OFFLINE") {
        if (vibVal >= 4.0) {
            currentStatus = (tempVal >= 85) ? "MULTIPLE FAULTS DETECTED" : "CRITICAL: VIBRATION";
            statusClass = "status-critical";
            actionText += "<br>🚨 Severe mechanical shaking. Inspect shaft/bearings.";
            healthScore = Math.min(healthScore, 20);
            if(motorCube) motorCube.classList.add('cube-vibrate');
        } else if (vibVal >= 2.0) {
            if (statusClass !== "status-critical") {
                currentStatus = "WARNING: ABNORMAL VIBRATION";
                statusClass = "status-warning";
                actionText = "⚙️ Abnormal vibration detected. Check alignment.";
                healthScore = Math.min(healthScore, 60);
            }
        } else if (vibVal < 1.3 && tempVal < 85) {
            currentStatus = "SYSTEM IDLE / NORMAL";
            statusClass = "status-idle";
            actionText = "Baseline monitoring. 0.96G gravity detected.";
            if(motorCube) motorCube.classList.remove('cube-vibrate');
        }
    }

    // --- UI UPDATES ---
    if(statLabel) {
        statLabel.innerText = currentStatus;
        statLabel.className = "status-text " + statusClass;
    }
    if(aiAction) aiAction.innerHTML = actionText;
    if(healthDisp) healthDisp.innerText = healthScore > 0 ? healthScore + "%" : "--%";
    if(light) light.className = "status-light " + statusClass;

    // Chart Update
    const now = new Date().toLocaleTimeString([], { hour12: false, minute: '2-digit', second: '2-digit' });
    myChart.data.labels.push(now);
    myChart.data.datasets[0].data.push(tempVal);
    myChart.data.datasets[1].data.push(vibVal);
    
    if (myChart.data.labels.length > 15) {
        myChart.data.labels.shift();
        myChart.data.datasets.forEach(d => d.data.shift());
    }
    myChart.update('none');
}

function stopMonitoring() {
    clearInterval(fetchInterval);
    const connBtn = document.getElementById('connect-btn');
    const discBtn = document.getElementById('disconnect-btn');
    if(connBtn) connBtn.style.setProperty('display', 'inline-block', 'important');
    if(discBtn) discBtn.style.setProperty('display', 'none', 'important');
    logEvent("PAUSED: Sync stopped.");
}

function logEvent(msg, type = "") {
    const list = document.getElementById('event-list') || document.getElementById('system-logs');
    if(list) {
        const entry = document.createElement('div');
        entry.className = "log-entry";
        if(type === "error") entry.style.color = "#ef4444";
        const time = new Date().toLocaleTimeString();
        entry.innerHTML = `<span class="log-time">[${time}]</span> ${msg}`;
        list.prepend(entry);
    }
}
