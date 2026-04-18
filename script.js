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

function calculateSlope(data) {
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
    if (denominator === 0) return 0;
    return (n * sumXY - sumX * sumY) / denominator;
}

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
    if(discBtn) discBtn.style.setProperty('inline-block', 'important');
    
    logEvent("START: Checking for recent data today...");
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

            console.log(`Time Gap: ${diffInSeconds}s`);

            // --- STRICT RECENT DATA CHECK ---
            // Kapag lagpas 30 seconds ang tanda ng data (mula kahapon o kanina),
            // ituturing itong OFFLINE/STALE. Hindi ito papasok sa chart.
            if (isNaN(dataTime) || diffInSeconds > 30) { 
                if(syncLabel) {
                    syncLabel.innerText = "Waiting for Recent Data...";
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
    const tempVal = parseFloat(t) || 0;
    const vibVal = parseFloat(v) || 0;

    const tDisp = document.getElementById('temp-val') || document.getElementById('temp-display');
    const vDisp = document.getElementById('vib-val') || document.getElementById('vib-display');
    const statLabel = document.getElementById('status-label');
    const aiAction = document.getElementById('ai-action-step');
    const healthDisp = document.getElementById('motor-health-score');
    const light = document.querySelector('.status-light');

    // UI reset sa 0.0 kung offline
    if(tDisp) tDisp.innerText = (s === "OFFLINE") ? "0.0" : tempVal.toFixed(1);
    if(vDisp) vDisp.innerText = (s === "OFFLINE") ? "0.00" : vibVal.toFixed(2);

    if (isMonitoring && s !== "OFFLINE" && (tempVal !== 0 || vibVal !== 0)) {
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

    // Linear Regression part
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
        actionText = "No recent data detected. Connect hardware to start.";
    } 
    else if (tempVal >= 85 && tempSlope > 0.5) {
        currentStatus = "THERMAL RUNAWAY";
        statusClass = "status-critical";
        healthAssessment = "DANGER";
        actionText = `🚨 <b>REGRESSION ALERT:</b> Temp is rising fast (+${tempSlope.toFixed(2)}°/sample).`;
    } 
    else if (tempVal >= 85 && Math.abs(tempSlope) <= 0.1) {
        currentStatus = "HIGH TEMP STABLE";
        statusClass = "status-warning";
        healthAssessment = "DEGRADED";
        actionText = `⚠️ <b>NOTICE:</b> Motor is hot but stable.`;
    }

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
    
    // Force reset displays to zero
    const tDisp = document.getElementById('temp-val') || document.getElementById('temp-display');
    const vDisp = document.getElementById('vib-val') || document.getElementById('vib-display');
    if(tDisp) tDisp.innerText = "0.0";
    if(vDisp) vDisp.innerText = "0.00";

    updateDashboard(0, 0, "OFFLINE");
    myChart.data.labels = [];
    myChart.data.datasets.forEach(d => d.data = []);
    myChart.update();
    
    const connBtn = document.getElementById('connect-btn');
    const discBtn = document.getElementById('disconnect-btn');
    if(connBtn) connBtn.style.setProperty('display', 'inline-block', 'important');
    if(discBtn) discBtn.style.setProperty('display', 'none', 'important');

    logEvent("PAUSED: Dashboard cleared.");
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
