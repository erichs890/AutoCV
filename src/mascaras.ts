// Máscaras dos formulários de perfil: funções puras (string → string) + um adaptador para inputs não controlados.
import type { FormEvent } from 'react';

export const soDigitos = (v: string) => v.replace(/\D/g, '');

/** (11) 91234-5678 ou (11) 3123-4567; aceita colar com +55 na frente. */
export function mascaraTelefone(v: string): string {
  const d = soDigitos(v).replace(/^55(?=\d{10,11}$)/, '').slice(0, 11);
  if (d.length <= 2) return d ? `(${d}` : '';
  const ddd = d.slice(0, 2);
  const resto = d.slice(2);
  if (resto.length <= 4) return `(${ddd}) ${resto}`;
  const corte = resto.length > 8 ? 5 : 4; // celular com 9 dígitos ou fixo com 8
  return `(${ddd}) ${resto.slice(0, corte)}-${resto.slice(corte)}`;
}

/** R$ 4.500 (reais inteiros; o núcleo já lê este formato em pretensaoEmReais). */
export function mascaraMoeda(v: string): string {
  const d = soDigitos(v.replace(/,\d{1,2}\s*$/, '')).replace(/^0+/, '').slice(0, 9); // 'R$ 4.500,00' guardado antes da máscara → 4500
  return d ? `R$ ${Number(d).toLocaleString('pt-BR')}` : '';
}

/** 123.456.789-09 */
export function mascaraCPF(v: string): string {
  const d = soDigitos(v).slice(0, 11);
  return d.replace(/^(\d{3})(\d)/, '$1.$2').replace(/^(\d{3}\.\d{3})(\d)/, '$1.$2').replace(/^(\d{3}\.\d{3}\.\d{3})(\d)/, '$1-$2');
}

export const TELEFONE_PATTERN = '\\(\\d{2}\\) \\d{4,5}-\\d{4}';
export const CPF_PATTERN = '\\d{3}\\.\\d{3}\\.\\d{3}-\\d{2}';

/** onInput para inputs não controlados: reformata o valor no lugar. */
export const mascarar = (fn: (v: string) => string) => (e: FormEvent<HTMLInputElement>) => {
  e.currentTarget.value = fn(e.currentTarget.value);
};
