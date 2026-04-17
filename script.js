const url = "https://script.google.com/macros/s/AKfycbzxW6ws7_0IXkqLIeXO6DVeJGnnKudpSJyZUYk4-Nt2yvR16gtCzpK__0gfCqWfxTke/exec"; 

let myChart;
let fetchInterval;

// Siguraduhing load muna ang HTML bago mag-init
window.addEventListener('DOMContentLoaded', (event) => {
    logEvent("SYSTEM READY: Initializing dashboard...");
    initChart();
});

function initChart() {
    const ctx = document.getElementById('myChart');
    if (!ctx) return; // Iwas error kung wala pang canvas

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
    const motorCube = document.getElementById('motor-cube');
    
    if(connBtn) connBtn.style.setProperty('display', 'none', 'important');
    if(discBtn) discBtn.style.setProperty('display', 'inline-block', 'important');
    if(motorCube) motorCube.classList.add('cube-rotating'); // Kung may rotation animation
    
    logEvent("START: Fetching real-time data...");
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

        // Cache busting para hindi luma ang data
        const response = await fetch(`${url}?read=true&t=${new Date().getTime()}`);
        const data = await response.json();

        if (data.temp !== undefined) {
            // Update Dashboard with data from Sheets
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

    // I-match ang IDs sa HTML mo (ginamit ko ang common names dito)
    const tDisp = document.getElementById('temp-val') || document.getElementById('temp-display');
    const vDisp = document.getElementById('vib-val') || document.getElementById('vib-display');
    const statLabel = document.getElementById('status-label');
    const light = document.querySelector('.status-light');
    const motorCube = document.getElementById('motor-cube');

    if(tDisp) tDisp.innerText = tempVal.toFixed(1);
    if(vDisp) vDisp.innerText = vibVal.toFixed(2);

    let currentStatus = "SYSTEM NORMAL";
    let statusClass = "status-normal";
    let healthScore = 100;

    // --- LOGIC PARA SA STABLE 0.96 ---
    if (tempVal >= 85 || s === "CRITICAL" || s === "SHUTDOWN") {
        currentStatus = "CRITICAL: SHUTDOWN";
        statusClass = "status-critical";
        healthScore = 10;
        if(motorCube) motorCube.classList.add('cube-vibrate');
    } else if (tempVal >= 75 || vibVal >= 3.0) {
        currentStatus = "WARNING: HIGH LOAD";
        statusClass = "status-warning";
        healthScore = 50;
    } else if (vibVal < 1.1) {
        currentStatus = "SYSTEM IDLE";
        statusClass = "status-idle";
        healthScore = 100;
        if(motorCube) motorCube.classList.remove('cube-vibrate');
    }

    // UI Updates
    if(statLabel) statLabel.innerText = currentStatus;
    if(light) {
        light.className = "status-light " + statusClass;
    }

    const healthDisp = document.getElementById('motor-health-score');
    if(healthDisp) healthDisp.innerText = healthScore + "%";

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
    const motorCube = document.getElementById('motor-cube');
    
    if(connBtn) connBtn.style.setProperty('display', 'inline-block', 'important');
    if(discBtn) discBtn.style.setProperty('display', 'none', 'important');
    if(motorCube) motorCube.classList.remove('cube-rotating', 'cube-vibrate');

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
