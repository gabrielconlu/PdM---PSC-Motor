// --- CONFIGURATION ---
const url = "https://script.google.com/macros/s/AKfycbxVt2OEhv_YPjhrjvrw7uM0jvkvPeJAOlzwOfVXDiR2030heB3LPt9e9aLYxbnmJK0n/exec"; 

// AI Variables
let prevData = { t: 0, c: 0, v: 0 };
let lastFaultStatus = "";
let faultPersistenceCounter = 0; 
let isCalibrated = false;
let calibrationBuffer = [];
let ambientBaseline = { t: 0, v: 0 }; 
let motorRunning = false;

// --- TENSORFLOW SETUP ---
const model = tf.sequential();
model.add(tf.layers.dense({ units: 8, inputShape: [2], activation: 'relu' })); 
model.add(tf.layers.dense({ units: 1 })); 
model.compile({ optimizer: tf.train.adam(0.01), loss: 'meanSquaredError' });
let isAITrained = false;

// --- CHART INITIALIZATION ---
const ctx = document.getElementById('myChart').getContext('2d');
let myChart = new Chart(ctx, {
    type: 'line',
    data: {
        labels: [],
        datasets: [
            { label: 'Temp (°C)', data: [], borderColor: '#ff4444', borderWidth: 3, pointRadius: 0, tension: 0.3, yAxisID: 'y' },
            { label: 'Current (A)', data: [], borderColor: '#00ccff', borderWidth: 2, pointRadius: 0, tension: 0.3, yAxisID: 'y1' },
            { label: 'Vibration (G)', data: [], borderColor: '#00ff88', borderWidth: 2, pointRadius: 0, tension: 0.3, yAxisID: 'y1' }
        ]
    },
    options: {
        responsive: true, maintainAspectRatio: false,
        scales: {
            y: { type: 'linear', position: 'left', min: 0, max: 100, title: { display: true, text: 'Temperature °C', color: '#ff4444' } },
            y1: { type: 'linear', position: 'right', min: 0, max: 10, title: { display: true, text: 'Amp / G-Force', color: '#00ff88' } }
        },
        plugins: { legend: { labels: { color: '#e0e6ed' } } }
    }
});

// --- CORE FUNCTIONS ---
window.onload = function() {
    const list = document.getElementById('event-list');
    const savedLogs = JSON.parse(localStorage.getItem('motorLogs')) || [];
    if(savedLogs.length > 0 && list) list.innerHTML = "";
    savedLogs.forEach(log => {
        const entry = document.createElement('li');
        entry.innerText = log;
        if(list) list.appendChild(entry);
    });
    logEvent("DASHBOARD ACTIVE: Session restored.");
    updateDashboard(); 
};

async function updateDashboard() {
    try {
        const response = await fetch(url + "&t=" + new Date().getTime());
        const csvData = await response.text();
        const rows = csvData.split('\n').filter(r => r.trim() !== "");
        const dataRows = (isNaN(parseFloat(rows[0].split(',')[1]))) ? rows.slice(1) : rows;
        if (dataRows.length === 0) return;

        const lastRow = dataRows[dataRows.length - 1].split(',');
        const temp = parseFloat(lastRow[1]) || 0;
        const curr = parseFloat(lastRow[2]) || 0;
        const vib = parseFloat(lastRow[3]) || 0;

        // Startup Detection
        if (curr > 0.2 && !motorRunning) {
            motorRunning = true;
            resetCalibration(); 
            logEvent("STARTUP: Motor current detected. Initializing AI...");
        } else if (curr < 0.1 && motorRunning) {
            motorRunning = false;
            logEvent("SHUTDOWN: Motor is now idle.");
        }

        document.getElementById('temp-display').innerText = temp.toFixed(1) + "°C";
        document.getElementById('curr-display').innerText = curr.toFixed(2) + "A";
        document.getElementById('vib-display').innerText = vib.toFixed(2) + "G";

        if (motorRunning) {
            if (!isCalibrated) {
                runCalibration(temp, vib, curr);
            } else {
                const health = calculateHealth(temp, curr, vib);
                runAdvancedAI(temp, curr, vib, health);
            }
        } else {
            document.getElementById('ai-suggestion').innerText = "STANDBY MODE";
            document.getElementById('ai-action-step').innerText = "Waiting for motor startup...";
            document.getElementById('ai-container').className = "ai-box";
        }

        updateStatusLights(temp, curr, vib);

        // Update Chart (Last 20 Points)
        const history = dataRows.slice(-20);
        myChart.data.labels = history.map(r => r.split(',')[0].split(' ')[1] || "Live");
        myChart.data.datasets[0].data = history.map(r => parseFloat(r.split(',')[1]) || 0);
        myChart.data.datasets[1].data = history.map(r => parseFloat(r.split(',')[2]) || 0);
        myChart.data.datasets[2].data = history.map(r => parseFloat(r.split(',')[3]) || 0);
        myChart.update('none');

        prevData = { t: temp, c: curr, v: vib };
    } catch (e) { console.error("Update Error:", e); }
}

async function runCalibration(t, v, c) {
    const container = document.getElementById('ai-container');
    const progBar = document.getElementById('calib-progress-bar');
    const progCont = document.getElementById('calib-progress-container');
    
    calibrationBuffer.push({t, v, c});
    container.classList.add('ai-calibrating');
    progCont.style.display = "block";
    
    let count = calibrationBuffer.length;
    progBar.style.width = (count / 10) * 100 + "%";
    document.getElementById('ai-suggestion').innerText = `CALIBRATING AI: (${count}/10)`;

    if (count >= 10) {
        // AI Training
        const inputs = calibrationBuffer.map(d => [d.c, d.v]);
        const outputs = calibrationBuffer.map(d => [d.t]);
        const xs = tf.tensor2d(inputs);
        const ys = tf.tensor2d(outputs);

        await model.fit(xs, ys, { epochs: 100 });
        
        ambientBaseline.t = calibrationBuffer.reduce((a, b) => a + b.t, 0) / 10;
        ambientBaseline.v = calibrationBuffer.reduce((a, b) => a + b.v, 0) / 10;
        isCalibrated = true;
        isAITrained = true;
        
        logEvent(`AI TRAINED: Baseline set. Ready for anomaly detection.`);
        container.classList.remove('ai-calibrating');
        progCont.style.display = "none";
    }
}

function calculateHealth(t, c, v) {
    let score = 100;
    const tempDev = t - ambientBaseline.t;
    const vibDev = v - ambientBaseline.v;
    if (tempDev > 5) score -= tempDev * 3; 
    if (vibDev > 0.4) score -= vibDev * 20;
    if (c > 5) score -= (c - 5) * 15;
    score = Math.max(0, Math.min(100, score));
    document.getElementById('motor-health-score').innerText = Math.round(score) + "%";
    document.getElementById('motor-health-status').innerText = score > 80 ? "Excellent" : score > 50 ? "Caution" : "Critical";
    return score;
}

async function runAdvancedAI(t, c, v, h) {
    if (!isAITrained) return;

    // Use tf.tidy to prevent memory leaks during 2-week test
    const prediction = tf.tidy(() => {
        const inputTensor = tf.tensor2d([[c, v]]);
        return model.predict(inputTensor).dataSync()[0];
    });

    const tempDeviation = t - prediction;
    const container = document.getElementById('ai-container');
    const sugg = document.getElementById('ai-suggestion');
    const act = document.getElementById('ai-action-step');

    let diag = "MONITORING ACTIVE";
    let advice = "Heuristic analysis: Normal Operation";
    let anomaly = false;

    // Logic Tree
    if (tempDeviation > 4.5) {
        diag = "AI ALERT: THERMAL DEVIATION";
        advice = "Temp is 4.5°C higher than AI predicts. Check cooling/friction.";
        anomaly = true;
    } else if (v > (ambientBaseline.v + 1.2)) {
        diag = "ALERT: MECHANICAL WEAR";
        advice = "Vibration spike detected. Possible bearing or mount loose.";
        anomaly = true;
    }

    if (anomaly) faultPersistenceCounter++;
    else faultPersistenceCounter = 0;

    if (faultPersistenceCounter >= 2) {
        sugg.innerText = diag;
        act.innerText = advice;
        container.classList.add('ai-alert');
        if (diag !== lastFaultStatus) {
            logEvent(`AI DIAGNOSTIC: ${diag}`);
            lastFaultStatus = diag;
        }
    } else {
        sugg.innerText = "AI STATUS: NORMAL";
        act.innerText = "Motor operating within learned parameters.";
        container.classList.remove('ai-alert');
    }
}

function logEvent(msg) {
    const list = document.getElementById('event-list');
    if(!list) return;
    const fullMsg = `[${new Date().toLocaleString()}] ${msg}`;
    const entry = document.createElement('li');
    entry.innerText = fullMsg;
    list.prepend(entry);
    let logs = JSON.parse(localStorage.getItem('motorLogs')) || [];
    logs.unshift(fullMsg);
    if(logs.length > 50) logs.pop(); 
    localStorage.setItem('motorLogs', JSON.stringify(logs));
}

function updateStatusLights(t, c, v) { 
    setLight('temp-light', t, 48, 55); 
    setLight('curr-light', c, 4.5, 6); 
    setLight('vib-light', v, 1.8, 2.8); 
}

function setLight(id, val, warn, crit) { 
    const el = document.getElementById(id); 
    if(!el) return; 
    el.className = "status-light " + (val >= crit ? 'critical' : val >= warn ? 'warning' : 'normal'); 
}

function clearHistory() {
    if(confirm("Clear logs?")) { localStorage.removeItem('motorLogs'); location.reload(); }
}

setInterval(updateDashboard, 5000); // 5-second interval for stability
