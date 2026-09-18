// Seletores e classificações do formulário público do InHire, centralizados (levantados em 17–18/09/2026 em
// *.inhire.app/vagas/<id>/<slug>). O motor (formulario.ts) descobre os campos no DOM em tempo real; aqui fica só o
// que é convenção da plataforma: como reconhecer os campos fixos, os botões de navegação e a confirmação.

// name= dos campos fixos → papel que o robô sabe preencher. Qualquer outro campo é "pergunta extra".
export type PapelFixo = 'nome' | 'email' | 'celular' | 'cpf' | 'linkedin' | 'pretensao' | 'pais' | 'cidade' | 'cep' | 'modelo' | 'regime' | 'indicacao' | 'curriculo' | 'termos' | 'ignorar';
export const CAMPO_FIXO: Record<string, PapelFixo> = {
  name: 'nome',
  email: 'email',
  cpf: 'cpf',
  document: 'cpf',
  phone: 'celular',
  phoneCountry: 'ignorar', // o +55 já vem preenchido
  linkedinUsername: 'linkedin',
  salaryExpectation: 'pretensao',
  country: 'pais',
  districtBr: 'cidade',
  district: 'cidade',
  locationCity: 'cidade',
  cep: 'cep',
  workModel: 'modelo', // "tem disponibilidade para o modelo X?" — a vaga já passou pelo filtro de regime do usuário
  contractType: 'regime',
  isIndication: 'indicacao',
  resume: 'curriculo',
  privacyPolicy: 'termos',
  'g-recaptcha-response': 'ignorar',
};

// Sem name= (ou com name gerado), o rótulo decide
export const ROTULO_FIXO: [RegExp, PapelFixo][] = [
  [/nome completo/i, 'nome'],
  [/^(seu )?(melhor )?e-?mail/i, 'email'],
  [/celular|telefone/i, 'celular'],
  [/^cpf\b/i, 'cpf'],
  [/linkedin/i, 'linkedin'],
  [/pretens[aã]o|expectativa salarial/i, 'pretensao'],
  [/^pa[ií]s\b/i, 'pais'],
  [/^cidade\b|sua cidade/i, 'cidade'],
  [/^cep\b/i, 'cep'],
  [/anexar curr|curr[ií]culo|resume/i, 'curriculo'],
  [/pol[ií]tica de privacidade|termos de uso|li e concordo/i, 'termos'],
];

// Botões de navegação: "próximo" muda de aba sem enviar; "final" cria a candidatura (POST com reCAPTCHA)
export const BOTAO_PROXIMO = /^(avan[çc]ar|pr[óo]xim[oa]|seguinte|continuar)$/i;
export const BOTAO_FINAL = /continuar inscri|enviar|finalizar|concluir|submit/i;

// Sinais de que o InHire aceitou a candidatura
export const SUCESSO = /candidatura (enviada|realizada|recebida|conclu)|inscri[çc][ãa]o (enviada|realizada|recebida|conclu)|recebemos (sua|a sua) (candidatura|inscri)|obrigad[oa] por se candidatar|boa sorte/i;

// Botão que abre o seletor de arquivo do currículo
export const BOTAO_ANEXAR = /anexar|upload|escolher arquivo|selecionar arquivo/i;

// Questionário sequencial ("uma pergunta por tela"). Levantado em 18/09/2026:
//  - depois de "Continuar inscrição" o InHire embute um iframe do PRÓPRIO InHire: form-app.inhire.app/form?jobId=…&formId=<typeformId>&type=subscription
//    (com talentId quando o talento já existe; com flow=returnMessageToParent no fluxo condicional, em que o questionário vem ANTES de criar o talento);
//  - em /forms/preview/<id> o mesmo questionário aparece como widget do Typeform (form.typeform.com/to/<id>, blocos com data-qa).
// A definição das perguntas vem da API pública do Typeform (schema.ts). O motor detecta o modo a cada etapa, nunca assume.
export const SEQUENCIAL = {
  frameTypeform: /form\.typeform\.com/,
  frameInHire: /form-app\.inhire\.app/,
  boasVindas: /responda as perguntas|para finalizar sua inscri/i,
  iniciar: /^(iniciar|começar|comecar|start|responder|vamos)/i,
  proximo: /^(ok|próximo|proximo|avançar|avancar|next|seguinte|→|>)\b/i, // "OK" pode vir com a dica "pressione Enter" colada
  final: /^(enviar|finalizar|concluir|submit|enviar respostas|enviar candidatura|finalizar inscri)/i,
  concluido: /respostas? (enviadas?|recebidas?)|obrigad[oa] por responder|questionário (enviado|concluído)|inscri[çc][ãa]o (finalizada|conclu)/i,
};
