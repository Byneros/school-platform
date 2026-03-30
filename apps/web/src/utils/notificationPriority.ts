export type NotificationPriorityInput = {
  title?: string | null;
  body?: string | null;
  legalReference?: string | null;
};

const normalizeText = (value: string) =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

export const isDueProcessNotification = (input?: NotificationPriorityInput | null) => {
  if (!input) return false;
  const text = normalizeText(
    `${input.title ?? ""} ${input.body ?? ""} ${input.legalReference ?? ""}`
  );
  return text.includes("debido proceso");
};

export const prioritizeDueProcess = <T extends NotificationPriorityInput>(items: T[]) =>
  [...items].sort((a, b) => Number(isDueProcessNotification(b)) - Number(isDueProcessNotification(a)));
