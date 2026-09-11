import type { Pergunta } from '../types';

export function getConfig() {
  return { roboConfigurado: true };
}

export function getNaoLidas() {
  return 3;
}

export function getPlano() {
  return { nome: 'Plano Pro', usados: 32, limite: 100, preco: 'R$ 29,90/mês', renova: '06/10/2010' };
}

export function getFaturas() {
  return [
    { data: '06/09/2010', valor: 'R$ 29,90' },
    { data: '06/08/2010', valor: 'R$ 29,90' },
    { data: '06/07/2010', valor: 'R$ 29,90' },
  ];
}

export function getPerfil() {
  return {
    nome: 'Marina Pitanga de Souza',
    nomeCurto: 'Marina Pitanga',
    cargo: 'Desenvolvedora Back-end Jr',
    email: 'marina.pitanga@email.com',
    telefone: '(11) 98232-4410',
    cidade: 'São Paulo — SP',
    linkedin: 'linkedin.com/in/marinapitanga',
    github: 'github.com/marinapitanga',
    portfolio: 'marinapitanga.com.br',
    endereco: 'Rua das Acácias, 218 — Vila Mariana',
    cpf: '328.914.760-05',
    nascimento: '1992-03-14',
    disponibilidade: 'Imediata',
    pcd: 'Não',
    escolaridade: 'Superior completo — Ciência da Computação',
    idiomas: 'Português (nativo), Inglês (intermediário)',
    pretensao: 'R$ 4.500',
  };
}

export function getPerguntas(): Pergunta[] {
  return [
    { id: 1, icone: 'salario', pergunta: 'Pretensão salarial', resposta: 'R$ 4.500,00', personalizada: false },
    { id: 2, icone: 'experiencia', pergunta: 'Anos de experiência', resposta: '2 anos', personalizada: false },
    { id: 3, icone: 'viagem', pergunta: 'Disponibilidade para viagem', resposta: 'Sim, eventualmente', personalizada: false },
    { id: 4, icone: 'remoto', pergunta: 'Pretende trabalhar remoto?', resposta: 'Sim, prefiro remoto ou híbrido', personalizada: false },
    { id: 5, icone: 'cnh', pergunta: 'Possui CNH?', resposta: 'Sim — categoria B', personalizada: false },
    { id: 6, icone: 'inicio', pergunta: 'Disponibilidade de início', resposta: 'Imediata', personalizada: false },
    { id: 7, icone: 'ingles', pergunta: 'Nível de inglês', resposta: 'Intermediário', personalizada: false },
    { id: 8, icone: 'pcd', pergunta: 'Possui deficiência (PcD)?', resposta: 'Não', personalizada: false },
  ];
}

export function getNotificacoes() {
  return [
    { id: 'cada-envio', titulo: 'Notificar por e-mail a cada envio', descricao: 'Você recebe um e-mail sempre que o robô envia um currículo.', ativo: true },
    { id: 'resposta', titulo: 'Notificar quando houver resposta de empresa', descricao: 'Avisos de entrevistas e mensagens das plataformas.', ativo: true },
    { id: 'resumo', titulo: 'Resumo semanal por e-mail', descricao: 'Toda segunda-feira, com estatísticas da semana.', ativo: true },
    { id: 'erro-conexao', titulo: 'Alertas de erro de conexão', descricao: 'Quando uma plataforma desconectar ou expirar a sessão.', ativo: false },
    { id: 'novidades', titulo: 'Novidades e dicas do AutoCV', descricao: 'Novidades do produto e dicas de currículo.', ativo: false },
  ];
}
