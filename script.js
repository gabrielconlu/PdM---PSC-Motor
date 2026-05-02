const url = "https://script.google.com/macros/s/AKfycbzxW6ws7_0IXkqLIeXO6DVeJGnnKudpSJyZUYk4-Nt2yvR16gtCzpK__0gfCqWfxTke/exec";

let myChart;
let fetchInterval;
let isMonitoring = false;

// 🔒 SYNC CONTROL FLAGS
let isFetching = false;
let lastFetchTime = 0;
const FETCH_INTERVAL_MS = 5000;

// --- 1. INITIALIZATION ---
window.addEventListener('load', () => {
    initChart();
    loadLogsFromStorage();
    logEvent("SYSTEM READY: Hardware-Driven Dashboard initialized.");
});

function initChart() {
    const canvas = document.getElementById('myChart');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');

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
                y: {
                    type: 'linear',
                    position: 'left',
                    title: { display: true, text: 'Temp (°C)' },
                    min: 0
                },
                y1: {
                    type: 'linear',
                    position: 'right',
                    display: true,
                    title: { display: true, text: 'Vib (G)' },
                    min: 0
                }
            }
        }
    });
}

// --- 2. LOGGING SYSTEM ---
function logEvent(msg, type = "") {
    const entryData = {
        time: new Date().toLocaleTimeString(),
        message: msg,
        type: type
    };

    renderLogEntry(entryData);
    saveLogToStorage(entryData);
}

function renderLogEntry(log) {
    const list = document.getElementById('event-list') || document.getElementById('system-logs');
    if (!list) return;

    const entry = document.createElement('div');
    entry.className = "log-entry";

    if (log.type === "error") entry.style.color = "#ef4444";

    entry.innerHTML = `<span class="log-time">[${log.time}]</span> ${log.message}`;
    list.prepend(entry);
}

function saveLogToStorage(log) {
    let logs = JSON.parse(localStorage.getItem('motor_logs')) || [];
    logs.push(log);

    if (logs.length > 50) logs.shift();

    localStorage.setItem('motor_logs', JSON.stringify(logs));
}

function loadLogsFromStorage() {
    const logs = JSON.parse(localStorage.getItem('motor_logs')) || [];
    logs.forEach(log => renderLogEntry(log));
}

// --- 3. START MONITORING (SYNC SAFE) ---
async function startMonitoring() {
    if (fetchInterval) clearInterval(fetchInterval);

    isMonitoring = true;
    toggleButtons(true);

    logEvent("MONITORING STARTED: Fetching hardware data...");

    await fetchDataFromSheets(); // immediate sync

    fetchInterval = setInterval(() => {
        fetchDataFromSheets();
    }, FETCH_INTERVAL_MS);
}

// --- 4. DATA ACQUISITION (SYNC LOCKED) ---
async function fetchDataFromSheets() {
    if (!isMonitoring) return;

    // prevent overlapping requests
    if (isFetching) return;
    isFetching = true;

    try {
        const syncLabel = document.getElementById('sync-status');

        const response = await fetch(`${url}?read=true&t=${Date.now()}`);
        const data = await response.json();

        if (!data || !data.timestamp) {
            throw new Error("Invalid data received");
        }

        const dataTime = parseSheetDate(data.timestamp).getTime();
        const currentTime = Date.now();
        const diffInSeconds = (currentTime - dataTime) / 1000;

        // OFFLINE CONDITION
        if (isNaN(dataTime) || diffInSeconds > 30) {
            if (syncLabel) {
                syncLabel.innerText = "Offline";
                syncLabel.style.color = "#fbbf24";
            }

            updateDashboard(0, 0, "OFFLINE", "No Hardware Data");
            return;
        }

        // LIVE STATUS
        if (syncLabel) {
            syncLabel.innerText = "Live";
            syncLabel.style.color = "#22c55e";
        }

        updateDashboard(
            data.temp,
            data.vibration,
            "LIVE",
            data.fpga_action || "Normal"
        );

        lastFetchTime = currentTime;

    } catch (e) {
        logEvent("ERROR: Sync failed", "error");

        const syncLabel = document.getElementById('sync-status');
        if (syncLabel) {
            syncLabel.innerText = "Sync Error";
            syncLabel.style.color = "#ef4444";
        }

    } finally {
        isFetching = false;
    }
}

// --- 5. DASHBOARD UPDATE (FPGA-BASED LOGIC) ---
function updateDashboard(t, v, connectionStatus, hardwareAction) {
    const tempVal = parseFloat(t) || 0;
    const vibVal = parseFloat(v) || 0;

    updateTextElement('temp-val', tempVal.toFixed(1), connectionStatus);
    updateTextElement('vib-val', vibVal.toFixed(2), connectionStatus);

    // CHART UPDATE
    if (isMonitoring && connectionStatus !== "OFFLINE") {
        const now = new Date().toLocaleTimeString([], {
            hour12: false,
            minute: '2-digit',
            second: '2-digit'
        });

        myChart.data.labels.push(now);
        myChart.data.datasets[0].data.push(tempVal);
        myChart.data.datasets[1].data.push(vibVal);

        if (myChart.data.labels.length > 15) {
            myChart.data.labels.shift();
            myChart.data.datasets.forEach(d => d.data.shift());
        }

        myChart.update('none');
    }

    // STATUS LOGIC (FPGA OUTPUT)
    let currentStatusText = hardwareAction.toUpperCase();
    let statusClass = "status-normal";
    let actionStep = "System operating within normal parameters.";

    if (connectionStatus === "OFFLINE") {
        currentStatusText = "DISCONNECTED";
        statusClass = "status-idle";
        actionStep = "Check ESP32 and FPGA connection.";
    }
    else if (hardwareAction.includes("CRITICAL") || hardwareAction.includes("VENTILATION")) {
        statusClass = "status-critical";
        actionStep = `🚨 FPGA ALERT: ${hardwareAction}. Immediate inspection required.`;
        logEvent(`CRITICAL: ${hardwareAction}`, "error");
    }
    else if (hardwareAction.includes("HIGH") || hardwareAction.includes("WARNING")) {
        statusClass = "status-warning";
        actionStep = `⚠️ WARNING: ${hardwareAction}`;
        logEvent(`WARNING: ${hardwareAction}`);
    }

    const statLabel = document.getElementById('status-label');
    const aiAction = document.getElementById('ai-action-step');

    if (statLabel) {
        statLabel.innerText = currentStatusText;
        statLabel.className = "status-text " + statusClass;
    }

    if (aiAction) aiAction.innerHTML = actionStep;
}

// --- 6. HELPERS ---
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

function toggleButtons(monitoring) {
    const connBtn = document.getElementById('connect-btn');
    const discBtn = document.getElementById('disconnect-btn');

    if (connBtn) connBtn.style.display = monitoring ? 'none' : 'inline-block';
    if (discBtn) discBtn.style.display = monitoring ? 'inline-block' : 'none';
}

function updateTextElement(id, val, status) {
    const el = document.getElementById(id);
    if (el) el.innerText = (status === "OFFLINE") ? "0.0" : val;
}

// --- 7. STOP MONITORING ---
function stopMonitoring() {
    isMonitoring = false;

    if (fetchInterval) {
        clearInterval(fetchInterval);
        fetchInterval = null;
    }

    isFetching = false;

    updateDashboard(0, 0, "OFFLINE", "Disconnected");
    logEvent("PAUSED: Monitoring stopped.");
    toggleButtons(false);
}
