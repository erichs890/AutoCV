// Classificação de falhas de candidatura (função pura, verificada em self-check.ts).
//
// Sem isto, qualquer soluço — o InHire lento, o Edge que morreu, o form-app que ficou em branco — condenava a vaga
// a `erro` para sempre e o usuário precisava reenfileirar na mão. Com isto, falha de infraestrutura volta para a
// fila com espera crescente; falha de conteúdo (captcha, vaga encerrada, campo que o robô não sabe preencher,
// recusa do servidor) não se repete, porque repetir não muda o resultado.

/** Falhas que costumam passar sozinhas: rede, navegador, lentidão, tela que não carregou. */
export const TRANSITORIO =
  /timeout|timed out|net::|econnreset|econnrefused|etimedout|socket hang up|navegador|target (page|closed|crashed)|browser has been closed|protocol error|\b(502|503|504)\b|n[ãa]o carregou|ficou em branco|sem confirma[çc][ãa]o|n[ãa]o avan[çc]ou|n[ãa]o apareceu|n[ãa]o mostrou/i;

/** Falhas de conteúdo: tentar de novo dá exatamente o mesmo resultado (e algumas seriam perigosas de repetir). */
export const PERMANENTE =
  /captcha|encerrada|n[ãa]o sei preencher|n[ãa]o existe em|perfil ou curr[ií]culo|sem adapter|recusou o envio|candidatar duas vezes|layout mudou|s[óo] anexa o curr[ií]culo|revise manualmente/i;

/** true = vale devolver à fila com espera; false = desistir e deixar em `erro` para o usuário decidir. */
export function falhaRepetivel(motivo: string): boolean {
  if (!motivo) return false;
  if (PERMANENTE.test(motivo)) return false;
  return TRANSITORIO.test(motivo);
}

export const MAX_TENTATIVAS = 3;
export const ESPERA_TENTATIVA_MIN = [2, 10, 30]; // minutos entre uma tentativa e a seguinte

export const esperaDaTentativa = (tentativa: number) => ESPERA_TENTATIVA_MIN[tentativa - 1] ?? ESPERA_TENTATIVA_MIN.at(-1)!;
