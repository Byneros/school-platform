const normalizeText = (value) => value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
export const isDueProcessNotification = (input) => {
    if (!input)
        return false;
    const text = normalizeText(`${input.title ?? ""} ${input.body ?? ""} ${input.legalReference ?? ""}`);
    return text.includes("debido proceso");
};
export const prioritizeDueProcess = (items) => [...items].sort((a, b) => Number(isDueProcessNotification(b)) - Number(isDueProcessNotification(a)));
