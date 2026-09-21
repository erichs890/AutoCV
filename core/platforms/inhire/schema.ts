// ETAPA 0 — schema do formulário via API (levantado em 18/09/2026 observando o tráfego do site do InHire).
//
// O InHire NÃO tem um endpoint único "formulário da vaga", mas expõe as três camadas do formulário:
//   1. GET api.inhire.app/job-posts/public/pages/<jobId>  → settings.fields / settings.requiredFields (campos fixos:
//      linkedin, salary, curriculum, workModel, referral, location, cep), contractType (CLT/PJ) e
//      diversity.questions (aba "2. Diversidade": answerType singleChoice | multipleChoice | shortText | longText,
//      required, answerOptions[].title). Nome, e-mail e celular são sempre pedidos.
//   2. GET api.inhire.app/forms/public/job-id/<jobId>/subscription → { typeformId } (404 = a vaga não tem
//      perguntas próprias). As perguntas da empresa vivem num Typeform.
//   3. GET form.typeform.com/forms/<typeformId> → definição pública do Typeform (fields[].type/title/
//      validations.required/properties.choices, logic, hidden: job_id/talent_id/type). Funciona sem chave.
//
// Fluxo real na página: aba 1 "Informações" (e aba 2 "Diversidade" quando a empresa ativou) → "Continuar inscrição"
// = POST /job-talents/public/<jobId>/talents com reCAPTCHA Enterprise → depois disso o Typeform aparece (widget
// embutido com talent_id, ou renderizado pelo próprio InHire no "conditional flow", que cria o talento só no fim e
// envia as respostas em POST /forms/form/submit). Vale para todas as empresas testadas (Radix, DB1, Conta Azul,
// Alelo, Loggi); a Dock não tem Typeform (404).
//
// O schema NÃO substitui o DOM: perguntas condicionais (ex.: "CID" só se PcD = sim) e a ordem/aba de cada campo
// só existem na página. Ele serve para (a) resolver as respostas ANTES de abrir o navegador — pausando para o
// usuário sem gastar navegador nem adaptação de currículo — e (b) dar rótulos, tipos e opções confiáveis ao motor DOM.
import type { PerguntaExtra } from '../../../src/types.ts';
import { configTenant, detalheVaga, type DetalheVagaInHire } from './api.ts';

export interface PerguntaSchema extends PerguntaExtra {
  origem: 'diversidade' | 'typeform';
  id: string;
  obrigatoria: boolean;
  condicional: boolean; // só aparece dependendo de outra resposta: não perguntar antes da hora
}

export interface SchemaFormulario {
  campos: string[]; // settings.fields
  obrigatorios: string[]; // settings.requiredFields
  contratos: string[]; // contractType
  typeformId: string | null;
  perguntas: PerguntaSchema[];
  /** Empresa com requireCustomFormCompletion: "Continuar inscrição" abre o questionário e o talento só é criado ao terminá-lo */
  fluxoCondicional: boolean;
}

interface QuestaoDiversidade {
  id: string;
  active?: boolean;
  required?: boolean;
  answerType: 'singleChoice' | 'multipleChoice' | 'shortText' | 'longText' | string;
  question?: string;
  title?: string;
  answerOptions?: { title: string }[];
}

interface CampoTypeform {
  id: string;
  ref?: string;
  type: string;
  title: string;
  validations?: { required?: boolean };
  properties?: { choices?: { label: string }[]; allow_multiple_selection?: boolean; steps?: number; labels?: Record<string, string> };
}

interface DefinicaoTypeform {
  fields?: CampoTypeform[];
  logic?: { type?: string; ref?: string; actions?: { details?: { to?: { value?: string } } }[] }[];
}

// Perguntas do InHire que só aparecem depois de outra resposta (CID/atendimento só para quem se declara PcD)
const CONDICIONAIS_DIVERSIDADE = /CID$|AID$/;

/** Perguntas da aba Diversidade no formato do robô (PerguntaExtra + metadados). Só as ativas. */
export function perguntasDaDiversidade(detalhe: Pick<DetalheVagaInHire, 'diversity'>): PerguntaSchema[] {
  const questoes = ((detalhe.diversity?.questions ?? []) as QuestaoDiversidade[]).filter(q => q.active !== false);
  return questoes.map(q => {
    const opcoes = (q.answerOptions ?? []).map(o => o.title.trim()).filter(Boolean);
    const tipo: PerguntaExtra['tipo'] = q.answerType === 'multipleChoice' ? 'multipla' : q.answerType === 'singleChoice' ? 'opcoes' : 'texto';
    return {
      origem: 'diversidade',
      id: q.id,
      rotulo: (q.question || q.title || q.id).trim(),
      tipo,
      opcoes: tipo === 'texto' ? undefined : opcoes,
      obrigatoria: q.required === true,
      condicional: CONDICIONAIS_DIVERSIDADE.test(q.id),
    };
  });
}

/** Campos do Typeform no formato do robô. Blocos sem resposta (statement/group) ficam de fora. */
export function perguntasDoTypeform(def: DefinicaoTypeform): PerguntaSchema[] {
  const alvosDeLogica = new Set<string>();
  for (const regra of def.logic ?? []) for (const a of regra.actions ?? []) if (a.details?.to?.value) alvosDeLogica.add(a.details.to.value);
  const saida: PerguntaSchema[] = [];
  for (const f of def.fields ?? []) {
    let tipo: PerguntaExtra['tipo'];
    let opcoes: string[] | undefined;
    switch (f.type) {
      case 'multiple_choice':
      case 'dropdown':
      case 'picture_choice':
        opcoes = (f.properties?.choices ?? []).map(c => c.label.trim()).filter(Boolean);
        tipo = f.type === 'multiple_choice' && f.properties?.allow_multiple_selection ? 'multipla' : 'opcoes';
        break;
      case 'yes_no':
        tipo = 'opcoes';
        opcoes = ['Sim', 'Não'];
        break;
      case 'legal':
        tipo = 'opcoes';
        opcoes = ['Aceito', 'Não aceito'];
        break;
      case 'opinion_scale':
      case 'rating': {
        const passos = f.properties?.steps ?? (f.type === 'rating' ? 5 : 10);
        const inicio = f.type === 'opinion_scale' ? 0 : 1;
        tipo = 'opcoes';
        opcoes = Array.from({ length: passos + (f.type === 'opinion_scale' ? 1 : 0) }, (_, i) => String(inicio + i));
        break;
      }
      case 'file_upload':
        tipo = 'arquivo';
        break;
      case 'statement':
      case 'group':
        continue;
      default: // short_text, long_text, email, phone_number, number, date, website...
        tipo = 'texto';
    }
    saida.push({ origem: 'typeform', id: f.id, rotulo: f.title.replace(/\s+/g, ' ').trim(), tipo, opcoes, obrigatoria: f.validations?.required === true, condicional: alvosDeLogica.has(f.ref ?? '') });
  }
  return saida;
}

const cache = new Map<string, { em: number; schema: SchemaFormulario }>();
const TTL_MS = 60 * 60 * 1000;

/** Schema completo da vaga (cache de 1 h em memória). Falha de rede em qualquer camada vira erro: o chamador decide. */
export async function lerSchemaFormulario(tenant: string, jobId: string): Promise<SchemaFormulario> {
  const chave = `${tenant}/${jobId}`;
  const c = cache.get(chave);
  if (c && Date.now() - c.em < TTL_MS) return c.schema;

  const detalhe = await detalheVaga(tenant, jobId);
  const perguntas = perguntasDaDiversidade(detalhe);
  let typeformId: string | null = null;
  const sub = await fetch(`https://api.inhire.app/forms/public/job-id/${jobId}/subscription`, {
    headers: { 'x-tenant': tenant, 'x-inhire-client': 'web-inhire', accept: 'application/json' },
    signal: AbortSignal.timeout(15000),
  });
  if (sub.ok) {
    typeformId = ((await sub.json()) as { typeformId?: string }).typeformId ?? null;
  } else if (sub.status !== 404) {
    throw new Error(`InHire ${sub.status} ao consultar o formulário da vaga`);
  }
  // Alguns formId são UUIDs de formulários nativos do InHire (não existem no Typeform: 404). Nesse caso as
  // perguntas só serão conhecidas no navegador (form-app), e o motor sequencial resolve na hora.
  if (typeformId && !/^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(typeformId)) {
    const tf = await fetch(`https://form.typeform.com/forms/${encodeURIComponent(typeformId)}`, {
      headers: { accept: 'application/json', 'user-agent': 'Mozilla/5.0' },
      signal: AbortSignal.timeout(15000),
    });
    if (tf.ok) perguntas.push(...perguntasDoTypeform((await tf.json()) as DefinicaoTypeform));
    else if (tf.status !== 404) throw new Error(`Typeform ${tf.status} ao ler as perguntas da vaga`);
  }
  const cfg = typeformId ? await configTenant(tenant).catch(() => null) : null;
  const fluxoCondicional = !!cfg?.publicCapabilities?.includes('requireCustomFormCompletion');
  const schema: SchemaFormulario = {
    campos: detalhe.settings?.fields ?? [],
    obrigatorios: detalhe.settings?.requiredFields ?? [],
    contratos: detalhe.contractType ?? [],
    typeformId,
    perguntas,
    fluxoCondicional,
  };
  cache.set(chave, { em: Date.now(), schema });
  return schema;
}

/** Perguntas que com certeza vão aparecer e precisam de resposta: obrigatórias e não condicionais. */
export const perguntasCertas = (s: SchemaFormulario) => s.perguntas.filter(p => p.obrigatoria && !p.condicional && p.tipo !== 'arquivo');
