export type NotificationAudience = "PARENTS" | "TEACHERS" | "BOTH" | "ADMINS";
export type NotificationLegalReference =
  | "LEY_1620_2013"
  | "DECRETO_1965_2013"
  | "LEY_115_1994"
  | "LEY_1098_2006";

export function composeNotificationBodyWithMeta(
  body: string,
  audience: NotificationAudience,
  legalReference?: NotificationLegalReference | null
) {
  const clean = stripNotificationMeta(body);
  const markers = [`[[audience:${audience}]]`];
  if (legalReference) markers.push(`[[legalRef:${legalReference}]]`);
  return `${markers.join("\n")}\n${clean}`.trim();
}

export function extractNotificationAudience(body: unknown): NotificationAudience | null {
  const text = String(body || "");
  const match = text.match(/\[\[audience:(PARENTS|TEACHERS|BOTH|ADMINS)\]\]/);
  if (!match?.[1]) return null;
  return match[1] as NotificationAudience;
}

export function extractNotificationLegalReference(body: unknown): NotificationLegalReference | null {
  const text = String(body || "");
  const match = text.match(/\[\[legalRef:(LEY_1620_2013|DECRETO_1965_2013|LEY_115_1994|LEY_1098_2006)\]\]/);
  if (!match?.[1]) return null;
  return match[1] as NotificationLegalReference;
}

export function stripNotificationMeta(body: unknown) {
  return String(body || "")
    .replace(/\[\[audience:(PARENTS|TEACHERS|BOTH|ADMINS)\]\]\s*/g, "")
    .replace(/\[\[legalRef:(LEY_1620_2013|DECRETO_1965_2013|LEY_115_1994|LEY_1098_2006)\]\]\s*/g, "")
    .trim();
}
