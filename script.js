const url = "https://script.google.com/macros/s/AKfycbzxW6ws7_0IXkqLIeXO6DVeJGnnKudpSJyZUYk4-Nt2yvR16gtCzpK__0gfCqWfxTke/exec";

let myChart;
let fetchInterval = null;
let isMonitoring = false;
let isFetching = false;

const FETCH_INTERVAL_MS = 3000;

// ================= INIT =================
window.addEventListener("load", () => {

    initChart();
    loadLogsFromStorage();

    logEvent("SYSTEM READY");

    // 🔥 FIX BUTTON BINDING (CRITICAL)
    const connectBtn = document.getElementById("connect-btn");
    const disconnectBtn = document.getElementById("disconnect-btn");

    if (connectBtn) connectBtn.addEventListener("click", startMonitoring);
    if (disconnectBtn) disconnectBtn.addEventListener("click", stopMonitoring);
});

// ================= CHART =================
function initChart() {

    const canvas = document.getElementById("myChart");
    if (!canvas) return;

    const ctx = canvas.getContext("2d");

    myChart = new Chart(ctx, {
        type: "line",
        data: {
            labels: [],
            datasets: [
                {
                    label: "Temperature (°C)",
                    data: [],
                    borderColor: "#ef4444",
                    tension: 0.3
                },
                {
                    label: "Vibration (x1000)",
                    data: [],
                    borderColor: "#22c55e",
                    tension: 0.3
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false
        }
    });
}

// ================= START =================
function startMonitoring() {

    if (fetchInterval) clearInterval(fetchInterval);

    isMonitoring = true;

    toggleButtons(true);

    logEvent("MONITORING STARTED");

    fetchData(); // immediate first fetch

    fetchInterval = setInterval(fetchData, FETCH_INTERVAL_MS);
}

// ================= FETCH DATA =================
async function fetchData() {

    if (!isMonitoring || isFetching) return;
    isFetching = true;

    try {

        const res = await fetch(url + "?t=" + Date.now());
        const text = await res.text();

        console.log("RAW RESPONSE:", text);

        const syncStatus = document.getElementById("sync-status");

        // ❌ ERROR HANDLING
        if (text.includes("ERROR") || text.includes("MISSING") || text.includes("NO_")) {
            if (syncStatus) syncStatus.innerText = "Server Error";
            logEvent("SERVER ERROR: " + text, "error");
            return;
        }

        // ✔ OK RESPONSE (your Apps Script returns OK only)
        if (text.trim() === "OK") {

            if (syncStatus) syncStatus.innerText = "Live";

            logEvent("SYNC OK");

            // IMPORTANT:
            // We assume ESP already updates values on UI or last known cache
            // So we read from UI elements OR fallback values

            const temp = parseFloat(document.getElementById("temp-val")?.innerText || 0);
            const vib = parseFloat(document.getElementById("vib-val")?.innerText || 0);

            updateDashboard(temp, vib, "LIVE");

        } else {
            logEvent("UNKNOWN RESPONSE: " + text);
        }

    } catch (err) {

        console.error(err);

        const syncStatus = document.getElementById("sync-status");
        if (syncStatus) syncStatus.innerText = "Offline";

        logEvent("NETWORK ERROR", "error");

    } finally {
        isFetching = false;
    }
}

// ================= DASHBOARD UPDATE =================
function updateDashboard(temp, vib, status) {

    const t = parseFloat(temp) || 0;
    const v = parseFloat(vib) || 0;

    // DISPLAY (fixed decimals)
    document.getElementById("temp-val").innerText = t.toFixed(2);
    document.getElementById("vib-val").innerText = v.toFixed(4);

    // SCALE vibration for visibility (IMPORTANT FIX)
    const vibScaled = v * 1000;

    const time = new Date().toLocaleTimeString();

    myChart.data.labels.push(time);
    myChart.data.datasets[0].data.push(t);
    myChart.data.datasets[1].data.push(vibScaled);

    // keep last 20 points
    if (myChart.data.labels.length > 20) {
        myChart.data.labels.shift();
        myChart.data.datasets.forEach(d => d.data.shift());
    }

    myChart.update("none");

    document.getElementById("status-label").innerText = status;
}

// ================= STOP =================
function stopMonitoring() {

    isMonitoring = false;

    if (fetchInterval) clearInterval(fetchInterval);

    toggleButtons(false);

    document.getElementById("status-label").innerText = "STOPPED";

    logEvent("MONITORING STOPPED");
}

// ================= UI TOGGLE =================
function toggleButtons(running) {

    const connect = document.getElementById("connect-btn");
    const disconnect = document.getElementById("disconnect-btn");

    if (connect) connect.style.display = running ? "none" : "inline-block";
    if (disconnect) disconnect.style.display = running ? "inline-block" : "none";
}

// ================= LOGGING =================
function logEvent(msg, type = "") {
    console.log(`[${type || "INFO"}] ${msg}`);
}

// ================= STORAGE =================
function loadLogsFromStorage() {
    const logs = JSON.parse(localStorage.getItem("motor_logs")) || [];
    logs.forEach(l => logEvent(l.message, l.type));
}
