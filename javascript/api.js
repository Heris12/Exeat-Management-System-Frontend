const API_BASE_URL = window.API_BASE_URL || (
    ["localhost", "127.0.0.1"].includes(window.location.hostname)
        ? "http://localhost:3000/api"
        : "https://exeat-management-system-backend-ew88.onrender.com/api"
);

// const API_BASE_URL = window.API_BASE_URL || "http://localhost:3000/api";

export async function request(endpoint, options = {}) {
    const headers = new Headers(options.headers);
    headers.set("Accept", "application/json");
    if (options.body != null && !headers.has("Content-Type")) {
        headers.set("Content-Type", "application/json");
    }

    const token = localStorage.getItem("token");
    if (token) {
        headers.set("Authorization", `Bearer ${token}`);
    }

    const normalizedEndpoint = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
    const response = await fetch(`${API_BASE_URL}${normalizedEndpoint}`, {
        ...options,
        headers
    });
    const contentType = response.headers.get("content-type") || "";
    const data = response.status === 204
        ? null
        : contentType.includes("application/json")
            ? await response.json()
            : await response.text();

    if (!response.ok) {
        const message = data && typeof data === "object" && data.message
            ? data.message
            : typeof data === "string" && data
                ? data
                : `Request failed with status ${response.status}`;
        const error = new Error(message);
        error.status = response.status;
        error.data = data;
        throw error;
    }

    return data;
}

export const requests = request;

export async function downloadExeatSlip(exeatId) {
    const headers = new Headers({ Accept: "application/pdf" });
    const token = localStorage.getItem("token");
    if (token) {
        headers.set("Authorization", `Bearer ${token}`);
    }

    const response = await fetch(`${API_BASE_URL}/exeats/${encodeURIComponent(exeatId)}/slip`, {
        headers
    });
    if (!response.ok) {
        const contentType = response.headers.get("content-type") || "";
        const data = contentType.includes("application/json")
            ? await response.json()
            : await response.text();
        const message = data && typeof data === "object" && data.message
            ? data.message
            : typeof data === "string" && data
                ? data
                : `Request failed with status ${response.status}`;
        throw new Error(message);
    }

    const slip = await response.blob();
    const url = URL.createObjectURL(slip);
    const link = document.createElement("a");
    link.href = url;
    link.download = `exeat-slip-${exeatId}.pdf`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, (character) => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    })[character]);
}
