const url =
    "https://script.google.com/macros/s/AKfycbzxW6ws7_0IXkqLIeXO6DVeJGnnKudpSJyZUYk4-Nt2yvR16gtCzpK__0gfCqWfxTke/exec";

let myChart;
let fetchInterval;
let isFetching = false;

const FETCH_INTERVAL_MS = 3000;

// ================= AUTO START =================
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
                y: {
                    beginAtZero: true
                },
                x: {
                    display: true
                }
            }
        }
    });
}

// ================= AUTO FETCH =================
function startAutoFetch() {

    if (fetchInterval)
        clearInterval(fetchInterval);

    fetchLatestData();

    fetchInterval =
        setInterval(fetchLatestData, FETCH_INTERVAL_MS);
}

// ================= CONDITION INTERPRETER (FPGA-BASED) =================
function interpretFPGAStatus(tempStatus, vibStatus) {

    const t =
        (tempStatus || "").toUpperCase().trim();

    const v =
        (vibStatus || "").toUpperCase().trim();

    // ================= CRITICAL COMBINATION =================
    if (t === "OVERHEATING" && v === "BLOCKED_BEARING") {

        return {
            status: "CRITICAL FAULT: OVERHEATING + BLOCKED BEARING",
            action:
                "Immediate shutdown recommended. FPGA detected thermal runaway combined with mechanical blockage. Inspect bearings, lubrication system, cooling fan, and motor load condition."
        };
    }

    // ================= BLOCKED BEARING ONLY =================
    if (v === "BLOCKED_BEARING") {

        return {
            status: "BLOCKED BEARING DETECTED (FPGA)",
            action:
                "Mechanical obstruction detected. Inspect bearing wear, lubrication failure, shaft misalignment, and replace bearing if abnormal resistance persists."
        };
    }

    // ================= OVERHEATING ONLY =================
    if (t === "OVERHEATING") {

        return {
            status: "OVERHEATING DETECTED (FPGA)",
            action:
                "Thermal anomaly detected. Check cooling system, airflow blockage, capacitor health, and motor overload conditions."
        };
    }

    // ================= NORMAL =================
    return {
        status: "NORMAL OPERATION",
        action:
            "System operating within FPGA-defined safe thresholds. No maintenance required."
    };
}

// ================= FETCH DATA =================
async function fetchLatestData() {

    if (isFetching) return;
    isFetching = true;

    try {

        const response =
            await fetch(url + "?read=true&t=" + Date.now());

        const text = await response.text();

        if (!text || text.includes("ERROR")) {

            updateStatus("ERROR", "#ef4444");
            isFetching = false;
            return;
        }

        const data =
            JSON.parse(text);

        // ================= SENSOR VALUES =================
        const temp =
            parseFloat(data.temp) || 0;

        const vib =
            parseFloat(data.vibration) || 0;

        document.getElementById("temp-display").innerText =
            temp.toFixed(1);

        document.getElementById("vib-display").innerText =
            vib.toFixed(3);

        updateStatus("LIVE", "#22c55e");

        // ================= CHART UPDATE =================
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

        // ================= FPGA STATUS FROM SHEETS =================
        const tempStatus =
            data.tempStatus;

        const vibStatus =
            data.vibStatus;

        console.log("FPGA TEMP STATUS:", tempStatus);
        console.log("FPGA VIB STATUS:", vibStatus);

        // ================= CONDITION ASSESSMENT =================
        const result =
            interpretFPGAStatus(tempStatus, vibStatus);

        document.getElementById("status-label").innerText =
            result.status;

        document.getElementById("ai-action-step").innerText =
            result.action;

    } catch (err) {

        console.error(err);
        updateStatus("OFFLINE", "#ef4444");
    }

    isFetching = false;
}

// ================= STATUS UI =================
function updateStatus(text, color) {

    const el =
        document.getElementById("sync-status");

    if (!el) return;

    el.innerText = text;
    el.style.color = color;
}
