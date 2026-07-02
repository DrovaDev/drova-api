import * as bcrypt from 'bcrypt';
export async function hashPassword(password: string): Promise<string> {
  const salt_rounds = 10;
  const hashedPassword = await bcrypt.hash(password, salt_rounds);
  return hashedPassword;
}
