const url = "https://script.google.com/macros/s/AKfycbzxW6ws7_0IXkqLIeXO6DVeJGnnKudpSJyZUYk4-Nt2yvR16gtCzpK__0gfCqWfxTke/exec"; 

let myChart;
let fetchInterval;
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

// --- LINEAR REGRESSION HELPER (With Safety Guard) ---
function calculateSlope(data) {
    // Safety check: Kailangan ng at least 3 points para hindi mag-error ang calculation
    if (!data || data.length < 3) return 0; 

    const n = data.length;
    let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
    for (let i = 0; i < n; i++) {
        sumX += i;
        sumY += data[i];
        sumXY += i * data[i];
        sumX2 += i * i;
    }
    const denominator = (n * sumX2 - sumX * sumX);
    if (denominator === 0) return 0; // Iwas division by zero error

    return (n * sumXY - sumX * sumY) / denominator;
}

// --- DATE PARSING HELPER ---
function parseSheetDate(dateStr) {
    let d = new Date(dateStr);
    if (isNaN(d.getTime())) {
        let parts = dateStr.split(/[\s,/-]+/);
        if (parts.length >= 3) {
            d = new Date(parts[2], parts[0] - 1, parts[1], parts[3] || 0, parts[4] || 0, parts[5] || 0);
        }
    }
    return d;
}

async function startMonitoring() {
    isMonitoring = true;
    const connBtn = document.getElementById('connect-btn');
    const discBtn = document.getElementById('disconnect-btn');
    
    if(connBtn) connBtn.style.setProperty('display', 'none', 'important');
    if(discBtn) discBtn.style.setProperty('display', 'inline-block', 'important');
    
    logEvent("START: Applying Linear Regression monitoring...");
    fetchDataFromSheets();
    fetchInterval = setInterval(fetchDataFromSheets, 5000);
}

async function fetchDataFromSheets() {
    if (!isMonitoring) return;
    try {
        const syncLabel = document.getElementById('sync-status');
        if(syncLabel) syncLabel.innerText = "Syncing...";

        const response = await fetch(`${url}?read=true&t=${new Date().getTime()}`);
        const data = await response.json();

        if (data.timestamp) {
            const dataTime = parseSheetDate(data.timestamp).getTime(); 
            const currentTime = new Date().getTime();
            const diffInSeconds = (currentTime - dataTime) / 1000;

            console.log(`Gap: ${diffInSeconds}s | Sheet Time: ${data.timestamp}`);

            // Extended tolerance to 5 minutes para iwas "Offline" bug
            if (isNaN(dataTime) || diffInSeconds > 300) {
                if(syncLabel) {
                    syncLabel.innerText = "Data Stale/Offline";
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
        console.error("Fetch error:", e);
        logEvent("ERROR: Sync failed", "error");
    }
}

function updateDashboard(t, v, s) {
    const tempVal = parseFloat(t);
    const vibVal = parseFloat(v);

    const tDisp = document.getElementById('temp-val') || document.getElementById('temp-display');
    const vDisp = document.getElementById('vib-val') || document.getElementById('vib-display');
    const statLabel = document.getElementById('status-label');
    const aiAction = document.getElementById('ai-action-step');
    const healthDisp = document.getElementById('motor-health-score');
    const light = document.querySelector('.status-light');

    if(tDisp) tDisp.innerText = tempVal.toFixed(1);
    if(vDisp) vDisp.innerText = vibVal.toFixed(2);

    if (isMonitoring && s !== "OFFLINE" && (tempVal !== 0 || vibVal !== 0)) {
        const now = new Date().toLocaleTimeString([], { hour12: false, minute: '2-digit', second: '2-digit' });
        myChart.data.labels.push(now);
        myChart.data.datasets[0].data.push(tempVal);
        myChart.data.datasets[1].data.push(vibVal);
        
        // Sliding window for regression (limit to 15 points)
        if (myChart.data.labels.length > 15) {
            myChart.data.labels.shift();
            myChart.data.datasets.forEach(d => d.data.shift());
        }
        myChart.update('none');
    }

    // --- LINEAR REGRESSION ANALYSIS ---
    const tempArray = myChart.data.datasets[0].data;
    const vibArray = myChart.data.datasets[1].data;
    
    const tempSlope = calculateSlope(tempArray.slice(-10));
    const vibSlope = calculateSlope(vibArray.slice(-10));

    let currentStatus = "SYSTEM NORMAL";
    let statusClass = "status-normal";
    let healthAssessment = "OPTIMAL"; 
    let actionText = "Motor operating within predicted baseline.";

    if (s === "OFFLINE" || !isMonitoring) {
        currentStatus = "DISCONNECTED";
        statusClass = "status-idle";
        healthAssessment = "OFFLINE";
        actionText = "Dashboard paused. Connect to resume data feed.";
    } 
    // 1. Regression Alert (Rising Fast)
    else if (tempVal >= 85 && tempSlope > 0.5) {
        currentStatus = "THERMAL RUNAWAY";
        statusClass = "status-critical";
        healthAssessment = "DANGER";
        actionText = `🚨 <b>REGRESSION ALERT:</b> Temp is rising fast, monitor for possible burning (+${tempSlope.toFixed(2)}°/sample).`;
    } 
    // 2. High Temp but Stable (Slope is near zero)
    else if (tempVal >= 85 && Math.abs(tempSlope) <= 0.1) {
        currentStatus = "HIGH TEMP STABLE";
        statusClass = "status-warning";
        healthAssessment = "DEGRADED";
        actionText = `⚠️ <b>NOTICE:</b> Motor is hot but temperature has stabilized (Slope: ${tempSlope.toFixed(2)}).`;
    }
    // 3. Vibration Trend
    else if (vibSlope > 0.2) {
        currentStatus = "VIB INCREASE";
        statusClass = "status-warning";
        healthAssessment = "DEGRADED";
        actionText = `⚠️ <b>TREND ALERT:</b> Vibration is trending upward. Check mechanical alignment.`;
    }

    // --- UI UPDATES ---
    if(statLabel) {
        statLabel.innerText = currentStatus;
        statLabel.className = "status-text " + statusClass;
    }
    if(aiAction) aiAction.innerHTML = actionText;
    if(healthDisp) {
        healthDisp.innerText = healthAssessment;
        healthDisp.style.color = (healthAssessment === "OPTIMAL") ? "#22c55e" : (healthAssessment === "DANGER") ? "#ef4444" : "#fbbf24";
    }
    if(light) light.className = "status-light " + statusClass;
}

function stopMonitoring() {
    isMonitoring = false;
    clearInterval(fetchInterval);
    updateDashboard(0, 0, "OFFLINE");
    myChart.data.labels = [];
    myChart.data.datasets.forEach(d => d.data = []);
    myChart.update();
    
    const connBtn = document.getElementById('connect-btn');
    const discBtn = document.getElementById('disconnect-btn');
    if(connBtn) connBtn.style.setProperty('display', 'inline-block', 'important');
    if(discBtn) discBtn.style.setProperty('display', 'none', 'important');

    logEvent("PAUSED: Monitoring stopped.");
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
