const url = "https://script.google.com/macros/s/AKfycbzxW6ws7_0IXkqLIeXO6DVeJGnnKudpSJyZUYk4-Nt2yvR16gtCzpK__0gfCqWfxTke/exec";

let myChart;
let fetchInterval;
let isMonitoring = false;

let isFetching = false;
const FETCH_INTERVAL_MS = 5000;

// ================= INIT =================
window.addEventListener('load', () => {
    initChart();
    loadLogsFromStorage();
    logEvent("SYSTEM READY: Dashboard initialized.");
});

// ================= CHART =================
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
            animation: false,
            scales: {
                y: { position: 'left', min: 0 },
                y1: { position: 'right', min: 0 }
            }
        }
    });
}

// ================= LOGGING =================
function logEvent(msg, type = "") {
    const entry = {
        time: new Date().toLocaleTimeString(),
        message: msg,
        type
    };

    const list = document.getElementById('event-list');
    if (list) {
        const div = document.createElement('div');
        div.innerText = `[${entry.time}] ${entry.message}`;
        if (type === "error") div.style.color = "#ef4444";
        list.prepend(div);
    }

    let logs = JSON.parse(localStorage.getItem('motor_logs')) || [];
    logs.push(entry);

    if (logs.length > 50) logs.shift();

    localStorage.setItem('motor_logs', JSON.stringify(logs));
}

function loadLogsFromStorage() {
    const logs = JSON.parse(localStorage.getItem('motor_logs')) || [];
    logs.forEach(l => logEvent(l.message, l.type));
}

// ================= START =================
function startMonitoring() {
    if (fetchInterval) clearInterval(fetchInterval);

    isMonitoring = true;
    toggleButtons(true);

    logEvent("MONITORING STARTED");

    fetchDataFromSheets();
    fetchInterval = setInterval(fetchDataFromSheets, FETCH_INTERVAL_MS);
}

// ================= FETCH (FIXED STABLE VERSION) =================
async function fetchDataFromSheets() {

    if (!isMonitoring || isFetching) return;
    isFetching = true;

    try {

        const syncLabel = document.getElementById('sync-status');

        // 🔥 FORCE NO CACHE (VERY IMPORTANT FIX)
        const response = await fetch(
            `${url}?read=true&t=${Date.now()}&nocache=${Math.random()}`,
            { cache: "no-store" }
        );

        const text = await response.text();

        console.log("RAW RESPONSE:", text);

        // ================= HARD ERROR CHECK =================
        if (!text || text.includes("ERROR") || text.includes("NO_")) {

            if (syncLabel) {
                syncLabel.innerText = "Server Error";
                syncLabel.style.color = "#ef4444";
            }

            logEvent("SYNC ERROR: " + text, "error");
            return;
        }

        let data;

        try {
            data = JSON.parse(text);
        } catch (e) {

            // fallback if plain "OK"
            if (text.trim() === "OK") {

                if (syncLabel) {
                    syncLabel.innerText = "Live";
                    syncLabel.style.color = "#22c55e";
                }

                return;
            }

            throw new Error("Invalid JSON: " + text);
        }

        // ================= VALID DATA =================
        const temp = parseFloat(data.temp) || 0;
        const vib = parseFloat(data.vibration) || 0;

        const status =
            (data.tempStatus || "unknown") + "|" +
            (data.vibStatus || "unknown");

        updateDashboard(temp, vib, "LIVE", status);

        // ================= SYNC STATUS =================
        if (syncLabel) {
            syncLabel.innerText = "Live";
            syncLabel.style.color = "#22c55e";
        }

        // ================= FORCE CHART UPDATE EVERY FETCH =================
        const now = new Date().toLocaleTimeString([], {
            hour12: false,
            minute: '2-digit',
            second: '2-digit'
        });

        myChart.data.labels.push(now);
        myChart.data.datasets[0].data.push(temp);
        myChart.data.datasets[1].data.push(vib);

        if (myChart.data.labels.length > 20) {
            myChart.data.labels.shift();
            myChart.data.datasets.forEach(d => d.data.shift());
        }

        myChart.update('none');

    } catch (e) {

        console.error(e);

        const syncLabel = document.getElementById('sync-status');
        if (syncLabel) {
            syncLabel.innerText = "Offline";
            syncLabel.style.color = "#ef4444";
        }

        logEvent("NETWORK ERROR: " + e.message, "error");

    } finally {
        isFetching = false;
    }
}

// ================= DASHBOARD =================
function updateDashboard(temp, vib, status, action) {

    document.getElementById("temp-val").innerText = temp.toFixed(1);
    document.getElementById("vib-val").innerText = vib.toFixed(3);

    document.getElementById("status-label").innerText = action;
    document.getElementById("ai-action-step").innerText = action;
}

// ================= UI =================
function toggleButtons(state) {
    document.getElementById("connect-btn").style.display = state ? "none" : "inline-block";
    document.getElementById("disconnect-btn").style.display = state ? "inline-block" : "none";
}

// ================= STOP =================
function stopMonitoring() {

    isMonitoring = false;

    if (fetchInterval) clearInterval(fetchInterval);

    updateDashboard(0, 0, "OFFLINE", "Stopped");
    logEvent("MONITORING STOPPED");

    toggleButtons(false);
}
