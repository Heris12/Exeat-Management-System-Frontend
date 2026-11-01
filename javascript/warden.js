import { request } from "./api.js?v=20261101-exeat-slip";
import { Auth } from "./auth.js";

const halls = Array.from({ length: 8 }, (_, index) => `Hall ${index + 1}`);
let assignedHostel = "";
let selectedRequest = null;
let nextReviewStatus = "";
let hostelRequests = [];

document.addEventListener("DOMContentLoaded", initializeWardenPortal);

async function initializeWardenPortal() {
    const token = localStorage.getItem("token");
    if (!token) {
        redirectToLogin();
        return;
    }

    try {
        const me = await request("/auth/me");
        const warden = me.user;
        if (!warden || warden.role !== "portal" || !halls.includes(warden.hostel)) {
            redirectToLogin();
            return;
        }

        assignedHostel = warden.hostel;
        localStorage.setItem("currentUser", JSON.stringify(warden));
        document.getElementById("wardenName").textContent = warden.fullName;
        document.getElementById("wardenHostel").textContent = `${warden.hostel} Warden Portal`;
        document.getElementById("requestHostelLabel").textContent = warden.hostel;
        document.getElementById("studentHostelLabel").textContent = warden.hostel;
        setupSidebar();
        setupReviewModal();
        setupRequestFilter();
        await loadHostelData(warden.hostel);
        document.body.style.visibility = "visible";
        window.dispatchEvent(new Event("app:initial-data-ready"));
    } catch (error) {
        console.error("Could not load the warden portal:", error);
        if (error.status === 401 || error.status === 403) {
            redirectToLogin();
            return;
        }
        showMessage(error.message || "Could not load hostel portal data.", "error");
        document.body.style.visibility = "visible";
        window.dispatchEvent(new Event("app:initial-data-ready"));
    }
}

async function loadHostelData(hostel) {
    const data = await request("/warden/hostel");
    if (data.hostel !== hostel) {
        throw new Error("The assigned hostel does not match the portal data.");
    }

    document.getElementById("hostelStudentCount").textContent = data.stats.students;
    document.getElementById("hostelRequestCount").textContent = data.stats.requests;
    document.getElementById("hostelPendingCount").textContent = data.stats.pendingRequests;
    document.getElementById("hostelApprovedCount").textContent = data.stats.approvedRequests;
    document.getElementById("hostelRejectedCount").textContent = data.stats.rejectedRequests;
    renderStudents(data.students);
    hostelRequests = data.requests;
    renderRequests();
}

function setupRequestFilter() {
    const statusFilter = document.getElementById("wardenRequestStatus");
    const searchInput = document.getElementById("wardenRequestSearch");
    const wrapper = document.getElementById("wardenRequestStatusSelect");
    const trigger = document.getElementById("wardenRequestStatusTrigger");
    const value = document.getElementById("wardenRequestStatusValue");
    const options = document.getElementById("wardenRequestStatusOptions");
    if (!statusFilter || !searchInput || !wrapper || !trigger || !value || !options) return;

    const optionItems = [...options.querySelectorAll('[role="option"]')];
    if (optionItems.length === 0) return;

    function syncSelection() {
        const selectedOption = [...statusFilter.options].find((option) => option.value === statusFilter.value);
        value.textContent = selectedOption ? selectedOption.textContent : "";
        optionItems.forEach((option) => {
            option.setAttribute("aria-selected", String(option.dataset.value === statusFilter.value));
        });
    }

    function closeOptions(returnFocus = false) {
        options.hidden = true;
        trigger.setAttribute("aria-expanded", "false");
        wrapper.style.removeProperty("--custom-select-max-height");
        if (returnFocus) trigger.focus();
    }

    function positionOptions() {
        options.hidden = false;
        const bounds = trigger.getBoundingClientRect();
        const viewport = window.visualViewport;
        const viewportTop = viewport?.offsetTop || 0;
        const viewportBottom = viewportTop + (viewport?.height || window.innerHeight);
        const availableSpace = Math.max(0, viewportBottom - bounds.bottom - 12);
        wrapper.style.setProperty("--custom-select-max-height", `${availableSpace}px`);
        trigger.setAttribute("aria-expanded", "true");
    }

    function openOptions() {
        positionOptions();
        const selectedOption = options.querySelector('[aria-selected="true"]') || optionItems[0];
        selectedOption.focus();
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

        statusFilter.value = option.dataset.value;
        statusFilter.dispatchEvent(new Event("change", { bubbles: true }));
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
    statusFilter.addEventListener("change", () => {
        syncSelection();
        renderRequests();
    });
    searchInput.addEventListener("input", renderRequests);
    document.addEventListener("click", (event) => {
        if (!wrapper.contains(event.target)) closeOptions();
    });
    wrapper.addEventListener("focusout", (event) => {
        if (!wrapper.contains(event.relatedTarget)) closeOptions();
    });
    const repositionOpenOptions = () => {
        if (!options.hidden) positionOptions();
    };
    window.addEventListener("resize", repositionOpenOptions);
    window.addEventListener("scroll", repositionOpenOptions, true);
    window.visualViewport?.addEventListener("resize", repositionOpenOptions);
    window.visualViewport?.addEventListener("scroll", repositionOpenOptions);
    syncSelection();
}

function renderStudents(students) {
    const body = document.getElementById("wardenStudents");
    body.replaceChildren();
    if (students.length === 0) {
        appendEmptyRow(body, 4, "No students are assigned to this hostel yet.");
        return;
    }

    students.forEach((student) => {
        const row = document.createElement("tr");
        appendTextCell(row, student.fullName);
        appendTextCell(row, student.matriculationNumber);
        appendTextCell(row, student.department);
        appendTextCell(row, student.hostel);
        body.appendChild(row);
    });
}

function renderRequests() {
    const body = document.getElementById("wardenRequests");
    body.replaceChildren();
    const statusFilter = document.getElementById("wardenRequestStatus");
    const searchInput = document.getElementById("wardenRequestSearch");
    const selectedStatus = statusFilter ? statusFilter.value : "all";
    const query = searchInput ? searchInput.value.trim().toLowerCase() : "";
    const requests = selectedStatus === "all"
        ? hostelRequests
        : hostelRequests.filter((requestItem) => requestItem.status === selectedStatus);
    if (hostelRequests.length === 0) {
        appendEmptyRow(body, 12, "No exeat requests have been submitted for this hostel.");
        return;
    }
    const visibleRequests = requests.filter((requestItem) => {
        const student = requestItem.student || {};
        const searchableText = [
            student.fullName,
            student.matriculationNumber,
            student.department,
            requestItem.level,
            requestItem.phoneNumber,
            exeatTypeLabel(requestItem.exeatType),
            requestItem.destination,
            requestItem.reason
        ].join(" ").toLowerCase();
        return searchableText.includes(query);
    });
    if (visibleRequests.length === 0) {
        appendEmptyRow(body, 12, "No matching exeat requests found.");
        return;
    }

    visibleRequests.forEach((requestItem) => {
        const student = requestItem.student || {};
        const row = document.createElement("tr");
        appendTextCell(row, student.fullName);
        appendTextCell(row, student.matriculationNumber);
        appendTextCell(row, requestItem.level || "—");
        appendTextCell(row, requestItem.phoneNumber || "—");
        appendTextCell(row, exeatTypeLabel(requestItem.exeatType));
        appendTextCell(row, requestItem.destination);
        appendTextCell(row, formatDate(requestItem.departureDate));
        appendTextCell(row, formatDate(requestItem.returnDate));
        appendTextCell(row, requestItem.reason);
        appendStatusCell(row, requestItem.status);
        appendMovementCell(row, requestItem);
        const actionCell = document.createElement("td");
        if (requestItem.status === "pending") {
            const actions = document.createElement("div");
            actions.className = "actions";
            actions.appendChild(createReviewButton(requestItem, "approved"));
            actions.appendChild(createReviewButton(requestItem, "rejected"));
            actionCell.appendChild(actions);
        } else {
            actionCell.textContent = requestItem.adminComment || `Reviewed by ${requestItem.reviewedBy?.fullName || "warden/admin"}`;
        }
        row.appendChild(actionCell);
        body.appendChild(row);
    });
}

function createReviewButton(requestItem, status) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = status === "approved" ? "btn approve" : "btn reject";
    button.textContent = status === "approved" ? "Approve" : "Reject";
    button.setAttribute("aria-label", `${button.textContent} request from ${requestItem.student?.fullName || "student"}`);
    button.addEventListener("click", () => openReviewModal(requestItem, status));
    return button;
}

function setupReviewModal() {
    const modal = document.getElementById("wardenReviewModal");
    const cancelButton = document.getElementById("wardenCancelReview");
    const confirmButton = document.getElementById("wardenConfirmReview");
    if (!modal || !cancelButton || !confirmButton) return;

    cancelButton.addEventListener("click", closeReviewModal);
    confirmButton.addEventListener("click", confirmRequestReview);
    modal.addEventListener("click", (event) => {
        if (event.target === modal) closeReviewModal();
    });
    document.addEventListener("keydown", (event) => {
        if (event.key === "Escape" && modal.classList.contains("show")) {
            closeReviewModal();
        }
    });
}

function openReviewModal(requestItem, status) {
    const modal = document.getElementById("wardenReviewModal");
    const title = document.getElementById("wardenReviewTitle");
    const description = document.getElementById("wardenReviewDescription");
    const confirmButton = document.getElementById("wardenConfirmReview");
    if (!modal || !title || !description || !confirmButton) return;

    selectedRequest = requestItem;
    nextReviewStatus = status;
    title.textContent = status === "approved" ? "Approve Exeat Request" : "Reject Exeat Request";
    description.textContent = [
        requestItem.student?.fullName || "Student",
        exeatTypeLabel(requestItem.exeatType),
        `to ${requestItem.destination || "unspecified destination"}`
    ].join(" — ");
    confirmButton.textContent = status === "approved" ? "Approve" : "Reject";
    confirmButton.classList.toggle("approve", status === "approved");
    confirmButton.classList.toggle("reject", status === "rejected");
    modal.classList.add("show");
    modal.setAttribute("role", "dialog");
    modal.setAttribute("aria-modal", "true");
    confirmButton.focus();
}

function closeReviewModal() {
    const modal = document.getElementById("wardenReviewModal");
    if (modal) {
        modal.classList.remove("show");
        modal.removeAttribute("role");
        modal.removeAttribute("aria-modal");
    }
    selectedRequest = null;
    nextReviewStatus = "";
}

async function confirmRequestReview() {
    if (!selectedRequest || !["approved", "rejected"].includes(nextReviewStatus)) {
        closeReviewModal();
        showMessage("The selected request could not be found.", "error");
        return;
    }
    const confirmButton = document.getElementById("wardenConfirmReview");
    confirmButton.disabled = true;
    try {
        const result = await request(`/warden/requests/${encodeURIComponent(selectedRequest._id)}`, {
            method: "PATCH",
            body: JSON.stringify({ status: nextReviewStatus })
        });
        closeReviewModal();
        showMessage(result.message || "Request reviewed successfully.", "success");
        await loadHostelData(assignedHostel);
    } catch (error) {
        console.error("Could not review exeat request:", error);
        showMessage(error.message || "Could not review this request.", "error");
    } finally {
        confirmButton.disabled = false;
    }
}

function appendTextCell(row, value) {
    const cell = document.createElement("td");
    cell.textContent = value == null ? "" : String(value);
    row.appendChild(cell);
}

function appendStatusCell(row, status) {
    const cell = document.createElement("td");
    const badge = document.createElement("span");
    const normalizedStatus = String(status || "Unknown").toLowerCase();
    badge.className = `status ${normalizedStatus}`;
    badge.textContent = status || "Unknown";
    cell.appendChild(badge);
    row.appendChild(cell);
}

function appendMovementCell(row, requestItem) {
    const movementStatus = requestItem.returnConfirmedAt
        ? "Returned to school"
        : requestItem.departureConfirmedAt
            ? "Left school"
            : requestItem.status === "approved"
                ? "Awaiting departure"
                : "Not applicable";
    const status = movementStatus === "Returned to school"
        ? "returned-school"
        : movementStatus === "Left school"
            ? "left-school"
            : "pending";
    const cell = document.createElement("td");
    const badge = document.createElement("span");
    badge.className = `status ${status}`;
    badge.textContent = movementStatus;
    cell.appendChild(badge);
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

function exeatTypeLabel(type) {
    return { day: "Day Exeat", weekend: "Weekend Exeat", long: "Emergency Exeat" }[type] || type || "Exeat";
}

function formatDate(value) {
    if (!value) return "—";
    const date = new Date(value);
    return Number.isNaN(date.getTime())
        ? "—"
        : date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function showMessage(message, type) {
    const element = document.getElementById("wardenMessage");
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
