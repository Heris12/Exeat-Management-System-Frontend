import { request } from "./api.js?v=20261101-exeat-slip";

const result = document.getElementById("verificationResult");
const message = document.getElementById("verificationMessage");
const details = document.getElementById("verificationDetails");
const token = new URLSearchParams(window.location.search).get("token");

function showFailure(text, loginRequired = false) {
    result.classList.add("pass-verification-result--invalid");
    message.textContent = text;
    if (loginRequired && token) {
        const next = `verify-exeat.html?token=${token}`;
        const login = document.createElement("a");
        login.className = "pass-verification-login";
        login.href = `index.html?next=${encodeURIComponent(next)}`;
        login.textContent = "Sign in with a Security account to verify";
        result.appendChild(login);
    }
}

function addDetail(label, value) {
    const term = document.createElement("dt");
    term.textContent = label;
    const description = document.createElement("dd");
    description.textContent = value || "Not available";
    details.append(term, description);
}

function formatDate(value) {
    if (!value) return "Not available";
    const date = new Date(`${String(value).slice(0, 10)}T00:00:00Z`);
    const formatted = date.toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        timeZone: "UTC"
    });
    return formatted;
}

async function verifyPass() {
    if (!token || !/^[a-f0-9]{64}$/i.test(token)) {
        showFailure("This QR code does not contain a valid verification code.");
        return;
    }

    try {
        const pass = await request(`/security/verify?token=${encodeURIComponent(token)}`);
        const statusLabels = {
            valid: "GENUINE — APPROVED AND WITHIN THE VALID DATE RANGE",
            expired: "EXPIRED — DO NOT ACCEPT",
            revoked: "REVOKED — DO NOT ACCEPT",
            "not-yet-valid": "NOT YET VALID — DO NOT ACCEPT",
            "not-approved": "NOT APPROVED — DO NOT ACCEPT"
        };
        message.textContent = statusLabels[pass.status] || "This permission slip is not valid.";
        result.classList.toggle("pass-verification-result--valid", pass.valid);
        result.classList.toggle("pass-verification-result--invalid", !pass.valid);

        addDetail("Exeat number", pass.exeatNumber);
        addDetail("Student", pass.student?.fullName);
        addDetail("Matriculation number", pass.student?.matriculationNumber);
        addDetail("Departure", formatDate(pass.departureDate));
        addDetail("Expected return", formatDate(pass.returnDate));
        details.hidden = false;
    } catch (error) {
        if (error.status === 401 || error.status === 403) {
            showFailure("The pass cannot be verified until a security officer signs in.", true);
            return;
        }
        showFailure(error.message || "This permission slip could not be verified.");
    }
}

verifyPass();
