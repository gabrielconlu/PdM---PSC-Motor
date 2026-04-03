// Siguraduhin na ito ang pinakabagong Deployment ID mula sa iyong "New Deployment"
const url = "https://script.google.com/macros/s/AKfycbwpDizpqZzclgyQzu02s_yLXQM6fJDTHQG6w_g-AN8BNhIDbOQ8uE6mGk8POqWf19ul/exec"; 

let myChart;
let fetchInterval;

window.onload = function() {
    initChart(); 
};

// --- CHART INITIALIZATION ---
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
                    pointRadius: 0, // Nakatago dahil temp monitoring tayo
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
                    display: false, // Itago ang vibration scale para malinis ang dashboard
                    position: 'right', 
                    grid: { drawOnChartArea: false } 
                }
            }
        }
    });
}

// --- CLOUD SYNC LOGIC ---
async function startMonitoring() {
    const connBtn = document.getElementById('connect-btn');
    const discBtn = document.getElementById('disconnect-btn');
    
    if(connBtn) connBtn.style.display = "none";
    if(discBtn) discBtn.style.display = "inline-block";
    
    logEvent("SYSTEM START: Fetching live data from Google Sheets...");
    
    // Initial fetch
    fetchDataFromSheets();
    
    // Polling every 5 seconds (Match sa Arduino delay)
    fetchInterval = setInterval(fetchDataFromSheets, 5000);
}

async function fetchDataFromSheets() {
    try {
        const syncLabel = document.getElementById('sync-status');
        if(syncLabel) {
            syncLabel.innerText = "Syncing...";
            syncLabel.style.color = "#8892b0";
        }

        // Fetching data with cache-buster
        const response = await fetch(`${url}?read=true&t=${new Date().getTime()}`);
        
        if (!response.ok) throw new Error('Network response was not ok');
        
        const data = await response.json();

        if (data.temp !== undefined) {
            updateDashboard(data.temp, data.vibration || 0, data.status || "Normal");
            if(syncLabel) {
                syncLabel.innerText = "Live";
                syncLabel.style.color = "#00ff88";
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

    // Update displays
    const tDisp = document.getElementById('temp-display');
    const vDisp = document.getElementById('vib-display');
    if(tDisp) tDisp.innerText = tempVal.toFixed(1) + "°C";
    if(vDisp) vDisp.innerText = vibVal.toFixed(2) + "G";

    // AI & Threshold Logic
    const aiSug = document.getElementById('ai-suggestion');
    const aiAction = document.getElementById('ai-action-step');
    const health = document.getElementById('motor-health-score');

    if (tempVal >= 70) {
        aiSug.innerText = "CRITICAL: OVERHEATING";
        aiSug.style.color = "#ef4444";
        aiAction.innerHTML = "⚠️ <b>IMMEDIATE ACTION:</b> Shutdown PSC Motor and check for mechanical resistance.";
        if(health) health.innerText = "20%";
        updateStatusLight('temp-light', '#ef4444');
    } else if (tempVal >= 66) {
        aiSug.innerText = "WARNING: HIGH TEMP";
        aiSug.style.color = "#fbbf24";
        aiAction.innerText = "Observe motor load. Ensure proper ventilation.";
        if(health) health.innerText = "75%";
        updateStatusLight('temp-light', '#fbbf24');
    } else {
        aiSug.innerText = "SYSTEM NORMAL";
        aiSug.style.color = "#00ff88";
        aiAction.innerText = "Endurance test in progress. Data logging stable.";
        if(health) health.innerText = "100%";
        updateStatusLight('temp-light', '#00ff88');
    }

    // Chart Update
    const now = new Date().toLocaleTimeString([], { hour12: false });
    myChart.data.labels.push(now);
    myChart.data.datasets[0].data.push(tempVal);
    myChart.data.datasets[1].data.push(vibVal);
    
    // Maintain only last 20 readings for performance
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
    if(syncLabel) syncLabel.innerText = "Paused";
    
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

function clearHistory() {
    const list = document.getElementById('event-list');
    if(list) list.innerHTML = "";
}
