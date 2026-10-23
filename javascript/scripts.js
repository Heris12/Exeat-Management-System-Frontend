import { request } from "./api.js";
import { Auth } from "./auth.js";

document.addEventListener("DOMContentLoaded", async function () {
    let currentUser = null;
    if (document.querySelector(".dashboard")) {
        if (!localStorage.getItem("token")) {
            window.location.href = "index.html";
            return;
        }
        try {
            const response = await request("/auth/me");
            currentUser = response.user;
            localStorage.setItem("currentUser", JSON.stringify(currentUser));
        } catch (error) {
            console.error("Could not authenticate the current session:", error);
            if (error.status === 401 || error.status === 403) {
                logout();
                return;
            }
            showMessage(error.message || "Unable to connect to the server.", "error");
            return;
        }
    }

    setupLogin();
    setupRegistration();
    setupExeatForm(currentUser);
    setupDashboard(currentUser);
    setupRequestsPage(currentUser);
    setupLogout();

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
    loginForm.addEventListener("submit", async function (e) {
        e.preventDefault();

        const email = document.getElementById("email").value.trim().toLowerCase();
        const password = document.getElementById("password").value;
        try {
            const response = await request("/auth/login", {
                method: "POST",
                body: JSON.stringify({ email, password })
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
            window.location.href = user.role === "admin"
                ? "admin.html"
                : "dashboard.html";
        } catch (error) {
            console.error("Login failed:", error);
            showMessage(error.message || "Unable to log in. Please try again.", "error");
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
    
// REGISTER FORM 
function setupRegistration() {
    const registerForm = document.getElementById("registerForm");
    if (!registerForm) {
        return;
    }

    registerForm.addEventListener("submit", async function (e) {
        e.preventDefault();
        const fullName = document.getElementById("fullName").value.trim();
        const matricNumber = document.getElementById("matricNumber").value.trim();
        const department = document.getElementById("department").value.trim();
        const email = document.getElementById("registerEmail").value.trim().toLowerCase();
        const password = document.getElementById("registerPassword").value;

        if (!fullName || !matricNumber || !department || !email || !password) {
            showMessage("Please fill in all fields.", "error");
            return;
        }

        if (password.length < 6) {
            showMessage("Password must be at least 6 characters.", "error");
            return;
        }

        try {
            await request("/auth/register", {
                method: "POST",
                body: JSON.stringify({
                    fullName,
                    matricNumber,
                    department,
                    email,
                    password
                })
            });
            showMessage("Account created successfully. Please log in.");
            registerForm.reset();
            setTimeout(function () {
                window.location.href = "index.html";
            }, 1000);
        } catch (error) {
            console.error("Registration failed:", error);
            showMessage(error.message || "Unable to create your account.", "error");
        }
    });
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

    setupExeatTypeSelect();

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

function setupExeatTypeSelect() {
    const wrapper = document.getElementById("exeatTypeSelect");
    const select = document.getElementById("exeatType");
    const trigger = document.getElementById("exeatTypeTrigger");
    const value = document.getElementById("exeatTypeValue");
    const options = document.getElementById("exeatTypeOptions");
    const optionItems = [...options.querySelectorAll('[role="option"]')];

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
        const openAbove = spaceBelow < menuHeight && spaceAbove > spaceBelow;
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
    select.form.addEventListener("reset", () => {
        window.setTimeout(() => {
            syncSelection();
            closeOptions();
        });
    });
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
        window.location.href = "index.html";
        return;
    }

    if (studentName) {
        studentName.textContent = currentUser.fullName;
    }
    try {
        const requests = (await request("/exeats")).map(normalizeExeat);
        updateDashboardCounts(requests);
        displayRecentRequests(requests);
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
        departure: exeat.departureDate,
        returnDate: exeat.returnDate,
        reason: exeat.reason,
        status: statusLabels[exeat.status] || exeat.status,
        createdAt: exeat.createdAt,
        adminComment: exeat.adminComment
    };
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
            <td colspan="5" style="text-align:center;">
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
    if (!allRequests) {
        return;
    }

    if (!currentUser) {
        window.location.href = "index.html";
        return;
    }

    try {
        const requests = (await request("/exeats")).map(normalizeExeat);
        displayRequestHistory(requests);
    } catch (error) {
        console.error("Could not load request history:", error);
        showMessage(error.message || "Unable to load your request history.", "error");
    }
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
            <td colspan="6" style="text-align:center;">
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