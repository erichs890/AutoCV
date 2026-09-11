export const areas = ['Tecnologia da Informação', 'Suporte e Infraestrutura', 'Dados e Analytics'];
export const niveis = ['Estágio', 'Júnior', 'Pleno', 'Sênior'];
export const skillsDetectadas = ['Java', 'SQL', 'Spring', 'Git', 'REST'];

export const descricaoExemplo =
  'Vaga: Desenvolvedor(a) Back-end Júnior — Nuvemtec (Remoto)\n\nRequisitos: Java 11+, Spring Boot, SQL, versionamento com Git, noções de REST e testes automatizados. Diferenciais: Docker, AWS, React.';

export function getCurriculos() {
  return [
    { id: 'cv1', arquivo: 'marina-pitanga-cv-2010.pdf', versao: 'v3', foco: 'Back-end Java', nivel: 'Júnior', cargo: 'Desenvolvedora Back-end', area: 'Tecnologia da Informação' },
    { id: 'cv2', arquivo: 'marina-cv-suporte.pdf', versao: 'v1', foco: 'Suporte técnico', nivel: 'Júnior', cargo: 'Analista de Suporte', area: 'Suporte e Infraestrutura' },
  ];
}

export function getVersoes() {
  return [
    { id: 'v3', data: '06/09/2010 — 09:14', nota: 'Versão com foco em back-end Java' },
    { id: 'v2', data: '28/08/2010 — 18:02', nota: 'Ajuste de resumo profissional' },
    { id: 'v1', data: '12/08/2010 — 11:40', nota: 'Primeira versão enviada' },
  ];
}

// ponytail: análise fixa; a API vai calcular a partir do texto da vaga
export function getAnalise(_descricao: string) {
  return {
    compatibilidade: 78,
    sugestoes: [
      { ok: false, texto: 'Adicione a palavra-chave “Docker” às competências' },
      { ok: false, texto: 'Destaque sua experiência com SQL no resumo' },
      { ok: true, texto: 'Java e Spring já aparecem em destaque' },
      { ok: true, texto: 'Formação compatível com o requisito da vaga' },
    ],
  };
}
