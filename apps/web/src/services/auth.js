const STORAGE_KEY = "school.auth";
export function getAuth() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw)
        return null;
    try {
        return JSON.parse(raw);
    }
    catch {
        return null;
    }
}
export function setAuth(data) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}
export function clearAuth() {
    localStorage.removeItem(STORAGE_KEY);
}
