const url =
    "https://script.google.com/macros/s/AKfycbzxW6ws7_0IXkqLIeXO6DVeJGnnKudpSJyZUYk4-Nt2yvR16gtCzpK__0gfCqWfxTke/exec";

let myChart;
let fetchInterval;
let isFetching = false;

const FETCH_INTERVAL_MS = 3000;

// ================= INIT =================
window.addEventListener("load", () => {
    initChart();
    startAutoFetch();
});

// ================= CHART =================
function initChart() {

    const ctx =
        document.getElementById("myChart").getContext("2d");

    myChart = new Chart(ctx, {

        type: "line",
        data: {
            labels: [],
            datasets: [
                {
                    label: "Temperature (°C)",
                    data: [],
                    borderColor: "#ef4444",
                    borderWidth: 2,
                    tension: 0.3
                },
                {
                    label: "Vibration (G)",
                    data: [],
                    borderColor: "#22c55e",
                    borderWidth: 2,
                    tension: 0.3
                }
            ]
        },

        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: false,
            scales: {
                y: { beginAtZero: true },
                x: { display: true }
            }
        }
    });
}

// ================= START FETCH =================
function startAutoFetch() {

    if (fetchInterval)
        clearInterval(fetchInterval);

    fetchLatestData();

    fetchInterval =
        setInterval(fetchLatestData, FETCH_INTERVAL_MS);
}

// ================= NORMALIZE =================
function normalize(str) {

    return (str || "")
        .toString()
        .toUpperCase()
        .replace(/\s+/g, "_")
        .replace(/-+/g, "_")
        .trim();
}

// ================= CONDITION ENGINE =================
function getMaintenanceOutput(tempStatus, vibStatus) {

    const t = normalize(tempStatus);
    const v = normalize(vibStatus);

    if (t === "OVERHEATING" && v === "BLOCKED_BEARING") {
        return {
            status: "CRITICAL FAULT",
            action: "Check cooling system, bearing damage, lubrication, and motor load immediately."
        };
    }

    if (v === "BLOCKED_BEARING") {
        return {
            status: "BLOCKED BEARING DETECTED",
            action: "Inspect bearing, lubrication failure, and shaft obstruction."
        };
    }

    if (t === "OVERHEATING") {
        return {
            status: "OVERHEATING DETECTED",
            action: "Check cooling fan, airflow, and motor overload."
        };
    }

    return {
        status: "NORMAL",
        action: "System operating within safe range."
    };
}

// ================= FETCH =================
async function fetchLatestData() {

    if (isFetching) return;
    isFetching = true;

    try {

        const response =
            await fetch(url + "?read=true&t=" + Date.now());

        const data =
            await response.json();

        console.log("DATA:", data);

        const temp =
            parseFloat(data.temp) || 0;

        const vib =
            parseFloat(data.vibration) || 0;

        // ================= CHART =================
        const time =
            new Date().toLocaleTimeString();

        myChart.data.labels.push(time);
        myChart.data.datasets[0].data.push(temp);
        myChart.data.datasets[1].data.push(vib);

        if (myChart.data.labels.length > 20) {

            myChart.data.labels.shift();

            myChart.data.datasets.forEach(d =>
                d.data.shift()
            );
        }

        myChart.update();

        // ================= STATUS =================
        const result =
            getMaintenanceOutput(
                data.tempStatus,
                data.vibStatus
            );

        document.getElementById("status-label").innerText =
            result.status;

        document.getElementById("ai-action-step").innerText =
            result.action;

        updateStatus("LIVE", "#22c55e");

    } catch (err) {

        console.error(err);
        updateStatus("OFFLINE", "#ef4444");
    }

    isFetching = false;
}

// ================= STATUS =================
function updateStatus(text, color) {

    const el =
        document.getElementById("sync-status");

    if (!el) return;

    el.innerText = text;
    el.style.color = color;
}
