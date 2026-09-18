// API pública que o próprio site do InHire usa (descoberta observando o tráfego do navegador).
// Precisa apenas do cabeçalho x-tenant = slug da empresa (ex.: "vagasbyintera" em vagasbyintera.inhire.app).
const BASE = 'https://api.inhire.app';

export interface ResumoVagaInHire {
  jobId: string;
  displayName: string;
  status: string;
  careerPageId?: string; // 'default' ou o nome de uma página de carreira própria (entra na URL)
  workplaceType?: string; // Remote | Hybrid | On-site
  location?: string;
}

export interface ConfigTenant {
  id: string;
  name: string;
  status: string; // active | inactive
  publicCapabilities?: string[]; // "requireCustomFormCompletion" = questionário antes de criar o talento (fluxo condicional)
}

/** Configuração pública da empresa; null se o subdomínio não existe (404). */
export async function configTenant(tenant: string): Promise<ConfigTenant | null> {
  const r = await fetch(`${BASE}/tenants/public/config/${encodeURIComponent(tenant)}`, { headers: { 'x-inhire-client': 'web-inhire', accept: 'application/json' }, signal: AbortSignal.timeout(15000) });
  if (r.status === 404) return null;
  if (!r.ok) throw new Error(`InHire ${r.status} ao consultar ${tenant}`);
  return (await r.json()) as ConfigTenant;
}

export interface DetalheVagaInHire extends ResumoVagaInHire {
  tenantName: string;
  description: string; // HTML
  contractType: string[]; // ex.: ["CLT"], ["PJ"], ["CLT","PJ"] ou []
  settings?: { fields?: string[]; requiredFields?: string[] };
  privacyPolicyUrl?: string;
  diversity?: { questions?: unknown[] }; // aba "2. Diversidade" (schema.ts interpreta)
}

async function get<T>(tenant: string, caminho: string): Promise<T> {
  const r = await fetch(BASE + caminho, {
    headers: { 'x-tenant': tenant, 'x-inhire-client': 'web-inhire', accept: 'application/json' },
    signal: AbortSignal.timeout(20000),
  });
  if (!r.ok) throw new Error(`InHire ${r.status} em ${caminho} (tenant ${tenant})`);
  return (await r.json()) as T;
}

export async function listarVagas(tenant: string): Promise<{ tenantName: string; vagas: ResumoVagaInHire[] }> {
  const j = await get<{ tenantName: string; jobsPage: ResumoVagaInHire[] }>(tenant, '/job-posts/public/pages');
  return { tenantName: j.tenantName, vagas: (j.jobsPage ?? []).filter(v => v.status === 'published') };
}

export const detalheVaga = (tenant: string, jobId: string) => get<DetalheVagaInHire>(tenant, `/job-posts/public/pages/${jobId}`);

export const slug = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\|/g, 'or')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

// Página de carreira própria entra no caminho: eurosolucoes.inhire.app/fitcard-tech/vagas/<id>/<slug>
export const urlVaga = (tenant: string, jobId: string, titulo: string, careerPageId = 'default') =>
  `https://${tenant}.inhire.app/${careerPageId && careerPageId !== 'default' ? `${careerPageId}/` : ''}vagas/${jobId}/${slug(titulo)}`;

export function htmlParaTexto(html: string): string {
  return html
    .replace(/<\s*(br|\/p|\/h[1-6]|\/li|\/div)\s*>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&(aacute|agrave|atilde|acirc|eacute|ecirc|iacute|oacute|otilde|ocirc|uacute|ccedil|ntilde);/g, (_, e: string) => ({ aacute: 'á', agrave: 'à', atilde: 'ã', acirc: 'â', eacute: 'é', ecirc: 'ê', iacute: 'í', oacute: 'ó', otilde: 'õ', ocirc: 'ô', uacute: 'ú', ccedil: 'ç', ntilde: 'ñ' })[e] ?? '')
    .replace(/&(Aacute|Agrave|Atilde|Acirc|Eacute|Ecirc|Iacute|Oacute|Otilde|Ocirc|Uacute|Ccedil);/g, (_, e: string) => ({ Aacute: 'Á', Agrave: 'À', Atilde: 'Ã', Acirc: 'Â', Eacute: 'É', Ecirc: 'Ê', Iacute: 'Í', Oacute: 'Ó', Otilde: 'Õ', Ocirc: 'Ô', Uacute: 'Ú', Ccedil: 'Ç' })[e] ?? '')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&ndash;|&mdash;/g, '—')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
