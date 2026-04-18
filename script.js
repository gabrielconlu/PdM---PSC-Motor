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

// --- LINEAR REGRESSION HELPER ---
// Calculates the slope (m) of a dataset
function calculateSlope(data) {
    const n = data.length;
    if (n < 2) return 0;

    let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
    for (let i = 0; i < n; i++) {
        sumX += i;
        sumY += data[i];
        sumXY += i * data[i];
        sumX2 += i * i;
    }
    // Slope formula: m = (n*sumXY - sumX*sumY) / (n*sumX2 - sumX^2)
    return (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
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
        const response = await fetch(`${url}?read=true&t=${new Date().getTime()}`);
        const data = await response.json();
        if (data.timestamp) {
            updateDashboard(data.temp, data.vibration || 0, data.status || "Normal");
        }
    } catch (e) {
        logEvent("ERROR: Sync failed", "error");
    }
}

function updateDashboard(t, v, s) {
    const tempVal = parseFloat(t);
    const vibVal = parseFloat(v);

    const tDisp = document.getElementById('temp-val');
    const vDisp = document.getElementById('vib-val');
    const statLabel = document.getElementById('status-label');
    const aiAction = document.getElementById('ai-action-step');
    const healthDisp = document.getElementById('motor-health-score');

    if(tDisp) tDisp.innerText = tempVal.toFixed(1);
    if(vDisp) vDisp.innerText = vibVal.toFixed(2);

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

    // --- REGRESSION ANALYSIS ---
    const last10Temp = myChart.data.datasets[0].data.slice(-10);
    const last10Vib = myChart.data.datasets[1].data.slice(-10);
    
    const tempSlope = calculateSlope(last10Temp);
    const vibSlope = calculateSlope(last10Vib);

    let currentStatus = "SYSTEM NORMAL";
    let statusClass = "status-normal";
    let healthAssessment = "OPTIMAL"; 
    let actionText = "Motor baseline is steady.";

    // Logic using Slope (m)
    // Positive slope means temperature is RISING
    if (tempVal >= 85 && tempSlope > 0.5) {
        currentStatus = "THERMAL RUNAWAY";
        statusClass = "status-critical";
        healthAssessment = "DANGER";
        actionText = `🚨 <b>REGRESSION ALERT:</b> Temp is rising fast (+${tempSlope.toFixed(2)}°/sample). <b>Shutdown advised</b> before reaching 95°C.`;
    } 
    else if (tempVal >= 85 && Math.abs(tempSlope) <= 0.1) {
        currentStatus = "HIGH TEMP STABLE";
        statusClass = "status-warning";
        healthAssessment = "DEGRADED";
        actionText = `⚠️ <b>NOTICE:</b> Motor is hot but temperature has stabilized (Slope: ${tempSlope.toFixed(2)}). Monitor for humming.`;
    }
    else if (vibSlope > 0.2) {
        currentStatus = "VIB INCREASE";
        statusClass = "status-warning";
        healthAssessment = "DEGRADED";
        actionText = `⚠️ <b>TREND ALERT:</b> Vibration is trending upward. Check mechanical alignment or bearings.`;
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
}

function stopMonitoring() {
    isMonitoring = false;
    clearInterval(fetchInterval);
    updateDashboard(0, 0, "OFFLINE");
    myChart.data.labels = [];
    myChart.data.datasets.forEach(d => d.data = []);
    myChart.update();
    logEvent("PAUSED: Regression data cleared.");
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
