import { request } from "./api.js?v=20261101-exeat-slip";
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
        window.dispatchEvent(new Event("app:initial-data-ready"));
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
    const facultySelect = document.getElementById("facultySelect");
    const faculty = document.getElementById("faculty");
    const facultyTrigger = document.getElementById("facultyTrigger");
    const facultyValue = document.getElementById("facultyValue");
    const facultyOptions = document.getElementById("facultyOptions");
    const hostelSelect = document.getElementById("hostelSelect");
    const hostelTrigger = document.getElementById("hostelTrigger");
    const hostelValue = document.getElementById("hostelValue");
    const hostelOptions = document.getElementById("hostelOptions");
    if (!form || !role || !roleSelect || !roleTrigger || !roleValue || !roleOptions ||
        !facultySelect || !faculty || !facultyTrigger || !facultyValue || !facultyOptions ||
        !hostelSelect || !hostelTrigger || !hostelValue || !hostelOptions) {
        return;
    }
    const roleOptionItems = [...roleOptions.querySelectorAll('[role="option"]')];
    const facultyOptionItems = [...facultyOptions.querySelectorAll('[role="option"]')];
    const hostelOptionItems = [...hostelOptions.querySelectorAll('[role="option"]')];
    if (roleOptionItems.length === 0 || facultyOptionItems.length === 0 || hostelOptionItems.length === 0) {
        return;
    }
    const studentFields = document.getElementById("studentFields");
    const hostelFields = document.getElementById("hostelFields");
    const wardenHostelHelp = document.getElementById("wardenHostelHelp");
    const hostel = document.getElementById("hostel");
    const matriculationNumber = document.getElementById("matriculationNumber");
    const department = document.getElementById("department");
    const submitButton = document.getElementById("createUserButton");
    const message = document.getElementById("formMessage");
    if (!studentFields || !hostelFields || !hostel || !matriculationNumber || !department ||
        !faculty || !submitButton || !message) {
        return;
    }

    function updateRoleFields() {
        const isStudent = role.value === "student";
        const isWardenPortal = role.value === "portal";
        const requiresHostel = isStudent || isWardenPortal;
        if (studentFields) {
            studentFields.hidden = !isStudent;
        }
        hostelFields.hidden = !requiresHostel;
        if (wardenHostelHelp) {
            wardenHostelHelp.hidden = !isWardenPortal;
        }
        hostel.required = false;
        hostel.disabled = !requiresHostel;
        hostelTrigger.disabled = !requiresHostel;
        if (!requiresHostel) {
            closeHostelOptions();
            hostelTrigger.removeAttribute("aria-invalid");
        }
        if (matriculationNumber) {
            matriculationNumber.required = isStudent;
            matriculationNumber.disabled = !isStudent;
        }
        if (department) {
            department.required = isStudent;
            department.disabled = !isStudent;
        }
        faculty.required = false;
        faculty.disabled = !isStudent;
        facultyTrigger.disabled = !isStudent;
        if (!isStudent) {
            closeFacultyOptions();
            facultyTrigger.removeAttribute("aria-invalid");
        }
    }

    function syncRoleSelector() {
        const selectedOption = roleOptions.querySelector(`[data-value="${role.value}"]`);
        roleValue.textContent = selectedOption.textContent;
        roleOptionItems.forEach((option) => {
            option.setAttribute("aria-selected", String(option === selectedOption));
        });
    }

    function syncFacultySelector() {
        const selectedOption = [...faculty.options].find((option) => option.value === faculty.value);
        facultyValue.textContent = selectedOption ? selectedOption.textContent : "Select faculty";
        facultyOptionItems.forEach((option) => {
            option.setAttribute("aria-selected", String(option.dataset.value === faculty.value));
        });
    }

    function syncHostelSelector() {
        const selectedOption = [...hostel.options].find((option) => option.value === hostel.value);
        hostelValue.textContent = selectedOption ? selectedOption.textContent : "";
        hostelOptionItems.forEach((option) => {
            option.setAttribute("aria-selected", String(option.dataset.value === hostel.value));
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

    function closeFacultyOptions(returnFocus = false) {
        facultyOptions.hidden = true;
        facultyTrigger.setAttribute("aria-expanded", "false");
        facultySelect.classList.remove("custom-select--open-up");
        facultySelect.style.removeProperty("--custom-select-max-height");
        if (returnFocus) facultyTrigger.focus();
    }

    function positionFacultyOptions() {
        facultyOptions.hidden = false;
        const triggerBounds = facultyTrigger.getBoundingClientRect();
        const menuHeight = facultyOptions.scrollHeight;
        const viewport = window.visualViewport;
        const viewportTop = viewport?.offsetTop || 0;
        const viewportBottom = viewportTop + (viewport?.height || window.innerHeight);
        const spaceBelow = viewportBottom - triggerBounds.bottom;
        const spaceAbove = triggerBounds.top - viewportTop;
        const openAbove = spaceBelow < menuHeight && spaceAbove > spaceBelow;
        const availableSpace = Math.max(0, (openAbove ? spaceAbove : spaceBelow) - 12);

        facultySelect.classList.toggle("custom-select--open-up", openAbove);
        facultySelect.style.setProperty("--custom-select-max-height", `${availableSpace}px`);
        facultyTrigger.setAttribute("aria-expanded", "true");
    }

    function openFacultyOptions() {
        positionFacultyOptions();
        const selectedOption = facultyOptions.querySelector('[aria-selected="true"]') || facultyOptionItems[0];
        if (selectedOption) selectedOption.focus();
    }

    function closeHostelOptions(returnFocus = false) {
        hostelOptions.hidden = true;
        hostelTrigger.setAttribute("aria-expanded", "false");
        hostelSelect.classList.remove("custom-select--open-up");
        hostelSelect.style.removeProperty("--custom-select-max-height");
        if (returnFocus) hostelTrigger.focus();
    }

    function positionHostelOptions() {
        hostelOptions.hidden = false;
        const triggerBounds = hostelTrigger.getBoundingClientRect();
        const viewport = window.visualViewport;
        const viewportTop = viewport?.offsetTop || 0;
        const viewportBottom = viewportTop + (viewport?.height || window.innerHeight);
        const spaceBelow = viewportBottom - triggerBounds.bottom;
        const availableSpace = Math.max(0, spaceBelow - 12);

        hostelSelect.classList.remove("custom-select--open-up");
        hostelSelect.style.setProperty("--custom-select-max-height", `${availableSpace}px`);
        hostelTrigger.setAttribute("aria-expanded", "true");
    }

    function openHostelOptions() {
        positionHostelOptions();
        const selectedOption = hostelOptions.querySelector('[aria-selected="true"]');
        if (selectedOption) selectedOption.focus();
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
    faculty.addEventListener("change", syncFacultySelector);
    facultyTrigger.addEventListener("click", () => {
        if (facultyOptions.hidden) openFacultyOptions();
        else closeFacultyOptions();
    });
    facultyOptions.addEventListener("click", (event) => {
        const option = event.target.closest('[role="option"]');
        if (!option) return;

        faculty.value = option.dataset.value;
        faculty.dispatchEvent(new Event("change", { bubbles: true }));
        facultyTrigger.removeAttribute("aria-invalid");
        closeFacultyOptions(true);
    });
    facultyTrigger.addEventListener("keydown", (event) => {
        if (event.key === "ArrowDown" || event.key === "ArrowUp" || event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            if (facultyOptions.hidden) openFacultyOptions();
        }
    });
    facultyOptions.addEventListener("keydown", (event) => {
        const optionIndex = facultyOptionItems.indexOf(document.activeElement);
        let nextIndex = optionIndex;

        if (event.key === "ArrowDown") nextIndex = (optionIndex + 1) % facultyOptionItems.length;
        else if (event.key === "ArrowUp") nextIndex = (optionIndex - 1 + facultyOptionItems.length) % facultyOptionItems.length;
        else if (event.key === "Home") nextIndex = 0;
        else if (event.key === "End") nextIndex = facultyOptionItems.length - 1;
        else if (event.key === "Escape") {
            event.preventDefault();
            closeFacultyOptions(true);
            return;
        } else if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            document.activeElement.click();
            return;
        } else {
            return;
        }

        event.preventDefault();
        facultyOptionItems[nextIndex].focus();
    });
    hostel.addEventListener("change", syncHostelSelector);
    hostelTrigger.addEventListener("click", () => {
        if (hostelOptions.hidden) openHostelOptions();
        else closeHostelOptions();
    });
    hostelOptions.addEventListener("click", (event) => {
        const option = event.target.closest('[role="option"]');
        if (!option) return;

        hostel.value = option.dataset.value;
        hostel.dispatchEvent(new Event("change", { bubbles: true }));
        hostelTrigger.removeAttribute("aria-invalid");
        closeHostelOptions(true);
    });
    hostelTrigger.addEventListener("keydown", (event) => {
        if (event.key === "ArrowDown" || event.key === "ArrowUp" || event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            if (hostelOptions.hidden) openHostelOptions();
        }
    });
    hostelOptions.addEventListener("keydown", (event) => {
        const optionIndex = hostelOptionItems.indexOf(document.activeElement);
        let nextIndex = optionIndex;

        if (event.key === "ArrowDown") nextIndex = (optionIndex + 1) % hostelOptionItems.length;
        else if (event.key === "ArrowUp") nextIndex = (optionIndex - 1 + hostelOptionItems.length) % hostelOptionItems.length;
        else if (event.key === "Home") nextIndex = 0;
        else if (event.key === "End") nextIndex = hostelOptionItems.length - 1;
        else if (event.key === "Escape") {
            event.preventDefault();
            closeHostelOptions(true);
            return;
        } else if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            document.activeElement.click();
            return;
        } else {
            return;
        }

        event.preventDefault();
        hostelOptionItems[nextIndex].focus();
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
        if (!facultySelect.contains(event.target)) closeFacultyOptions();
        if (!hostelSelect.contains(event.target)) closeHostelOptions();
    });
    roleSelect.addEventListener("focusout", (event) => {
        if (!roleSelect.contains(event.relatedTarget)) closeRoleOptions();
    });
    facultySelect.addEventListener("focusout", (event) => {
        if (!facultySelect.contains(event.relatedTarget)) closeFacultyOptions();
    });
    hostelSelect.addEventListener("focusout", (event) => {
        if (!hostelSelect.contains(event.relatedTarget)) closeHostelOptions();
    });
    function repositionOpenRoleOptions() {
        if (!roleOptions.hidden) positionRoleOptions();
    }

    function repositionOpenFacultyOptions() {
        if (!facultyOptions.hidden) positionFacultyOptions();
    }

    function repositionOpenHostelOptions() {
        if (!hostelOptions.hidden) positionHostelOptions();
    }

    window.addEventListener("resize", repositionOpenRoleOptions);
    window.addEventListener("scroll", repositionOpenRoleOptions, true);
    window.addEventListener("resize", repositionOpenFacultyOptions);
    window.addEventListener("scroll", repositionOpenFacultyOptions, true);
    window.addEventListener("resize", repositionOpenHostelOptions);
    window.addEventListener("scroll", repositionOpenHostelOptions, true);
    window.visualViewport?.addEventListener("resize", repositionOpenRoleOptions);
    window.visualViewport?.addEventListener("scroll", repositionOpenRoleOptions);
    window.visualViewport?.addEventListener("resize", repositionOpenFacultyOptions);
    window.visualViewport?.addEventListener("scroll", repositionOpenFacultyOptions);
    window.visualViewport?.addEventListener("resize", repositionOpenHostelOptions);
    window.visualViewport?.addEventListener("scroll", repositionOpenHostelOptions);
    form.addEventListener("reset", () => {
        window.setTimeout(() => {
            syncRoleSelector();
            syncFacultySelector();
            syncHostelSelector();
            facultyTrigger.removeAttribute("aria-invalid");
            hostelTrigger.removeAttribute("aria-invalid");
        });
    });
    syncRoleSelector();
    syncFacultySelector();
    syncHostelSelector();
    updateRoleFields();

    form.addEventListener("submit", async (event) => {
        event.preventDefault();
        message.textContent = "";
        message.className = "";
        if ((role.value === "student" || role.value === "portal") && !hostel.value) {
            message.textContent = "Please select an assigned hostel hall.";
            message.className = "error-message";
            hostelTrigger.setAttribute("aria-invalid", "true");
            hostelTrigger.focus();
            return;
        }
        if (role.value === "student" && !faculty.value) {
            message.textContent = "Please select a faculty.";
            message.className = "error-message";
            facultyTrigger.setAttribute("aria-invalid", "true");
            facultyTrigger.focus();
            return;
        }
        facultyTrigger.removeAttribute("aria-invalid");
        hostelTrigger.removeAttribute("aria-invalid");
        submitButton.disabled = true;

        const body = {
            fullName: document.getElementById("fullName").value.trim(),
            email: document.getElementById("email").value.trim().toLowerCase(),
            password: document.getElementById("password").value,
            role: role.value
        };
        if (role.value === "student" || role.value === "portal") {
            body.hostel = hostel.value;
        }
        if (role.value === "student") {
            body.matriculationNumber = matriculationNumber.value.trim();
            body.department = department.value.trim();
            body.faculty = faculty.value;
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
