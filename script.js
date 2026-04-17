const url = "https://script.google.com/macros/s/AKfycbzxW6ws7_0IXkqLIeXO6DVeJGnnKudpSJyZUYk4-Nt2yvR16gtCzpK__0gfCqWfxTke/exec"; 

let myChart;
let fetchInterval;

window.onload = function() {
    initChart(); 
};

function initChart() {
    const ctx = document.getElementById('myChart').getContext('2d');
    myChart = new Chart(ctx, {
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
                    pointRadius: 2, 
                    tension: 0.3, 
                    yAxisID: 'y' 
                },
                { 
                    label: 'Vibration (G)', 
                    data: [], 
                    borderColor: '#22c55e', 
                    borderWidth: 1, 
                    pointRadius: 0, 
                    tension: 0.3, 
                    yAxisID: 'y1' 
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: { 
                    type: 'linear', 
                    display: true, 
                    position: 'left', 
                    title: { display: true, text: 'Temperature' },
                    ticks: { color: '#ef4444' } 
                },
                y1: { 
                    type: 'linear', 
                    display: false, 
                    position: 'right', 
                    grid: { drawOnChartArea: false } 
                }
            }
        }
    });
}

async function startMonitoring() {
    const connBtn = document.getElementById('connect-btn');
    const discBtn = document.getElementById('disconnect-btn');
    
    if(connBtn) connBtn.style.display = "none";
    if(discBtn) discBtn.style.display = "inline-block";
    
    logEvent("SYSTEM START: Fetching real-time data...");
    
    fetchDataFromSheets();
    fetchInterval = setInterval(fetchDataFromSheets, 5000);
}

async function fetchDataFromSheets() {
    try {
        const syncLabel = document.getElementById('sync-status');
        if(syncLabel) {
            syncLabel.innerText = "Syncing...";
            syncLabel.style.color = "#8892b0";
        }

        const response = await fetch(`${url}?read=true&t=${new Date().getTime()}`);
        if (!response.ok) throw new Error('Network response was not ok');
        
        const data = await response.json();

        if (data.temp !== undefined && data.timestamp) {
            const dataTime = new Date(data.timestamp).getTime(); 
            const currentTime = new Date().getTime();
            const diffInSeconds = (currentTime - dataTime) / 1000;

            if (diffInSeconds > 60) {
                if(syncLabel) {
                    syncLabel.innerText = "Waiting for Data...";
                    syncLabel.style.color = "#fbbf24";
                }
                updateStatusLight('temp-light', '#334155'); 
            } else {
                updateDashboard(data.temp, data.vibration || 0, data.status || "Normal");
                if(syncLabel) {
                    syncLabel.innerText = "Live";
                    syncLabel.style.color = "#00ff88"; 
                }
            }
        }
    } catch (e) {
        console.error("Fetch Error:", e);
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

    const tDisp = document.getElementById('temp-display');
    const vDisp = document.getElementById('vib-display');
    if(tDisp) tDisp.innerText = tempVal.toFixed(1) + "°C";
    if(vDisp) vDisp.innerText = vibVal.toFixed(2) + "G";

    const aiSug = document.getElementById('ai-suggestion');
    const aiAction = document.getElementById('ai-action-step');
    const health = document.getElementById('motor-health-score');

    let currentStatus = "SYSTEM NORMAL";
    let statusColor = "#00ff88";
    let healthScore = 100;
    let actionText = "Endurance test stable. Monitoring sensors...";

    // --- REVISED TEMPERATURE LOGIC (75°C & 85°C) ---
    if (tempVal >= 85) {
        currentStatus = "CRITICAL: OVERHEATING";
        statusColor = "#ef4444";
        actionText = "🔴 <b>STOP:</b> Immediately turn off and check inside parts!";
        healthScore = 10;
        updateStatusLight('temp-light', '#ef4444');
    } else if (tempVal >= 75) {
        currentStatus = "WARNING: EXCESSIVE HEAT";
        statusColor = "#fbbf24";
        actionText = "⚠️ Check proper ventilation. Monitor load closely.";
        healthScore = 50;
        updateStatusLight('temp-light', '#fbbf24');
    } else {
        updateStatusLight('temp-light', '#00ff88');
    }

    // --- REVISED VIBRATION LOGIC (3G Threshold) ---
    if (vibVal >= 3.0) {
        currentStatus = (tempVal >= 75) ? "MULTIPLE FAILURES DETECTED" : "ABNORMAL VIBRATION";
        statusColor = "#ef4444";
        // Dinadagdagan ang action text kung may vibration issue
        actionText += "<br>⚙️ <b>VIBRATION ALERT:</b> Check for shaft/bearing blockages.";
        healthScore = Math.min(healthScore, 40); 
    }

    // Update UI Elements
    aiSug.innerText = currentStatus;
    aiSug.style.color = statusColor;
    aiAction.innerHTML = actionText;
    if(health) health.innerText = healthScore + "%";

    // Chart Update
    const now = new Date().toLocaleTimeString([], { hour12: false });
    myChart.data.labels.push(now);
    myChart.data.datasets[0].data.push(tempVal);
    myChart.data.datasets[1].data.push(vibVal);
    
    if (myChart.data.labels.length > 20) {
        myChart.data.labels.shift();
        myChart.data.datasets.forEach(d => d.data.shift());
    }
    myChart.update('none');
}

function updateStatusLight(id, color) {
    const light = document.getElementById(id);
    if(light) {
        light.style.backgroundColor = color;
        light.style.boxShadow = `0 0 15px ${color}`;
    }
}

function stopMonitoring() {
    clearInterval(fetchInterval);
    const connBtn = document.getElementById('connect-btn');
    const discBtn = document.getElementById('disconnect-btn');
    const syncLabel = document.getElementById('sync-status');
    
    if(connBtn) connBtn.style.display = "inline-block";
    if(discBtn) discBtn.style.display = "none";
    if(syncLabel) {
        syncLabel.innerText = "Paused";
        syncLabel.style.color = "#8892b0";
    }
    
    logEvent("STOPPED: Live sync paused.");
}

function logEvent(msg) {
    const list = document.getElementById('event-list');
    if(list) {
        const entry = document.createElement('li');
        entry.style.borderLeft = "3px solid #3b82f6";
        entry.style.marginBottom = "5px";
        entry.style.paddingLeft = "8px";
        entry.innerText = `[${new Date().toLocaleTimeString()}] ${msg}`;
        list.prepend(entry);
    }
}
