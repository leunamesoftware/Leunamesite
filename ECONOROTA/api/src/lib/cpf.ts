/** CPF: só dígitos e dígitos verificadores válidos (rejeita sequências como 111.111.111-11). */
export function normalizeCpf(input: unknown): string | null {
  if (typeof input !== 'string') return null;
  const d = input.replace(/\D/g, '');
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return null;
  const dv = (len: number) => {
    let sum = 0;
    for (let i = 0; i < len; i++) sum += Number(d[i]) * (len + 1 - i);
    const r = (sum * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return dv(9) === Number(d[9]) && dv(10) === Number(d[10]) ? d : null;
}

export const maskCpf = (cpf: string) => `***.${cpf.slice(3, 6)}.${cpf.slice(6, 9)}-**`;
