import { request } from "./api.js";
import { Auth } from "./auth.js";

let approvedExeats = [];

document.addEventListener("DOMContentLoaded", initializeSecurityPortal);

async function initializeSecurityPortal() {
    if (!localStorage.getItem("token")) {
        redirectToLogin();
        return;
    }

    try {
        const response = await request("/auth/me");
        const user = response.user;
        if (!user || user.role !== "security") {
            redirectToLogin();
            return;
        }

        localStorage.setItem("currentUser", JSON.stringify(user));
        document.getElementById("securityName").textContent = user.fullName;
        document.getElementById("securitySearch").addEventListener("input", renderExeats);
        setupSidebar();
        await loadApprovedExeats();
        document.body.style.visibility = "visible";
    } catch (error) {
        console.error("Could not load the security portal:", error);
        if (error.status === 401 || error.status === 403) {
            redirectToLogin();
            return;
        }
        showMessage(error.message || "Could not load approved exeat requests.", "error");
        document.body.style.visibility = "visible";
    }
}

async function loadApprovedExeats() {
    const response = await request("/security/exeats");
    approvedExeats = response.exeats;
    document.getElementById("approvedCount").textContent = approvedExeats.length;
    document.getElementById("departedCount").textContent = approvedExeats.filter(
        (exeat) => exeat.departureConfirmedAt
    ).length;
    document.getElementById("returnedCount").textContent = approvedExeats.filter(
        (exeat) => exeat.returnConfirmedAt
    ).length;
    renderExeats();
}

function renderExeats() {
    const body = document.getElementById("securityExeats");
    const query = document.getElementById("securitySearch").value.trim().toLowerCase();
    body.replaceChildren();

    const matches = approvedExeats.filter((exeat) => {
        const student = exeat.student || {};
        return [
            student.fullName,
            student.matriculationNumber,
            student.department,
            student.email,
            student.hostel,
            exeat.destination
        ].join(" ").toLowerCase().includes(query);
    });

    if (matches.length === 0) {
        appendEmptyRow(body, 8, approvedExeats.length
            ? "No matching approved exeats found."
            : "There are no approved exeat requests.");
        return;
    }

    matches.forEach((exeat) => {
        const student = exeat.student || {};
        const row = document.createElement("tr");
        appendTextCell(row, student.fullName || "Student record unavailable");
        appendTextCell(row, student.matriculationNumber);
        appendTextCell(row, student.hostel || exeat.hostel);
        appendTextCell(row, exeat.destination);
        appendTextCell(row, formatDate(exeat.departureDate));
        appendTextCell(row, formatDate(exeat.returnDate));

        const statusCell = document.createElement("td");
        if (exeat.returnConfirmedAt) {
            const status = document.createElement("span");
            status.className = "status returned-school";
            status.textContent = "Returned to school";
            statusCell.appendChild(status);
            const audit = document.createElement("small");
            audit.className = "departure-audit";
            audit.textContent = `Confirmed ${formatDateTime(exeat.returnConfirmedAt)} by ${
                exeat.returnConfirmedBy?.fullName || "security staff"
            }`;
            statusCell.appendChild(audit);
        } else if (exeat.departureConfirmedAt) {
            const status = document.createElement("span");
            status.className = "status left-school";
            status.textContent = "Left school";
            statusCell.appendChild(status);
            const audit = document.createElement("small");
            audit.className = "departure-audit";
            audit.textContent = `Confirmed ${formatDateTime(exeat.departureConfirmedAt)} by ${
                exeat.departureConfirmedBy?.fullName || "security staff"
            }`;
            statusCell.appendChild(audit);
        } else {
            const status = document.createElement("span");
            status.className = "status pending";
            status.textContent = "Awaiting departure";
            statusCell.appendChild(status);
        }
        row.appendChild(statusCell);

        const actionCell = document.createElement("td");
        if (!exeat.departureConfirmedAt) {
            const button = document.createElement("button");
            button.type = "button";
            button.className = "btn approve";
            button.textContent = "Confirm departure";
            button.setAttribute("aria-label", `Confirm departure for ${student.fullName || "student"}`);
            button.addEventListener("click", () => confirmDeparture(exeat, button));
            actionCell.appendChild(button);
        } else if (!exeat.returnConfirmedAt) {
            const button = document.createElement("button");
            button.type = "button";
            button.className = "btn approve";
            button.textContent = "Confirm return";
            button.setAttribute("aria-label", `Confirm return for ${student.fullName || "student"}`);
            button.addEventListener("click", () => confirmReturn(exeat, button));
            actionCell.appendChild(button);
        } else {
            actionCell.textContent = "Complete";
        }
        row.appendChild(actionCell);
        body.appendChild(row);
    });
}

async function confirmDeparture(exeat, button) {
    const studentName = exeat.student?.fullName || "this student";
    if (!window.confirm(`Confirm that ${studentName} has left the school?`)) return;

    button.disabled = true;
    try {
        const result = await request(`/security/exeats/${encodeURIComponent(exeat._id)}/departure`, {
            method: "PATCH"
        });
        showMessage(result.message || "Student departure confirmed.", "success");
        await loadApprovedExeats();
    } catch (error) {
        console.error("Could not confirm student departure:", error);
        showMessage(error.message || "Could not confirm this departure.", "error");
        if (error.status === 401 || error.status === 403) redirectToLogin();
    } finally {
        button.disabled = false;
    }

    async function confirmReturn(exeat, button) {
        const studentName = exeat.student?.fullName || "this student";
        if (!window.confirm(`Confirm that ${studentName} has returned to school?`)) return;

        button.disabled = true;
        try {
            const result = await request(`/security/exeats/${encodeURIComponent(exeat._id)}/return`, {
                method: "PATCH"
            });
            showMessage(result.message || "Student return confirmed.", "success");
            await loadApprovedExeats();
        } catch (error) {
            console.error("Could not confirm student return:", error);
            showMessage(error.message || "Could not confirm this return.", "error");
            if (error.status === 401 || error.status === 403) redirectToLogin();
        } finally {
            button.disabled = false;
        }
    }
}

function appendTextCell(row, value) {
    const cell = document.createElement("td");
    cell.textContent = value == null ? "" : String(value);
    row.appendChild(cell);
}

function appendEmptyRow(body, columns, message) {
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = columns;
    cell.className = "empty";
    cell.textContent = message;
    row.appendChild(cell);
    body.appendChild(row);
}

function formatDate(value) {
    if (!value) return "—";
    const date = new Date(value);
    return Number.isNaN(date.getTime())
        ? "—"
        : date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function formatDateTime(value) {
    if (!value) return "—";
    const date = new Date(value);
    return Number.isNaN(date.getTime())
        ? "—"
        : date.toLocaleString(undefined, {
            year: "numeric",
            month: "short",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit"
        });
}

function showMessage(message, type) {
    const element = document.getElementById("securityMessage");
    element.textContent = message;
    element.className = type === "error" ? "error-message" : "success-message";
}

function redirectToLogin() {
    localStorage.removeItem("token");
    localStorage.removeItem("currentUser");
    window.location.replace("index.html?error=admin-access");
}

function setupSidebar() {
    const menuIcon = document.getElementById("menu-icon");
    const closeIcon = document.getElementById("close-icon");
    const sidebar = document.getElementById("sidebar");
    const dashboard = document.querySelector(".dashboard");

    function closeMenu() {
        sidebar.classList.remove("active");
        dashboard.classList.remove("sidebar-open");
        menuIcon.setAttribute("aria-expanded", "false");
    }

    menuIcon.addEventListener("click", () => {
        const isOpen = sidebar.classList.toggle("active");
        dashboard.classList.toggle("sidebar-open", isOpen);
        menuIcon.setAttribute("aria-expanded", String(isOpen));
        if (isOpen) closeIcon.focus();
    });
    closeIcon.addEventListener("click", closeMenu);
    sidebar.querySelectorAll("a").forEach((link) => link.addEventListener("click", closeMenu));
    document.addEventListener("keydown", (event) => {
        if (event.key === "Escape") closeMenu();
    });
    document.getElementById("logoutBtn").addEventListener("click", async (event) => {
        event.preventDefault();
        await Auth.logout();
    });
}
