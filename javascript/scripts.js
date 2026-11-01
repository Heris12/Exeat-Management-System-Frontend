import { request, downloadExeatSlip, printExeatSlip } from "./api.js?v=20261101-exeat-slip";
import { Auth } from "./auth.js";

document.addEventListener("DOMContentLoaded", async function () {
    let currentUser = null;
    if (document.querySelector(".dashboard")) {
        if (!localStorage.getItem("token")) {
            window.location.replace("index.html?error=admin-access");
            return;
        }
        try {
            const response = await request("/auth/me");
            currentUser = response.user;
            if (!currentUser || currentUser.role !== "student") {
                localStorage.removeItem("token");
                localStorage.removeItem("currentUser");
                window.location.replace("index.html?error=admin-access");
                return;
            }
            localStorage.setItem("currentUser", JSON.stringify(currentUser));
            document.body.style.visibility = "visible";
        } catch (error) {
            console.error("Could not authenticate the current session:", error);
            if (error.status === 401 || error.status === 403) {
                localStorage.removeItem("token");
                localStorage.removeItem("currentUser");
                window.location.replace("index.html?error=admin-access");
                return;
            }
            document.body.style.visibility = "visible";
            showMessage(error.message || "Unable to connect to the server.", "error");
            window.dispatchEvent(new Event("app:initial-data-ready"));
            return;
        }
    }

    setupLogin();
    setupPasswordRecovery();
    setupExeatForm(currentUser);
    await Promise.all([
        setupDashboard(currentUser),
        setupRequestsPage(currentUser)
    ]);
    setupLogout();
    if (document.querySelector(".dashboard")) {
        window.dispatchEvent(new Event("app:initial-data-ready"));
    }

    const studentName = document.getElementById("studentName");
    const loginSucceeded = sessionStorage.getItem("loginSuccessMessage") === "true";
    if (studentName && currentUser && loginSucceeded) {
        sessionStorage.removeItem("loginSuccessMessage");
        showLoginSuccessToast(currentUser.fullName);
    }
});

// MESSAGE-BOX FUNCTION
function showMessage(message, type = "success") {
    let messageBox = document.getElementById("messageBox");
    if (!messageBox) {
        messageBox = document.createElement("div");
        messageBox.id = "messageBox";
        Object.assign(messageBox.style, {
            padding: "12px 15px",
            marginBottom: "15px",
            borderRadius: "6px",
            fontSize: "14px",
            fontWeight: "500"
        });

        const form = document.querySelector("form");
        if (form) {
            form.parentNode.insertBefore(messageBox, form);
        } else {
            document.body.prepend(messageBox);
        } 
    }

    messageBox.textContent = message;
    if (type === "error") {
        messageBox.style.backgroundColor = "#f8d7da";
        messageBox.style.color = "#b31122";
        messageBox.style.border = "1px solid #f3b4b4";
    } else {
        messageBox.style.backgroundColor = "#d4edda";
        messageBox.style.color = "#155724";
        messageBox.style.border = "1px solid #a8dfc1";
    }
    setTimeout(function () {
        messageBox.remove();
    }, 4000);
}

// LOGIN FORM
function setupLogin() {
    const loginForm = document.getElementById("loginForm");
    if (!loginForm) {
        return;
    }

    const pageUrl = new URL(window.location.href);
    if (pageUrl.searchParams.get("error") === "admin-access") {
        showMessage("Access denied. Please sign in with an account authorized for this page.", "error");
        pageUrl.searchParams.delete("error");
        window.history.replaceState({}, "", pageUrl);
    }

    loginForm.addEventListener("submit", async function (e) {
        e.preventDefault();

        const identifier = document.getElementById("identifier").value.trim();
        const password = document.getElementById("password").value;
        const loginButton = document.getElementById("loginButton");
        if (loginButton) {
            loginButton.disabled = true;
            loginButton.textContent = "Logging in...";
        }
        try {
            const response = await request("/auth/login", {
                method: "POST",
                body: JSON.stringify({ identifier, password })
            });
            const payload = response.data ?? response;
            const user = payload.user ?? payload.data?.user;
            const token = payload.token ?? payload.data?.token;
            if (!user || !token || !user.role) {
                throw new Error("The server returned an incomplete login response. Check that the latest server code is running.");
            }

            localStorage.setItem("token", token);
            localStorage.setItem("currentUser", JSON.stringify(user));
            sessionStorage.setItem("loginSuccessMessage", "true");
            const verificationNext = new URLSearchParams(window.location.search).get("next") || "";
            const verificationMatch = /^verify-exeat\.html\?token=([a-f0-9]{64})$/i.exec(verificationNext);
            window.location.href = user.role === "security" && verificationMatch
                ? `verify-exeat.html?token=${encodeURIComponent(verificationMatch[1])}`
                : user.role === "admin"
                ? "admin.html"
                : user.role === "portal"
                    ? "warden.html"
                    : user.role === "security"
                        ? "security.html"
                        : "dashboard.html";
        } catch (error) {
            console.error("Login failed:", error);
            showMessage(error.message || "Unable to log in. Please try again.", "error");
        } finally {
            if (loginButton) {
                loginButton.disabled = false;
                loginButton.textContent = "Login";
            }
        }
    });
}

function showLoginSuccessToast(fullName) {
    const toast = document.createElement("div");
    toast.className = "toast show success";
    toast.setAttribute("role", "status");
    toast.setAttribute("aria-live", "polite");
    toast.textContent = `Welcome, ${fullName || "you"}! You are now logged in.`;
    document.body.appendChild(toast);
    window.setTimeout(() => toast.remove(), 4000);
}

// RESET FORGOTTEN PASSWORD
function setupPasswordRecovery() {
    const requestForm = document.getElementById("requestResetForm");
    const resetForm = document.getElementById("resetPasswordForm");
    const query = new URLSearchParams(window.location.search);
    const token = query.get("token") || "";

    if (requestForm && token) {
        window.location.replace(`reset-password.html${window.location.search}${window.location.hash}`);
        return;
    }

    if (requestForm) {
        requestForm.addEventListener("submit", async (event) => {
            event.preventDefault();
            const email = document.getElementById("resetEmail").value.trim().toLowerCase();
            const submitButton = document.getElementById("requestResetButton");
            submitButton.disabled = true;
            submitButton.textContent = "Sending...";

            try {
                const response = await request("/auth/forgot-password", {
                    method: "POST",
                    body: JSON.stringify({ email })
                });
                showMessage(response.message || "If an account exists for that email, a password reset link will be sent.");
                requestForm.reset();
            } catch (error) {
                console.error("Could not request a password reset:", error);
                showMessage(error.message || "Unable to request a password reset.", "error");
            } finally {
                submitButton.disabled = false;
                submitButton.textContent = "Send reset link";
            }
        });
    }

    if (resetForm) {
        const title = document.getElementById("recoveryTitle");
        const description = document.getElementById("recoveryDescription");
        resetForm.hidden = !token;
        if (!token) {
            if (query.has("token")) {
                showMessage("This password reset link is invalid or incomplete.", "error");
            }
            return;
        }
        title.textContent = "Choose a new password";
        description.textContent = "Enter and confirm your new password below.";

        resetForm.addEventListener("submit", async (event) => {
            event.preventDefault();
            const password = document.getElementById("newPassword").value;
            const confirmPassword = document.getElementById("confirmPassword").value;
            if (password !== confirmPassword) {
                showMessage("The passwords do not match.", "error");
                return;
            }

            const submitButton = document.getElementById("resetPasswordButton");
            submitButton.disabled = true;
            submitButton.textContent = "Updating...";
            try {
                const response = await request("/auth/reset-password", {
                    method: "POST",
                    body: JSON.stringify({ token, password })
                });
                showMessage(response.message || "Your password has been updated.");
                resetForm.reset();
                window.setTimeout(() => {
                    window.location.replace("index.html");
                }, 1200);
            } catch (error) {
                console.error("Could not reset the password:", error);
                showMessage(error.message || "Unable to reset your password.", "error");
            } finally {
                submitButton.disabled = false;
                submitButton.textContent = "Update password";
            }
        });
    }
}

// EXEAT REQUEST FORM
function setupExeatForm(currentUser) {
    const exeatForm = document.getElementById("exeatForm");
    if (!exeatForm) {
        return;
    }

    if (!currentUser) {
        window.location.href = "index.html";
        return;
    }
    const departureDate = document.getElementById("departureDate");
    const returnDate = document.getElementById("returnDate");
    const today = getToday();
    if (departureDate) {
        departureDate.min = today;
    }

    if (returnDate) {
        returnDate.min = today;
    }

    if (departureDate && returnDate) {
        departureDate.addEventListener("change",function () {
            returnDate.min = departureDate.value;
        }
    )};

    setupCustomSelect("exeatType");
    const submitButton = exeatForm.querySelector('button[type="submit"]');
    if (!currentUser.hostel) {
        if (submitButton) submitButton.disabled = true;
        showMessage("Your account has no hostel assigned. Contact the main administrator before requesting an exeat.", "error");
    }

    exeatForm.addEventListener("submit", async function (e) {
        e.preventDefault();
        const type = document.getElementById("exeatType").value;
        const destination = document.getElementById("destination").value.trim();
        const departure = document.getElementById("departureDate").value;
        const returnDateValue = document.getElementById("returnDate").value;
        const reason = document.getElementById("reason").value.trim();

        if (!type || !destination || !departure || !returnDateValue || !reason) {
            showMessage("Please fill in all fields.", "error");
            return;
        }

        if (returnDateValue <= departure) {
            showMessage("Return date must be after departure date.", "error");
            return;
        }

        const submitButton = exeatForm.querySelector('button[type="submit"]');
        if (submitButton) {
            submitButton.disabled = true;
        }
        try {
            await request("/exeats", {
                method: "POST",
                body: JSON.stringify({
                    exeatType: type,
                    destination,
                    departureDate: departure,
                    returnDate: returnDateValue,
                    reason
                })
            });
            showMessage("Exeat request submitted successfully!");
            exeatForm.reset();
            setTimeout(function () {
                window.location.href = "requests.html";
            }, 800);
        } catch (error) {
            console.error("Exeat request submission failed:", error);
            showMessage(error.message || "Unable to submit your request.", "error");
        } finally {
            if (submitButton) {
                submitButton.disabled = false;
            }
        }
    });
}

function setupCustomSelect(selectId, allowOpenAbove = true) {
    const wrapper = document.getElementById(`${selectId}Select`);
    const select = document.getElementById(selectId);
    const trigger = document.getElementById(`${selectId}Trigger`);
    const value = document.getElementById(`${selectId}Value`);
    const options = document.getElementById(`${selectId}Options`);
    if (!wrapper || !select || !trigger || !value || !options) {
        return;
    }
    const optionItems = [...options.querySelectorAll('[role="option"]')];
    if (optionItems.length === 0) {
        return;
    }

    function syncSelection() {
        const selectedOption = [...select.options].find((option) => option.value === select.value);
        value.textContent = selectedOption.textContent;
        optionItems.forEach((option) => {
            option.setAttribute("aria-selected", String(option.dataset.value === select.value));
        });
        trigger.setAttribute("aria-invalid", String(!select.value));
    }

    function closeOptions(returnFocus = false) {
        options.hidden = true;
        trigger.setAttribute("aria-expanded", "false");
        wrapper.classList.remove("custom-select--open-up");
        wrapper.style.removeProperty("--custom-select-max-height");
        if (returnFocus) trigger.focus();
    }

    function positionOptions() {
        options.hidden = false;
        const triggerBounds = trigger.getBoundingClientRect();
        const menuHeight = options.scrollHeight;
        const viewport = window.visualViewport;
        const viewportTop = viewport?.offsetTop || 0;
        const viewportBottom = viewportTop + (viewport?.height || window.innerHeight);
        const spaceBelow = viewportBottom - triggerBounds.bottom;
        const spaceAbove = triggerBounds.top - viewportTop;
        const openAbove = allowOpenAbove && spaceBelow < menuHeight && spaceAbove > spaceBelow;
        const availableSpace = Math.max(0, (openAbove ? spaceAbove : spaceBelow) - 12);

        wrapper.classList.toggle("custom-select--open-up", openAbove);
        wrapper.style.setProperty("--custom-select-max-height", `${availableSpace}px`);
        trigger.setAttribute("aria-expanded", "true");
    }

    function openOptions() {
        positionOptions();
        const selectedOption = options.querySelector('[aria-selected="true"]');
        (selectedOption || optionItems[0]).focus();
    }

    trigger.addEventListener("click", () => {
        if (options.hidden) openOptions();
        else closeOptions();
    });
    options.addEventListener("click", (event) => {
        const option = event.target.closest('[role="option"]');
        if (!option) return;

        select.value = option.dataset.value;
        select.dispatchEvent(new Event("change", { bubbles: true }));
        syncSelection();
        closeOptions(true);
    });
    trigger.addEventListener("keydown", (event) => {
        if (event.key === "ArrowDown" || event.key === "ArrowUp" || event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            if (options.hidden) openOptions();
        }
    });
    options.addEventListener("keydown", (event) => {
        const optionIndex = optionItems.indexOf(document.activeElement);
        let nextIndex = optionIndex;

        if (event.key === "ArrowDown") nextIndex = (optionIndex + 1) % optionItems.length;
        else if (event.key === "ArrowUp") nextIndex = (optionIndex - 1 + optionItems.length) % optionItems.length;
        else if (event.key === "Home") nextIndex = 0;
        else if (event.key === "End") nextIndex = optionItems.length - 1;
        else if (event.key === "Escape") {
            event.preventDefault();
            closeOptions(true);
            return;
        } else if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            document.activeElement.click();
            return;
        } else {
            return;
        }

        event.preventDefault();
        optionItems[nextIndex].focus();
    });
    document.addEventListener("click", (event) => {
        if (!wrapper.contains(event.target)) closeOptions();
    });
    wrapper.addEventListener("focusout", (event) => {
        if (!wrapper.contains(event.relatedTarget)) closeOptions();
    });

    function repositionOpenOptions() {
        if (!options.hidden) positionOptions();
    }

    window.addEventListener("resize", repositionOpenOptions);
    window.addEventListener("scroll", repositionOpenOptions, true);
    window.visualViewport?.addEventListener("resize", repositionOpenOptions);
    window.visualViewport?.addEventListener("scroll", repositionOpenOptions);
    select.addEventListener("change", syncSelection);
    if (select.form) {
        select.form.addEventListener("reset", () => {
            window.setTimeout(() => {
                syncSelection();
                closeOptions();
            });
        });
    }
    syncSelection();
}

// DASHBOARD
async function setupDashboard(currentUser) {
    const studentName = document.getElementById("studentName");
    const pendingCount = document.getElementById("pendingCount");
    const approvedCount = document.getElementById("approvedCount");
    const rejectedCount = document.getElementById("rejectedCount");
    const recentRequests = document.getElementById("recentRequests");

    if (!studentName && !pendingCount && !approvedCount && !rejectedCount && !recentRequests) {
        return;
    }

    if (!currentUser) {
        window.location.replace("index.html?error=admin-access");
        return;
    }

    if (studentName) {
        studentName.textContent = currentUser.fullName;
    }
    try {
        const requests = (await request("/exeats")).map(normalizeExeat);
        updateDashboardCounts(requests);
        displayRecentRequests(requests);
        displayStudentSlips(requests);
    } catch (error) {
        console.error("Could not load dashboard requests:", error);
        showMessage(error.message || "Unable to load your exeat requests.", "error");
    }
}

function normalizeExeat(exeat) {
    const typeLabels = {
        day: "Day Exeat",
        weekend: "Weekend Exeat",
        long: "Emergency Exeat"
    };
    const statusLabels = {
        pending: "Pending",
        approved: "Approved",
        rejected: "Rejected"
    };
    return {
        id: exeat._id,
        type: typeLabels[exeat.exeatType] || exeat.exeatType,
        destination: exeat.destination,
        hostel: exeat.hostel || "",
        departure: exeat.departureDate,
        returnDate: exeat.returnDate,
        reason: exeat.reason,
        status: statusLabels[exeat.status] || exeat.status,
        createdAt: exeat.createdAt,
        adminComment: exeat.adminComment,
        exeatNumber: exeat.exeatNumber,
        slipStatus: exeat.slipStatus,
        reviewedAt: exeat.reviewedAt
    };
}

function displayStudentSlips(requests) {
    const body = document.getElementById("myExeatSlips");
    if (!body) return;

    body.replaceChildren();
    const slips = requests.filter((item) => item.exeatNumber);
    if (slips.length === 0) {
        const row = body.insertRow();
        const cell = row.insertCell();
        cell.colSpan = 6;
        cell.className = "empty";
        cell.textContent = "Approved exeat permission slips will appear here.";
        return;
    }

    slips.sort((left, right) => new Date(right.reviewedAt) - new Date(left.reviewedAt));
    slips.forEach((slip) => {
        const row = body.insertRow();
        [
            slip.exeatNumber,
            formatDate(slip.reviewedAt),
            formatDate(slip.departure),
            formatDate(slip.returnDate)
        ].forEach((value) => {
            row.insertCell().textContent = value || "—";
        });

        const statusCell = row.insertCell();
        const status = document.createElement("span");
        const statusClass = slip.slipStatus === "valid"
            ? "approved"
            : ["expired", "revoked", "not-approved"].includes(slip.slipStatus)
                ? "rejected"
                : "pending";
        status.className = `status ${statusClass}`;
        status.textContent = (slip.slipStatus || "approved").replace(/-/g, " ");
        statusCell.appendChild(status);

        const actions = row.insertCell();
        if (slip.status !== "Rejected" && slip.slipStatus !== "revoked" && slip.slipStatus !== "not-approved") {
            const downloadButton = document.createElement("button");
            downloadButton.className = "btn view";
            downloadButton.type = "button";
            downloadButton.textContent = "DOWNLOAD MY EXEAT SLIP";
            downloadButton.addEventListener("click", async () => {
                downloadButton.disabled = true;
                try {
                    await downloadExeatSlip(slip.id);
                } catch (error) {
                    showMessage(error.message || "Unable to download your permission slip.", "error");
                } finally {
                    downloadButton.disabled = false;
                }
            });

            const printButton = document.createElement("button");
            printButton.className = "btn approve";
            printButton.type = "button";
            printButton.textContent = "Print";
            printButton.addEventListener("click", async () => {
                try {
                    await printExeatSlip(slip.id);
                } catch (error) {
                    showMessage(error.message || "Unable to print your permission slip.", "error");
                }
            });
            actions.append(downloadButton, printButton);
        } else {
            actions.textContent = "Unavailable";
        }
    });
}

function updateDashboardCounts(requests) {
    for (const status of ["Pending", "Approved", "Rejected"]) {
        const count = requests.filter((item) => item.status === status).length;
        const element = document.getElementById(`${status.toLowerCase()}Count`);
        if (element) {
            element.textContent = count;
        }
    }
}

function displayRecentRequests(requests) {
    const recentRequests = document.getElementById("recentRequests");

    if (!recentRequests) {
        return;
    }
    recentRequests.innerHTML = "";

    if (requests.length === 0) {
        recentRequests.innerHTML = 
        `<tr>
            <td colspan="6" style="text-align:center;">
                No exeat requests found.
            </td>
        </tr>`;
        return;
    }

    const latestRequests = [...requests]
        .sort((left, right) => new Date(right.createdAt) - new Date(left.createdAt))
        .slice(0, 5);
    latestRequests.forEach(function (request) {
        const row = document.createElement("tr");
        row.innerHTML =
        `<td>
            ${escapeHTML(request.type)}
        </td>
        <td>
            ${escapeHTML(request.destination)}
        </td>
        <td>
            ${escapeHTML(request.hostel || "—")}
        </td>
        <td>
            ${formatDate(request.departure)}
        </td>
        <td>
            ${formatDate(request.returnDate)}
        </td>
        <td>
            ${createStatusBadge(request.status)}
        </td>`;

        recentRequests.appendChild(row);
    });
}

// REQUEST HISTORY 
async function setupRequestsPage(currentUser) {
    const allRequests = document.getElementById("allRequests");
    const approvedExeatList = document.getElementById("approvedExeatList");
    if (!allRequests || !approvedExeatList) {
        return;
    }

    if (!currentUser) {
        window.location.href = "index.html";
        return;
    }

    try {
        const requests = (await request("/exeats")).map(normalizeExeat);
        displayRequestHistory(requests);
        displayApprovedExeats(requests);
    } catch (error) {
        console.error("Could not load request history:", error);
        showMessage(error.message || "Unable to load your request history.", "error");
    }

    approvedExeatList.addEventListener("click", async function (event) {
        const button = event.target.closest("[data-exeat-slip-id]");
        if (!button) {
            return;
        }

        button.disabled = true;
        try {
            await downloadExeatSlip(button.dataset.exeatSlipId);
        } catch (error) {
            console.error("Could not download approved exeat slip:", error);
            showMessage(error.message || "Unable to download the exeat slip.", "error");
        } finally {
            button.disabled = false;
        }
    });
}

function displayRequestHistory(requests) {
    const allRequests = document.getElementById("allRequests");
    if (!allRequests) {
        return;
    }
    const adminCommentHeader = document.getElementById("adminCommentHeader");
    const hasAdminComments = requests.some(function (request) {
        return Boolean(request.adminComment && request.adminComment.trim());
    });
    if (adminCommentHeader) {
        adminCommentHeader.hidden = !hasAdminComments;
    }
    allRequests.innerHTML = "";

    if (requests.length === 0) {
        allRequests.innerHTML = 
        `<tr>
            <td colspan="${hasAdminComments ? 8 : 7}" style="text-align:center;">
                No request history found.
            </td>
        </tr>`;
        return;
    }
    [...requests]
        .sort((left, right) => new Date(right.createdAt) - new Date(left.createdAt))
        .forEach(function (request) {
        const row = document.createElement("tr");
        row.innerHTML = 
        `<td>
            ${escapeHTML(request.type)}
        </td>
        <td>
            ${escapeHTML(request.destination)}
        </td>
        <td>
            ${escapeHTML(request.hostel || "—")}
        </td>
        <td>
            ${formatDate(request.departure)}
        </td>
        <td>
            ${formatDate(request.returnDate)}
        </td>
        <td>
            ${escapeHTML(request.reason)}
        </td>
        <td>
            ${createStatusBadge(request.status)}
        </td>
        ${hasAdminComments ? `<td>${request.adminComment ? escapeHTML(request.adminComment) : ""}</td>` : ""}`;

        allRequests.appendChild(row);
    });
}

function displayApprovedExeats(requests) {
    const approvedExeatList = document.getElementById("approvedExeatList");
    if (!approvedExeatList) {
        return;
    }

    const approvedRequests = requests.filter((request) => request.status === "Approved");
    if (approvedRequests.length === 0) {
        approvedExeatList.innerHTML = '<p class="approved-exeats-empty">You have no approved exeats yet.</p>';
        return;
    }

    approvedExeatList.innerHTML = approvedRequests
        .sort((left, right) => new Date(right.createdAt) - new Date(left.createdAt))
        .map((request) => `
            <article class="approved-exeat-card">
                <div class="approved-exeat-details">
                    <h3>${escapeHTML(request.type)} to ${escapeHTML(request.destination)}</h3>
                    <p>${formatDate(request.departure)} - ${formatDate(request.returnDate)}</p>
                    <p>${escapeHTML(request.hostel || "—")}</p>
                </div>
                <button type="button" class="btn approved-exeat-download" data-exeat-slip-id="${escapeHTML(request.id)}"
                    aria-label="Download approved slip for ${escapeHTML(request.type)} to ${escapeHTML(request.destination)}">
                    Download slip
                </button>
            </article>
        `).join("");
}

//SETTINGS
function setupLogout() {
    const logoutBtn = document.getElementById("logoutBtn");
    if (logoutBtn) {
        logoutBtn.addEventListener("click", function (e) {
            e.preventDefault();
            logout();
        });
    }
}

function logout() {
    return Auth.logout();
}

function getToday() {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

function formatDate(dateString) {
    if (!dateString) {
        return "";
    }

    const date = new Date(`${String(dateString).slice(0, 10)}T00:00:00`);
    if (isNaN(date.getTime())) {
        return dateString;
    }
    return date.toLocaleDateString("en-NG",{
        day: "2-digit",
        month: "short",
        year: "numeric"
    });
}

function createStatusBadge(status) {
    let background = "#6c757d";
    if (status === "Pending") {
        background = "#ffc107";
    }

    if (status === "Approved") {
        background = "#28a745";
    }

    if (status === "Rejected") {
        background = "#dc3545";
    }
    return `<span style=" display:inline-block; background:${background};color:white;padding:5px 10px;border-radius:15px;font-size:12px;">${escapeHTML(status)}</span>`;
}

function escapeHTML(value) {
    if (value === null || value === undefined) {
        return "";
    }
    const div = document.createElement("div");
    div.textContent = String(value);
    return div.innerHTML;
}

// RESPONSIVE SIDEBAR
document.addEventListener("DOMContentLoaded", function () {
    const menuIcon = document.getElementById("menu-icon");
    const closeIcon = document.getElementById("close-icon");
    const navbar = document.getElementById("sidebar");
    if (!menuIcon || !closeIcon || !navbar) {
        return;
    }

    const dashboard = document.querySelector(".dashboard");

    function openMenu() {
        navbar.classList.add("active");
        dashboard?.classList.add("sidebar-open");
        menuIcon.setAttribute("aria-expanded", "true");
        closeIcon.focus();
    }

    function closeMenu() {
        navbar.classList.remove("active");
        dashboard?.classList.remove("sidebar-open");
        menuIcon.setAttribute("aria-expanded", "false");
    }

    menuIcon.addEventListener("click", function () {
        if (navbar.classList.contains("active")) {
            closeMenu();
        } else {
            openMenu();
        }
    });
    closeIcon.addEventListener("click", closeMenu);
    navbar.querySelectorAll("a").forEach(function (link) {
        link.addEventListener("click", closeMenu);
    });
    dashboard?.addEventListener("click", function (event) {
        if (event.target === dashboard && navbar.classList.contains("active")) {
            closeMenu();
        }
    });
    document.addEventListener("keydown", function (event) {
        if (event.key === "Escape") {
            closeMenu();
        }
    });
    window.addEventListener("resize", function () {
        if (window.innerWidth > 768) {
            closeMenu();
        }
    });
});