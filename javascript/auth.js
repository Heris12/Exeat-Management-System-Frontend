import { request } from "./api.js?v=20261101-exeat-slip";

const TOKEN_KEY = "token";
const LOGIN_PAGE = "index.html";

export const Auth = {
    user: null,

    async init(allowGuest = false) {
        const token = localStorage.getItem(TOKEN_KEY);

        if (!token) {
            Auth.user = null;
            if (!allowGuest) {
                window.location.href = LOGIN_PAGE;
                return null;
            } 
        }

        try {
                const response = await request("/auth/me", {
                    method: "GET"
                });

                const payload = response.user ?? response.data ?? null;
                Auth.user = payload;
                return Auth.user;
            } catch (error) {
                console.error("Error fetching user data:", error);
                const status = error?.status ?? error?.response?.status;
                if (status === 401 || status === 403) {
                    localStorage.removeItem(TOKEN_KEY);
                }

                Auth.user = null;
                if (!allowGuest) {
                    Auth.redirectToLogin();
                }
                return null;
            }
    },

    async login(identifier, password) {
        try {
            const response = await request("/auth/login", {
                method: "POST",
                body: JSON.stringify({ identifier, password })
            });

            const payload = response.data ?? response;
            const token = payload.token;
            if (token) {
                localStorage.setItem(TOKEN_KEY, token);
            }

            Auth.user = payload.user ?? null;
            return Auth.user;
        } catch (error) {
            console.error("Error logging in:", error);
            throw error;
        }
    },

    async logout() {
        try {
            await request("/auth/logout", { method: "POST" });
        } catch (error) {
            console.error("Could not clear the server login session:", error);
        }
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem("currentUser");
        Auth.user = null;
        window.location.replace(LOGIN_PAGE);
    },

    isAuthenticated() {
        return Auth.user !== null;
    },

    redirectToLogin() {
        window.location.href = LOGIN_PAGE;
    }
};