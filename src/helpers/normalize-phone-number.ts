export function normalizePhoneNumber(phone: string): string {
  if (phone.startsWith('0')) {
    return `+234${phone.slice(1)}`;
  } else if (phone.startsWith('234')) {
    return `+${phone}`;
  } else if (!phone.startsWith('+234')) {
    return `+234${phone}`;
  }
  return phone;
}
