const url = "https://script.google.com/macros/s/AKfycbzxW6ws7_0IXkqLIeXO6DVeJGnnKudpSJyZUYk4-Nt2yvR16gtCzpK__0gfCqWfxTke/exec"; 

let myChart;
let fetchInterval;

// Idagdag ang flag na ito para malaman kung active ang monitoring
let isMonitoring = false;

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
                y: { type: 'linear', position: 'left', title: { display: true, text: 'Temp (°C)' }, min: 0 },
                y1: { type: 'linear', position: 'right', display: false, min: 0 }
            }
        }
    });
}

async function startMonitoring() {
    isMonitoring = true; // Set to true
    const connBtn = document.getElementById('connect-btn');
    const discBtn = document.getElementById('disconnect-btn');
    
    if(connBtn) connBtn.style.setProperty('display', 'none', 'important');
    if(discBtn) discBtn.style.setProperty('display', 'inline-block', 'important');
    
    logEvent("START: Checking for real-time sensor data...");
    fetchDataFromSheets();
    fetchInterval = setInterval(fetchDataFromSheets, 5000);
}

async function fetchDataFromSheets() {
    if (!isMonitoring) return; // Wag kukuha ng data kung disconnected

    try {
        const syncLabel = document.getElementById('sync-status');
        if(syncLabel) {
            syncLabel.innerText = "Syncing...";
            syncLabel.style.color = "#3b82f6";
        }

        const response = await fetch(`${url}?read=true&t=${new Date().getTime()}`);
        const data = await response.json();

        if (data.timestamp) {
            const dataTime = new Date(data.timestamp).getTime(); 
            const currentTime = new Date().getTime();
            const diffInSeconds = (currentTime - dataTime) / 1000;

            // Kung lumang data (more than 60 seconds ago), i-zero out
            if (diffInSeconds > 60) {
                if(syncLabel) {
                    syncLabel.innerText = "No Recent Data";
                    syncLabel.style.color = "#fbbf24"; 
                }
                updateDashboard(0, 0, "OFFLINE");
                return; 
            }

            updateDashboard(data.temp, data.vibration || 0, data.status || "Normal");
            
            if(syncLabel) {
                syncLabel.innerText = "Live";
                syncLabel.style.color = "#22c55e"; 
            }
        }
    } catch (e) {
        logEvent("ERROR: Connection failed", "error");
        updateDashboard(0, 0, "OFFLINE");
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
    const healthDisp = document.getElementById('motor-health-score');

    if(tDisp) tDisp.innerText = tempVal.toFixed(1);
    if(vDisp) vDisp.innerText = vibVal.toFixed(2);

    let currentStatus = "SYSTEM NORMAL";
    let statusClass = "status-normal";
    let healthAssessment = "OPTIMAL"; 
    let actionText = "Motor operating within predicted baseline.";

    if (s === "OFFLINE" || !isMonitoring || (tempVal === 0 && vibVal === 0)) {
        currentStatus = "DISCONNECTED";
        statusClass = "status-idle";
        healthAssessment = "OFFLINE";
        actionText = "Dashboard paused. Connect to resume data feed.";
    } 
    else if (tempVal >= 95 || vibVal >= 4.0) {
        currentStatus = "CRITICAL FAULT";
        statusClass = "status-critical";
        healthAssessment = "DANGER";
        actionText = "🚨 <b>SHUTDOWN REQUIRED:</b> High risk of failure. Check for humming.";
    } 
    else if (tempVal >= 85 || vibVal >= 2.0) {
        currentStatus = "STRESS DETECTED";
        statusClass = "status-warning";
        healthAssessment = "DEGRADED";
        actionText = "⚠️ <b>MONITOR:</b> Increased load detected. Check for humming.";
    }

    if(statLabel) {
        statLabel.innerText = currentStatus;
        statLabel.className = "status-text " + statusClass;
    }
    if(aiAction) aiAction.innerHTML = actionText;
    if(healthDisp) {
        healthDisp.innerText = healthAssessment;
        healthDisp.style.color = (healthAssessment === "OPTIMAL") ? "#22c55e" : "#ef4444";
    }
    if(light) light.className = "status-light " + statusClass;

    // Chart Update - Isama lang sa chart kung active
    if (isMonitoring) {
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
}

function stopMonitoring() {
    isMonitoring = false; // Stop the flag
    clearInterval(fetchInterval);
    
    // I-reset ang mga display sa 0
    updateDashboard(0, 0, "OFFLINE");
    
    // I-clear ang chart data para malinis pag-connect ulit
    myChart.data.labels = [];
    myChart.data.datasets.forEach(d => d.data = []);
    myChart.update();

    const connBtn = document.getElementById('connect-btn');
    const discBtn = document.getElementById('disconnect-btn');
    if(connBtn) connBtn.style.setProperty('display', 'inline-block', 'important');
    if(discBtn) discBtn.style.setProperty('display', 'none', 'important');
    
    const syncLabel = document.getElementById('sync-status');
    if(syncLabel) {
        syncLabel.innerText = "Disconnected";
        syncLabel.style.color = "#94a3b8";
    }
    
    logEvent("PAUSED: Dashboard reset to 0.");
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
