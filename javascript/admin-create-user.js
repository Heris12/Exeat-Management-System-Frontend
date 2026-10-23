import { request } from "./api.js";
import { Auth } from "./auth.js";

document.addEventListener("DOMContentLoaded", verifyAdminAccess);

async function verifyAdminAccess() {
    if (!localStorage.getItem("token")) {
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
        document.getElementById("adminName").textContent = user.fullName;
        document.body.style.visibility = "visible";
        setupSidebar();
        setupCreateUserForm();
    } catch (error) {
        console.error("Could not verify administrator access:", error);
        redirectToLogin();
    }
}

function redirectToLogin() {
    localStorage.removeItem("token");
    localStorage.removeItem("currentUser");
    window.location.replace("index.html?error=admin-access");
}

function setupCreateUserForm() {
    const form = document.getElementById("createUserForm");
    const role = document.getElementById("role");
    const roleSelect = document.getElementById("roleSelect");
    const roleTrigger = document.getElementById("roleTrigger");
    const roleValue = document.getElementById("roleValue");
    const roleOptions = document.getElementById("roleOptions");
    if (!form || !role || !roleSelect || !roleTrigger || !roleValue || !roleOptions) {
        return;
    }
    const roleOptionItems = [...roleOptions.querySelectorAll('[role="option"]')];
    if (roleOptionItems.length === 0) {
        return;
    }
    const studentFields = document.getElementById("studentFields");
    const matriculationNumber = document.getElementById("matriculationNumber");
    const department = document.getElementById("department");
    const submitButton = document.getElementById("createUserButton");
    const message = document.getElementById("formMessage");
    if (!studentFields || !matriculationNumber || !department || !submitButton || !message) {
        return;
    }

    function updateRoleFields() {
        const isStudent = role.value === "student";
        if (studentFields) {
            studentFields.hidden = !isStudent;
        }
        if (matriculationNumber) {
            matriculationNumber.required = isStudent;
            matriculationNumber.disabled = !isStudent;
        }
        if (department) {
            department.required = isStudent;
            department.disabled = !isStudent;
        }
    }

    function syncRoleSelector() {
        const selectedOption = roleOptions.querySelector(`[data-value="${role.value}"]`);
        roleValue.textContent = selectedOption.textContent;
        roleOptionItems.forEach((option) => {
            option.setAttribute("aria-selected", String(option === selectedOption));
        });
    }

    function closeRoleOptions(returnFocus = false) {
        roleOptions.hidden = true;
        roleTrigger.setAttribute("aria-expanded", "false");
        roleSelect.classList.remove("custom-select--open-up");
        roleSelect.style.removeProperty("--custom-select-max-height");
        if (returnFocus) roleTrigger.focus();
    }

    function positionRoleOptions() {
        roleOptions.hidden = false;
        const triggerBounds = roleTrigger.getBoundingClientRect();
        const menuHeight = roleOptions.scrollHeight;
        const viewport = window.visualViewport;
        const viewportTop = viewport?.offsetTop || 0;
        const viewportBottom = viewportTop + (viewport?.height || window.innerHeight);
        const spaceBelow = viewportBottom - triggerBounds.bottom;
        const spaceAbove = triggerBounds.top - viewportTop;
        const openAbove = spaceBelow < menuHeight && spaceAbove > spaceBelow;
        const availableSpace = Math.max(0, (openAbove ? spaceAbove : spaceBelow) - 12);

        roleSelect.classList.toggle("custom-select--open-up", openAbove);
        roleSelect.style.setProperty("--custom-select-max-height", `${availableSpace}px`);
        roleTrigger.setAttribute("aria-expanded", "true");
    }

    function openRoleOptions() {
        positionRoleOptions();
        roleOptions.querySelector('[aria-selected="true"]').focus();
    }

    role.addEventListener("change", () => {
        syncRoleSelector();
        updateRoleFields();
    });
    roleTrigger.addEventListener("click", () => {
        if (roleOptions.hidden) openRoleOptions();
        else closeRoleOptions();
    });
    roleOptions.addEventListener("click", (event) => {
        const option = event.target.closest('[role="option"]');
        if (!option) return;

        role.value = option.dataset.value;
        role.dispatchEvent(new Event("change", { bubbles: true }));
        closeRoleOptions(true);
    });
    roleTrigger.addEventListener("keydown", (event) => {
        if (event.key === "ArrowDown" || event.key === "ArrowUp" || event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            if (roleOptions.hidden) openRoleOptions();
        }
    });
    roleOptions.addEventListener("keydown", (event) => {
        const optionIndex = roleOptionItems.indexOf(document.activeElement);
        let nextIndex = optionIndex;

        if (event.key === "ArrowDown") nextIndex = (optionIndex + 1) % roleOptionItems.length;
        else if (event.key === "ArrowUp") nextIndex = (optionIndex - 1 + roleOptionItems.length) % roleOptionItems.length;
        else if (event.key === "Home") nextIndex = 0;
        else if (event.key === "End") nextIndex = roleOptionItems.length - 1;
        else if (event.key === "Escape") {
            event.preventDefault();
            closeRoleOptions(true);
            return;
        } else if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            document.activeElement.click();
            return;
        } else {
            return;
        }

        event.preventDefault();
        roleOptionItems[nextIndex].focus();
    });
    document.addEventListener("click", (event) => {
        if (!roleSelect.contains(event.target)) closeRoleOptions();
    });
    roleSelect.addEventListener("focusout", (event) => {
        if (!roleSelect.contains(event.relatedTarget)) closeRoleOptions();
    });
    function repositionOpenRoleOptions() {
        if (!roleOptions.hidden) positionRoleOptions();
    }

    window.addEventListener("resize", repositionOpenRoleOptions);
    window.addEventListener("scroll", repositionOpenRoleOptions, true);
    window.visualViewport?.addEventListener("resize", repositionOpenRoleOptions);
    window.visualViewport?.addEventListener("scroll", repositionOpenRoleOptions);
    form.addEventListener("reset", () => {
        window.setTimeout(syncRoleSelector);
    });
    syncRoleSelector();
    updateRoleFields();

    form.addEventListener("submit", async (event) => {
        event.preventDefault();
        message.textContent = "";
        message.className = "";
        submitButton.disabled = true;

        const body = {
            fullName: document.getElementById("fullName").value.trim(),
            email: document.getElementById("email").value.trim().toLowerCase(),
            password: document.getElementById("password").value,
            role: role.value
        };
        if (role.value === "student") {
            body.matriculationNumber = matriculationNumber.value.trim();
            body.department = department.value.trim();
        }

        try {
            const result = await request("/admin/users", {
                method: "POST",
                body: JSON.stringify(body)
            });
            form.reset();
            updateRoleFields();
            message.textContent = result.message || "User created successfully.";
            message.className = "success-message";
        } catch (error) {
            console.error("Could not create user:", error);
            if (error.status === 401 || error.status === 403) {
                redirectToLogin();
                return;
            }
            message.textContent = error.message || "Could not create user. Please try again.";
            message.className = "error-message";
        } finally {
            submitButton.disabled = false;
        }
    });
}

function setupSidebar() {
    const menuIcon = document.getElementById("menu-icon");
    const closeIcon = document.getElementById("close-icon");
    const sidebar = document.getElementById("sidebar");
    const logoutButton = document.getElementById("logoutBtn");

    function closeMenu() {
        sidebar.classList.remove("active");
        document.querySelector(".dashboard").classList.remove("sidebar-open");
        menuIcon.setAttribute("aria-expanded", "false");
    }

    menuIcon.addEventListener("click", () => {
        const isOpen = sidebar.classList.toggle("active");
        document.querySelector(".dashboard").classList.toggle("sidebar-open", isOpen);
        menuIcon.setAttribute("aria-expanded", String(isOpen));
        if (isOpen) closeIcon.focus();
    });
    closeIcon.addEventListener("click", closeMenu);
    logoutButton.addEventListener("click", async (event) => {
        event.preventDefault();
        await Auth.logout();
    });
    sidebar.querySelectorAll("a").forEach((link) => {
        link.addEventListener("click", closeMenu);
    });
    document.addEventListener("keydown", (event) => {
        if (event.key === "Escape") closeMenu();
    });
}
