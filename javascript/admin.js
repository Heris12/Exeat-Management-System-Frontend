import { request } from "./api.js";
import { Auth } from "./auth.js";

// Admin dashboard script
document.addEventListener("DOMContentLoaded", function () {
    verifyAdminAccess();
});

async function verifyAdminAccess() {
    const token = localStorage.getItem("token");
    if (!token) {
        redirectToLogin();
        return;
    }

    try {
        const response = await request("/auth/me");
        const user = response.user;
        if (!user || user.role !== "admin") {
            redirectToLogin();
            return;
        }

        localStorage.setItem("currentUser", JSON.stringify(user));
        document.body.style.visibility = "visible";
        setupSidebar();
        setupAdminDashboard(user);
    } catch (error) {
        console.error("Could not verify administrator access:", error);
        redirectToLogin();
    }
}

function setupResponsiveFilter(selectId, openDown = false) {
    const select = document.getElementById(selectId);
    if (!select) return;

    const wrapper = document.getElementById(`${selectId}Select`);
    const trigger = document.getElementById(`${selectId}Trigger`);
    const value = document.getElementById(`${selectId}Value`);
    const options = document.getElementById(`${selectId}Options`);
    if (!wrapper || !trigger || !value || !options) return;

    const optionItems = [...options.querySelectorAll('[role="option"]')];
    if (optionItems.length === 0) return;

    function syncSelection() {
        const selectedOption = [...select.options].find((option) => option.value === select.value);
        value.textContent = selectedOption ? selectedOption.textContent : "";
        optionItems.forEach((option) => {
            option.setAttribute("aria-selected", String(option.dataset.value === select.value));
        });
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
        const bounds = trigger.getBoundingClientRect();
        const viewport = window.visualViewport;
        const viewportTop = viewport?.offsetTop || 0;
        const viewportBottom = viewportTop + (viewport?.height || window.innerHeight);
        const spaceBelow = viewportBottom - bounds.bottom;
        const spaceAbove = bounds.top - viewportTop;
        const openAbove = !openDown && spaceBelow < options.scrollHeight && spaceAbove > spaceBelow;
        const availableSpace = Math.max(0, (openAbove ? spaceAbove : spaceBelow) - 12);

        wrapper.classList.toggle("custom-select--open-up", openAbove);
        wrapper.style.setProperty("--custom-select-max-height", `${availableSpace}px`);
        trigger.setAttribute("aria-expanded", "true");
    }

    function openOptions() {
        positionOptions();
        const selectedOption = options.querySelector('[aria-selected="true"]') || optionItems[0];
        if (selectedOption) {
            selectedOption.focus();
        }
    }

    trigger.addEventListener("click", () => {
        if (options.hidden) openOptions();
        else closeOptions();
    });
    trigger.addEventListener("keydown", (event) => {
        if (["ArrowDown", "ArrowUp", "Enter", " "].includes(event.key)) {
            event.preventDefault();
            if (options.hidden) openOptions();
        }
    });
    options.addEventListener("click", (event) => {
        const option = event.target.closest('[role="option"]');
        if (!option) return;

        select.value = option.dataset.value;
        select.dispatchEvent(new Event("change", { bubbles: true }));
        closeOptions(true);
    });
    options.addEventListener("keydown", (event) => {
        const index = optionItems.indexOf(document.activeElement);
        let nextIndex = index;

        if (event.key === "ArrowDown") nextIndex = (index + 1) % optionItems.length;
        else if (event.key === "ArrowUp") nextIndex = (index - 1 + optionItems.length) % optionItems.length;
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
        } else return;

        event.preventDefault();
        optionItems[nextIndex].focus();
    });
    document.addEventListener("click", (event) => {
        if (!wrapper.contains(event.target)) closeOptions();
    });
    wrapper.addEventListener("focusout", (event) => {
        if (!wrapper.contains(event.relatedTarget)) closeOptions();
    });
    select.addEventListener("change", syncSelection);

    function repositionOpenOptions() {
        if (!options.hidden) positionOptions();
    }

    window.addEventListener("resize", repositionOpenOptions);
    window.addEventListener("scroll", repositionOpenOptions, true);
    window.visualViewport?.addEventListener("resize", repositionOpenOptions);
    window.visualViewport?.addEventListener("scroll", repositionOpenOptions);
    syncSelection();
}

function redirectToLogin() {
    localStorage.removeItem("token");
    localStorage.removeItem("currentUser");
    window.location.replace("index.html?error=admin-access");
}

// Admin dashboard setup
async function setupAdminDashboard(currentUser) {
    const requestsTable = document.getElementById("requestsTable");
    const studentsTable = document.getElementById("studentsTable");
    if (!requestsTable || !studentsTable) {
        return;
    }

    const elements = {
        adminName: document.getElementById("adminName"),
        studentsCount: document.getElementById("studentsCount"),
        wardensCount: document.getElementById("wardensCount"),
        securityCount: document.getElementById("securityCount"),
        totalCount: document.getElementById("totalCount"),
        pendingCount: document.getElementById("pendingCount"),
        approvedCount: document.getElementById("approvedCount"),
        rejectedCount: document.getElementById("rejectedCount"),
        searchInput: document.getElementById("searchInput"),
        studentSearchInput: document.getElementById("studentSearchInput"),
        statusFilter: document.getElementById("statusFilter"),
        hostelFilter: document.getElementById("hostelFilter"),
        clearExeatsBtn: document.getElementById("clearExeatsBtn"),
        deleteConfirmModal: document.getElementById("deleteConfirmModal"),
        deleteConfirmDialog: document.querySelector("#deleteConfirmModal [role='alertdialog']"),
        deleteConfirmDescription: document.getElementById("deleteConfirmDescription"),
        cancelDelete: document.getElementById("cancelDelete"),
        confirmDelete: document.getElementById("confirmDelete"),
        modal: document.getElementById("reviewModal"),
        modalTitle: document.getElementById("modalTitle"),
        modalDescription: document.getElementById("modalDescription"),
        adminComment: document.getElementById("adminComment"),
        cancelModal: document.getElementById("cancelModal"),
        confirmReview: document.getElementById("confirmReview"),
        toast: document.getElementById("toast")
    };
    setupResponsiveFilter("statusFilter", true);
    setupResponsiveFilter("hostelFilter", true);
    
    let users;
    let requests;
    let dashboardStats;
    let selectedRequestId = null;
    let nextReviewStatus = null;
    let toastTimer;

    try {
        const results = await Promise.all([
            request("/admin/students"),
            request("/admin/requests"),
            request("/admin/stats")
        ]);
        users = results[0].users.map(function (user) {
            return Object.assign({}, user, {
                matricNumber: user.matriculationNumber
            });
        });
        requests = results[1].exeats.map(normalizeAdminExeat);
        dashboardStats = results[2].stats;
    } catch (error) {
        console.error("Could not load admin dashboard data.", error);
        if (error.status === 401 || error.status === 403) {
            localStorage.removeItem("token");
            localStorage.removeItem("currentUser");
            window.location.href = "index.html";
            return;
        }
        showToast(error.message || "Could not load dashboard data from the server.", "error");
        return;
    }

    // Display the admin's name in the dashboard header
    if (elements.adminName && currentUser && currentUser.fullName) {
        elements.adminName.textContent = currentUser.fullName;
    }

    function render() {
        renderCounts();
        renderStudents();
        renderRequests();
    }

    function renderCounts() {
        if (!dashboardStats) {
            return;
        }

        const counts = {
            studentsCount: dashboardStats.students,
            wardensCount: dashboardStats.wardens,
            securityCount: dashboardStats.security,
            totalCount: dashboardStats.totalRequests,
            pendingCount: dashboardStats.pending,
            approvedCount: dashboardStats.approved,
            rejectedCount: dashboardStats.rejected
        };

        Object.keys(counts).forEach(function (key) {
            if (elements[key]) {
                elements[key].textContent = counts[key];
            }
        });
    }

    function countRequests(status) {
        return requests.filter(function (request) {
            return request.status === status;
        }).length;
    }

    function renderStudents() {
        studentsTable.replaceChildren();
        if (users.length === 0) {
            appendEmptyRow(studentsTable, 6, "No registered students found.");
            return;
        }

        const query = elements.studentSearchInput
            ? elements.studentSearchInput.value.trim().toLowerCase()
            : "";
        const visibleStudents = users.filter(function (user) {
            return [
                user.fullName,
                user.matricNumber,
                user.department,
                user.email,
                user.hostel
            ].some(function (value) {
                return String(value || "").toLowerCase().includes(query);
            });
        });
        if (visibleStudents.length === 0) {
            appendEmptyRow(studentsTable, 6, "No students match your search.");
            return;
        }

        visibleStudents.forEach(function (user) {
            const row = document.createElement("tr");
            appendTextCell(row, user.fullName);
            appendTextCell(row, user.matricNumber);
            appendTextCell(row, user.department);
            appendTextCell(row, user.email);
            appendTextCell(row, user.hostel || "Not assigned");
            appendTextCell(row, formatDate(user.createdAt));
            studentsTable.appendChild(row);
        });
    }

    function renderRequests() {
        const query = elements.searchInput
            ? elements.searchInput.value.trim().toLowerCase()
            : "";
        const selectedStatus = elements.statusFilter
            ? elements.statusFilter.value
            : "All";
        const selectedHostel = elements.hostelFilter
            ? elements.hostelFilter.value
            : "All";
        const visibleRequests = requests.filter(function (request) {
            const matchesStatus = selectedStatus === "All" ||
                request.status === selectedStatus;
            const matchesHostel = selectedHostel === "All" ||
                request.hostel === selectedHostel;
            const searchableText = [
                request.studentName,
                request.matricNumber,
                request.type,
                request.destination,
                request.hostel,
                request.reason
            ].join(" ").toLowerCase();

            return matchesStatus && matchesHostel && searchableText.includes(query);
        });

        requestsTable.replaceChildren();
        if (visibleRequests.length === 0) {
            appendEmptyRow(requestsTable, 10, "No matching exeat requests found.");
            return;
        }

        visibleRequests.forEach(function (request) {
            const row = document.createElement("tr");
            appendTextCell(row, request.studentName);
            appendTextCell(row, request.matricNumber);
            appendTextCell(row, request.type);
            appendTextCell(row, request.destination);
            appendTextCell(row, request.hostel || "—");
            appendTextCell(row, formatDate(request.departure));
            appendTextCell(row, formatDate(request.returnDate));
            appendTextCell(row, request.reason);
            appendStatusCell(row, request.status);
            appendActionsCell(row, request);
            requestsTable.appendChild(row);
        });
    }

    function appendActionsCell(row, request) {
        const cell = document.createElement("td");
        const actions = document.createElement("div");
        actions.className = "actions";

        if (request.status === "Pending") {
            actions.appendChild(createReviewButton(request, "Approved"));
            actions.appendChild(createReviewButton(request, "Rejected"));
        } else if (request.adminComment) {
            const comment = document.createElement("span");
            comment.textContent = request.adminComment;
            comment.title = request.adminComment;
            cell.appendChild(comment);
        } else {
            cell.textContent = "Reviewed";
        }

        if (actions.childElementCount > 0) {
            cell.appendChild(actions);
        }
        row.appendChild(cell);
    }

    function createReviewButton(request, status) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "btn " + (status === "Approved" ? "approve" : "reject");
        button.dataset.requestId = String(request.id);
        button.dataset.reviewStatus = status;
        button.textContent = status === "Approved" ? "Approve" : "Reject";
        button.setAttribute("aria-label", button.textContent + " request from " + (request.studentName || "student"));
        return button;
    }

    function appendStatusCell(row, status) {
        const cell = document.createElement("td");
        const badge = document.createElement("span");
        const normalizedStatus = String(status || "Unknown").toLowerCase();
        badge.className = "status " + normalizedStatus;
        badge.textContent = status || "Unknown";
        cell.appendChild(badge);
        row.appendChild(cell);
    }

    function appendTextCell(row, value) {
        const cell = document.createElement("td");
        cell.textContent = value === null || value === undefined ? "" : String(value);
        row.appendChild(cell);
    }

    function appendEmptyRow(tableBody, columnCount, message) {
        const row = document.createElement("tr");
        const cell = document.createElement("td");
        cell.colSpan = columnCount;
        cell.className = "empty";
        cell.textContent = message;
        row.appendChild(cell);
        tableBody.appendChild(row);
    }

    function openReview(requestId, status) {
        const request = requests.find(function (item) {
            return String(item.id) === requestId;
        });
        if (!request || request.status !== "Pending") {
            showToast("This request is no longer pending.", "error");
            render();
            return;
        }

        selectedRequestId = requestId;
        nextReviewStatus = status;
        if (elements.modalTitle) {
            elements.modalTitle.textContent = status === "Approved"
                ? "Approve Exeat Request"
                : "Reject Exeat Request";
        }
        if (elements.modalDescription) {
            elements.modalDescription.textContent =
                (request.studentName || "Student") + " — " +
                (request.type || "Exeat") + " to " +
                (request.destination || "unspecified destination");
        }
        if (elements.adminComment) {
            elements.adminComment.value = request.adminComment || "";
        }
        if (elements.confirmReview) {
            elements.confirmReview.textContent = status === "Approved" ? "Approve" : "Reject";
            elements.confirmReview.classList.toggle("reject", status === "Rejected");
            elements.confirmReview.classList.toggle("approve", status === "Approved");
        }
        if (elements.modal) {
            elements.modal.classList.add("show");
            elements.modal.setAttribute("aria-modal", "true");
            elements.modal.setAttribute("role", "dialog");
        }
        if (elements.adminComment) {
            elements.adminComment.focus();
        }
    }

    function closeReview() {
        if (elements.modal) {
            elements.modal.classList.remove("show");
            elements.modal.removeAttribute("aria-modal");
            elements.modal.removeAttribute("role");
        }
        selectedRequestId = null;
        nextReviewStatus = null;
    }

    async function confirmRequestReview() {
        const requestId = selectedRequestId;
        const reviewStatus = nextReviewStatus;
        const adminComment = elements.adminComment.value.trim();
        const requestIndex = requests.findIndex(function (request) {
            return String(request.id) === requestId;
        });
        if (
            requestIndex < 0 ||
            !["Approved", "Rejected"].includes(reviewStatus)
        ) {
            closeReview();
            showToast("The selected request could not be found.", "error");
            render();
            return;
        }

        try {
            await request("/admin/requests/" + encodeURIComponent(requestId), {
                method: "PATCH",
                body: JSON.stringify({
                    status: reviewStatus.toLowerCase(),
                    adminComment
                })
            });
        } catch (error) {
            console.error("Could not save the request review.", error);
            if (error.status === 401 || error.status === 403) {
                localStorage.removeItem("token");
                localStorage.removeItem("currentUser");
                window.location.href = "index.html";
                return;
            }
            showToast(error.message || "Could not save your review. Please try again.", "error");
            return;
        }

        const previousStatus = requests[requestIndex].status.toLowerCase();
        const newStatus = reviewStatus.toLowerCase();
        if (dashboardStats && previousStatus !== newStatus) {
            if (typeof dashboardStats[previousStatus] === "number") {
                dashboardStats[previousStatus] -= 1;
            }
            if (typeof dashboardStats[newStatus] === "number") {
                dashboardStats[newStatus] += 1;
            }
        }
        requests[requestIndex] = Object.assign({}, requests[requestIndex], {
            status: reviewStatus,
            adminComment,
            reviewedAt: new Date().toISOString()
        });
        closeReview();
        render();
        showToast("Request " + reviewStatus.toLowerCase() + ".", "success");
    }

    function showToast(message, type) {
        const toast = elements.toast;
        if (!toast) {
            console.error(message);
            return;
        }
        window.clearTimeout(toastTimer);
        toast.textContent = message;
        toast.className = "toast show " + type;
        toastTimer = window.setTimeout(function () {
            toast.className = "toast";
        }, 3500);
    }

    requestsTable.addEventListener("click", function (event) {
        const button = event.target.closest("button[data-request-id]");
        if (!button || !requestsTable.contains(button)) {
            return;
        }
        openReview(button.dataset.requestId, button.dataset.reviewStatus);
    });

    if (elements.searchInput) {
        elements.searchInput.addEventListener("input", renderRequests);
    }
    if (elements.studentSearchInput) {
        elements.studentSearchInput.addEventListener("input", renderStudents);
    }
    if (elements.statusFilter) {
        elements.statusFilter.addEventListener("change", renderRequests);
    }
    if (elements.hostelFilter) {
        elements.hostelFilter.addEventListener("change", renderRequests);
    }
    if (elements.clearExeatsBtn) {
        elements.clearExeatsBtn.addEventListener("click", clearAllExeats);
    }
    if (elements.cancelDelete) {
        elements.cancelDelete.addEventListener("click", closeDeleteConfirmation);
    }
    if (elements.confirmDelete) {
        elements.confirmDelete.addEventListener("click", confirmDeleteAllExeats);
    }
    if (elements.deleteConfirmModal) {
        elements.deleteConfirmModal.addEventListener("click", function (event) {
            if (event.target === elements.deleteConfirmModal) {
                closeDeleteConfirmation();
            }
        });
    }
    if (elements.cancelModal) {
        elements.cancelModal.addEventListener("click", closeReview);
    }
    if (elements.confirmReview) {
        elements.confirmReview.addEventListener("click", confirmRequestReview);
    }
    if (elements.modal) {
        elements.modal.addEventListener("click", function (event) {
            if (event.target === elements.modal) {
                closeReview();
            }
        });
    }
    document.addEventListener("keydown", function (event) {
        if (event.key !== "Escape") {
            return;
        }
        if (elements.deleteConfirmModal && elements.deleteConfirmModal.classList.contains("show")) {
            closeDeleteConfirmation();
            return;
        }
        if (elements.modal && elements.modal.classList.contains("show")) {
            closeReview();
        }
    });

    render();
    if (sessionStorage.getItem("loginSuccessMessage") === "true") {
        sessionStorage.removeItem("loginSuccessMessage");
        showToast(`Welcome, ${currentUser.fullName || "Admin"}! You are now logged in.`, "success");
    }

    async function clearAllExeats() {
        if (!requests || requests.length === 0) {
            showToast("There are no exeat requests to delete.", "error");
            return;
        }
        if (elements.deleteConfirmDescription) {
            elements.deleteConfirmDescription.textContent =
                `Are you sure you want to permanently delete all ${requests.length} exeat requests? This action cannot be undone.`;
        }
        if (elements.deleteConfirmModal) {
            elements.deleteConfirmModal.classList.add("show");
        }
        if (elements.deleteConfirmDialog) {
            elements.deleteConfirmDialog.setAttribute("aria-modal", "true");
        }
        if (elements.cancelDelete) {
            elements.cancelDelete.focus();
        }
    }

    function closeDeleteConfirmation() {
        if (elements.deleteConfirmModal) {
            elements.deleteConfirmModal.classList.remove("show");
        }
        if (elements.deleteConfirmDialog) {
            elements.deleteConfirmDialog.removeAttribute("aria-modal");
        }
        if (elements.clearExeatsBtn) {
            elements.clearExeatsBtn.focus();
        }
    }

    async function confirmDeleteAllExeats() {
        closeDeleteConfirmation();
        if (elements.clearExeatsBtn) {
            elements.clearExeatsBtn.disabled = true;
        }
        try {
            const result = await request("/admin/exeats", { method: "DELETE" });
            requests = [];
            if (dashboardStats) {
                dashboardStats.totalRequests = 0;
                dashboardStats.pending = 0;
                dashboardStats.approved = 0;
                dashboardStats.rejected = 0;
            }
            closeReview();
            render();
            showToast(`${result.deletedCount} exeat requests deleted.`, "success");
        } catch (error) {
            console.error("Could not delete all exeat requests.", error);
            if (error.status === 401 || error.status === 403) {
                redirectToLogin();
                return;
            }
            showToast(error.message || "Could not delete exeat requests. Please try again.", "error");
        } finally {
            if (elements.clearExeatsBtn) {
                elements.clearExeatsBtn.disabled = false;
            }
        }
    }
}

function normalizeAdminExeat(exeat) {
    const student = exeat && exeat.student ? exeat.student : {};
    const typeLabels = {
        day: "Day Exeat",
        weekend: "Weekend Exeat",
        long: "Emergency Exeat"
    };
    const rawStatus = typeof exeat?.status === "string" ? exeat.status : "pending";
    return {
        id: exeat?._id,
        studentName: student.fullName,
        matricNumber: student.matriculationNumber,
        type: typeLabels[exeat?.exeatType] || exeat?.exeatType || "Exeat",
        destination: exeat?.destination || "",
        hostel: exeat?.hostel || "",
        departure: String(exeat?.departureDate || "").slice(0, 10),
        returnDate: String(exeat?.returnDate || "").slice(0, 10),
        reason: exeat?.reason || "",
        status: rawStatus.charAt(0).toUpperCase() + rawStatus.slice(1),
        adminComment: exeat?.adminComment || "",
        createdAt: exeat?.createdAt || null
    };
}

function readCurrentUser() {
    const value = localStorage.getItem("currentUser");
    return value === null ? null : JSON.parse(value);
}

function formatDate(dateString) {
    if (!dateString) {
        return "—";
    }
    const date = new Date(dateString.length === 10 ? dateString + "T00:00:00" : dateString);
    return Number.isNaN(date.getTime())
        ? String(dateString)
        : date.toLocaleDateString("en-NG", {
            day: "2-digit",
            month: "short",
            year: "numeric"
        });
}

function logout() {
    return Auth.logout();
}

function setupSidebar() {
    const menuIcon = document.getElementById("menu-icon");
    const closeIcon = document.getElementById("close-icon");
    const sidebar = document.getElementById("sidebar");
    if (!menuIcon || !closeIcon || !sidebar) {
        return;
    }

    function closeMenu() {
        sidebar.classList.remove("active");
        document.querySelector(".dashboard")?.classList.remove("sidebar-open");
        menuIcon.setAttribute("aria-expanded", "false");
    }

    menuIcon.addEventListener("click", function () {
        if (sidebar.classList.contains("active")) {
            closeMenu();
        } else {
            sidebar.classList.add("active");
            document.querySelector(".dashboard")?.classList.add("sidebar-open");
            menuIcon.setAttribute("aria-expanded", "true");
            closeIcon.focus();
        }
    });
    closeIcon.addEventListener("click", closeMenu);
    const logoutBtn = document.getElementById("logoutBtn");
    if (logoutBtn) {
        logoutBtn.addEventListener("click", function (event) {
            event.preventDefault();
            logout();
        });
    }
    sidebar.querySelectorAll("a").forEach(function (link) {
        link.addEventListener("click", closeMenu);
    });
    const dashboard = document.querySelector(".dashboard");
    if (dashboard) {
        dashboard.addEventListener("click", function (event) {
            if (event.target === dashboard && sidebar.classList.contains("active")) {
                closeMenu();
            }
        });
    }
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
}
