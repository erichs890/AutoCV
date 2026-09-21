// Verificação executável do núcleo (sem tocar em plataforma nenhuma):
//   node core/self-check.ts
// Cobre: Markdown → PDF → Markdown, análise do currículo, score, adaptação sem invenção, similaridade de perguntas.
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

process.env.AUTOCV_PERFIL = join(tmpdir(), 'autocv-self-check'); // não colide com o núcleo rodando
import { markdownParaPdf } from './resume/mdToPdf.ts';
import { pdfParaMarkdown } from './resume/pdfToMd.ts';
import { analisarCurriculo } from './resume/analyzer.ts';
import { calcularScore } from './resume/score.ts';
import { inferirSenioridade } from './resume/analyzer.ts';
import { adaptarCurriculo, validarAdaptacao } from './resume/adapter.ts';
import { extrairSkills, similaridade } from './resume/texto.ts';
import { fecharNavegador } from './browser.ts';

const CV = `# Marina Pitanga
São Paulo, SP · marina@email.com · (11) 98232-4410

## Resumo
Desenvolvedora back-end júnior com 2 anos de experiência em Java e Spring Boot.

## Experiência
**Desenvolvedora Back-end Jr — Nuvemtec (2024–2026)**
- APIs REST em Java com Spring Boot e PostgreSQL
- Testes automatizados com JUnit
**Estagiária de Suporte — Bitmarco (2023–2024)**
- Atendimento a usuários e help desk

## Habilidades
- Excel
- Java
- Spring
- SQL
- Git

## Idiomas
- Inglês intermediário`;

const VAGA = {
  titulo: 'Desenvolvedor Back-end Júnior',
  descricao: 'Requisitos: Java, Spring Boot, SQL, Git, Docker (desejável). Trabalho em equipe.',
  skills: [] as string[],
};
VAGA.skills = extrairSkills(`${VAGA.titulo}\n${VAGA.descricao}`);

// 1) PDF ⇄ Markdown
const pdf = join(tmpdir(), `autocv-selfcheck-${Date.now()}.pdf`);
await markdownParaPdf(CV, pdf);
const lido = await pdfParaMarkdown(pdf);
for (const trecho of ['marina pitanga', 'resumo', 'experiência', 'habilidades', 'spring boot', 'postgresql']) assert.ok(lido.toLowerCase().includes(trecho), `PDF→MD perdeu "${trecho}":\n${lido}`);
assert.ok((lido.match(/^## /gm) ?? []).length >= 4, `PDF→MD não reconheceu as seções:\n${lido}`);
assert.ok((lido.match(/^- /gm) ?? []).length >= 5, `PDF→MD perdeu os itens de lista:\n${lido}`);
console.log('✓ Markdown → PDF → Markdown preserva nome, seções e conteúdo');

// 2) Perfil de busca
const perfil = analisarCurriculo(CV);
assert.equal(perfil.area, 'Tecnologia da Informação');
assert.equal(perfil.senioridade, 'Júnior');
assert.ok(perfil.skills.includes('java') && perfil.skills.includes('spring') && perfil.skills.includes('sql'), JSON.stringify(perfil));
assert.ok(
  perfil.cargos.some(c => /desenvolvedora/i.test(c)),
  JSON.stringify(perfil.cargos),
);
console.log('✓ Análise do currículo:', JSON.stringify(perfil));

// 3) Score
const { score, motivo } = calcularScore(VAGA, perfil);
assert.ok(score >= 50 && score <= 100, `score inesperado: ${score}`);
const ruim = calcularScore(
  { titulo: 'Consultor Comercial', descricao: 'Vendas, negociação, CRM e boa comunicação', skills: extrairSkills('Vendas, negociação, CRM, comunicação, proatividade') },
  perfil,
);
assert.ok(ruim.score < 25, `score de vaga incompatível deveria ser baixo: ${ruim.score} (${ruim.motivo})`);
const generica = calcularScore(
  { titulo: 'Supervisor de Atendimento', descricao: 'Comunicação, organização, proatividade, trabalho em equipe', skills: extrairSkills('Comunicação, organização, proatividade, trabalho em equipe') },
  perfil,
);
assert.ok(generica.score < 25, `vaga só com soft skills não pode pontuar alto: ${generica.score}`);
console.log(`✓ Score: compatível ${score} (${motivo}) · incompatível ${ruim.score} · só soft skills ${generica.score}`);

// 3b) Senioridade
assert.equal(inferirSenioridade('Desenvolvedor Java Pleno/Sênior', ''), 'Pleno');
assert.equal(inferirSenioridade('Analista Fiscal Jr', ''), 'Júnior');
assert.equal(inferirSenioridade('Estagiário de TI', ''), 'Estágio');
assert.equal(inferirSenioridade('Coordenador de Engenharia', ''), 'Liderança');
assert.equal(inferirSenioridade('Desenvolvedor Java', 'Requisitos: mínimo 5 anos de experiência com Java'), 'Sênior');
assert.equal(inferirSenioridade('Desenvolvedor Java', 'Vaga para nosso time'), 'Indefinida');
const BASE = 'Desenvolvedor Back-end';
const senior = calcularScore({ ...VAGA, titulo: `${BASE} Sênior` }, perfil);
const pleno = calcularScore({ ...VAGA, titulo: `${BASE} Pleno` }, perfil);
const junior = calcularScore({ ...VAGA, titulo: `${BASE} Júnior` }, perfil);
assert.ok(senior.score < pleno.score && pleno.score < junior.score, `júnior deve pontuar mais que pleno e sênior: ${junior.score} / ${pleno.score} / ${senior.score}`);
assert.ok(senior.score <= junior.score * 0.5, `dois níveis acima deve cortar pelo menos metade: ${senior.score} vs ${junior.score}`);
assert.ok(/acima do seu nível/.test(senior.motivo), senior.motivo);
const configurado = calcularScore({ ...VAGA, titulo: `${BASE} Sênior` }, perfil, { senioridade: 'Sênior' });
assert.ok(configurado.score > pleno.score && /senioridade ok/.test(configurado.motivo), `senioridade configurada deve sobrepor a do currículo: ${configurado.score} (${configurado.motivo})`);
console.log(`✓ Senioridade: júnior ${junior.score} · pleno ${pleno.score} · sênior ${senior.score}`);

// 3c) Local: só pesa em vaga presencial
const { lerLocal } = await import('./resume/score.ts');
assert.deepEqual(lerLocal('São Paulo - SP'), { cidade: 'sao paulo', uf: 'SP' });
assert.deepEqual(lerLocal('Belo Horizonte, Minas Gerais'), { cidade: 'belo horizonte', uf: 'MG' });
assert.deepEqual(lerLocal('Campinas/SP'), { cidade: 'campinas', uf: 'SP' });
assert.deepEqual(lerLocal('Brasil'), { cidade: '', uf: '' });
assert.deepEqual(lerLocal('Minas Gerais'), { cidade: '', uf: 'MG' });
assert.deepEqual(lerLocal('São Paulo, SP, BR'), { cidade: 'sao paulo', uf: 'SP' }); // formato real do InHire
assert.deepEqual(lerLocal('Rio de Janeiro, RJ, BR'), { cidade: 'rio de janeiro', uf: 'RJ' });
assert.deepEqual(lerLocal('BR'), { cidade: '', uf: '' });
assert.deepEqual(lerLocal('São Paulo'), { cidade: 'sao paulo', uf: 'SP' });
const meu = { local: 'Campinas - SP' };
const naCidade = calcularScore({ ...VAGA, modelo: 'presencial', local: 'Campinas, SP' }, perfil, meu);
const noEstado = calcularScore({ ...VAGA, modelo: 'presencial', local: 'São Paulo - SP' }, perfil, meu);
const foraEstado = calcularScore({ ...VAGA, modelo: 'presencial', local: 'Curitiba - PR' }, perfil, meu);
const remota = calcularScore({ ...VAGA, modelo: 'remoto', local: 'Curitiba - PR' }, perfil, meu);
const hibrida = calcularScore({ ...VAGA, modelo: 'hibrido', local: 'Curitiba - PR' }, perfil, meu);
assert.equal(naCidade.score, score, 'mesma cidade não muda o score');
assert.ok(foraEstado.score < noEstado.score && noEstado.score < naCidade.score, `presencial deve cair por distância: ${naCidade.score} / ${noEstado.score} / ${foraEstado.score}`);
assert.ok(foraEstado.score <= score * 0.25, `outro estado deve perder 80%: ${foraEstado.score}`);
assert.equal(remota.score, score, 'remota não considera cidade');
// Híbrida exige presença tanto quanto presencial: passou a pesar a distância (antes era ignorada de todo)
assert.ok(hibrida.score < score, `híbrida em outra cidade tem de perder pontos: ${hibrida.score}`);
assert.equal(calcularScore({ ...VAGA, modelo: 'hibrido', local: 'Campinas, SP' }, perfil, meu).score, score, 'híbrida na sua cidade não perde nada');
assert.equal(calcularScore({ ...VAGA, modelo: 'presencial', local: 'Curitiba - PR' }, perfil).score, score, 'sem cidade no perfil não penaliza');
assert.ok(/fora do seu estado/.test(foraEstado.motivo), foraEstado.motivo);
// Cidade sem UF ('Fortaleza') tambem tem de ser comparada: era aqui que a vaga de outro estado passava inteira
const semUf = calcularScore({ ...VAGA, modelo: 'presencial', local: 'Campinas, SP, BR' }, perfil, { local: 'Fortaleza' });
assert.ok(semUf.score <= score * 0.25, `cidade sem UF deve penalizar mesmo assim: ${semUf.score}`);
assert.equal(calcularScore({ ...VAGA, modelo: 'presencial', local: 'Fortaleza, CE, BR' }, perfil, { local: 'Fortaleza' }).score, score, 'mesma cidade sem UF nao penaliza');
console.log(`✓ Local: cidade ${naCidade.score} · estado ${noEstado.score} · fora ${foraEstado.score} · remota ${remota.score} · híbrida fora ${hibrida.score}`);

// 4) Adaptação sem invenção
const adaptacao = adaptarCurriculo(CV, VAGA);
assert.deepEqual(validarAdaptacao(CV, adaptacao.markdown), [], 'adaptação introduziu palavras novas');
assert.ok(!adaptacao.markdown.toLowerCase().includes('docker'), 'Docker NÃO pode aparecer: não está no currículo');
assert.ok(adaptacao.markdown.includes('Foco em java'), adaptacao.markdown);
const habilidades = adaptacao.markdown.split('## Habilidades')[1].split('##')[0];
assert.ok(habilidades.indexOf('Java') < habilidades.indexOf('Excel'), 'habilidades pedidas devem vir antes');
assert.ok(adaptacao.markdown.includes('Estagiária de Suporte'), 'experiência real removida');
assert.deepEqual(validarAdaptacao(CV, `${CV}\nCertificação AWS`), ['certificacao', 'aws'], 'validador deve pegar termo inventado');
console.log('✓ Adaptação:', adaptacao.diff.join(' | '));

// 4b) Validação de texto reescrito por IA: sinônimos passam, entidade nova não
const { validarEntidades, adaptarComIA } = await import('./resume/adapter.ts');
const reescrito = CV.replace('APIs REST em Java com Spring Boot e PostgreSQL', 'Construção de APIs REST com Java, Spring Boot e PostgreSQL').replace(
  'Desenvolvedora back-end júnior com 2 anos',
  'Desenvolvedora back-end júnior, com 2 anos',
);
assert.deepEqual(validarEntidades(CV, reescrito), [], 'sinônimos e reordenação devem passar');
const inventado = CV.replace('Testes automatizados com JUnit', 'Testes automatizados com JUnit e Docker na AWS desde 2019');
const p = validarEntidades(CV, inventado);
assert.ok(p.includes('docker') && p.includes('aws') && p.includes('2019'), `deveria pegar docker/aws/2019: ${p}`);
assert.ok(
  validarEntidades(CV, CV.replace('**Estagiária de Suporte — Bitmarco (2023–2024)**\n- Atendimento a usuários e help desk\n', '')).some(x => x.startsWith('item removido')),
  'remoção de experiência deve ser pega',
);
const simulada = await adaptarComIA(CV, VAGA, async () => `\`\`\`markdown\n${inventado}\n\`\`\``);
assert.ok(simulada.problemas.length > 0 && !simulada.markdown.startsWith('```'), 'adaptarComIA deve limpar cerca de código e reportar problemas');
console.log('✓ Validação de entidades (IA):', p.join(', '));

// 5) Pretensão salarial → formato da máscara do InHire (reais inteiros; a máscara põe ",00")
const { pretensaoEmReais } = await import('./platforms/inhire/index.ts');
assert.equal(pretensaoEmReais('R$ 4.500,00'), '4500');
assert.equal(pretensaoEmReais('4500'), '4500');
assert.equal(pretensaoEmReais('R$ 4.500'), '4500');
assert.equal(pretensaoEmReais('3.200,50'), '3200');
console.log('✓ Pretensão salarial em reais');

// 5c) Máscaras do perfil
const { mascaraTelefone, mascaraMoeda } = await import('../src/mascaras.ts');
assert.equal(mascaraTelefone('11912345678'), '(11) 91234-5678');
assert.equal(mascaraTelefone('+55 11 3123-4567'), '(11) 3123-4567');
assert.equal(mascaraTelefone('119'), '(11) 9');
assert.equal(mascaraMoeda('4500'), 'R$ 4.500');
assert.equal(mascaraMoeda('R$ 4.500,00'), 'R$ 4.500'); // valor antigo com centavos não vira 450 mil
assert.equal(pretensaoEmReais(mascaraMoeda('4500')), '4500');
console.log('✓ Máscaras de telefone e pretensão');

// 6) Motor de formulário: schema → perguntas, escolha de opção, classificação de campo (sem navegador)
const { perguntasDoTypeform, perguntasDaDiversidade, perguntasCertas } = await import('./platforms/inhire/schema.ts');
const { melhorOpcao, papelDe, resolverCampo } = await import('./platforms/inhire/formulario.ts');
const tf = perguntasDoTypeform({
  fields: [
    {
      id: 'a',
      ref: 'r1',
      type: 'multiple_choice',
      title: 'Nível de inglês?',
      validations: { required: true },
      properties: { choices: [{ label: 'Básico' }, { label: 'Fluente' }], allow_multiple_selection: false },
    },
    {
      id: 'b',
      ref: 'r2',
      type: 'multiple_choice',
      title: 'Formatos aceitos?',
      validations: { required: true },
      properties: { choices: [{ label: 'Remoto' }, { label: 'Híbrido' }], allow_multiple_selection: true },
    },
    { id: 'c', ref: 'r3', type: 'short_text', title: 'Se sim, quem?', validations: { required: false } },
    { id: 'd', ref: 'r4', type: 'yes_no', title: 'Já foi servidor público?', validations: { required: true } },
    { id: 'e', ref: 'r5', type: 'statement', title: 'Obrigado!' },
    { id: 'f', ref: 'r6', type: 'long_text', title: 'Conte mais', validations: { required: true } },
  ],
  logic: [{ type: 'field', ref: 'r1', actions: [{ details: { to: { value: 'r6' } } }] }],
});
assert.deepEqual(
  tf.map(p => `${p.tipo}${p.obrigatoria ? '*' : ''}${p.condicional ? '?' : ''}`),
  ['opcoes*', 'multipla*', 'texto', 'opcoes*', 'texto*?'],
  JSON.stringify(tf),
);
assert.deepEqual(tf[3].opcoes, ['Sim', 'Não']);
const div = perguntasDaDiversidade({
  diversity: {
    questions: [
      {
        id: 'genderIdentity',
        active: true,
        required: false,
        answerType: 'singleChoice',
        question: 'Qual é a sua identidade de gênero?',
        answerOptions: [{ title: 'Homem Cisgênero' }, { title: 'Prefiro não responder' }],
      },
      {
        id: 'diversityGroup',
        active: true,
        required: true,
        answerType: 'multipleChoice',
        question: 'Você pertence a um dos grupos abaixo?',
        answerOptions: [{ title: 'Mulher' }, { title: 'Prefiro não responder' }],
      },
      { id: 'peopleWithDisabilityAID', active: true, required: true, answerType: 'longText', question: 'Precisa de adaptação?' },
      { id: 'antiga', active: false, required: true, answerType: 'shortText', question: 'Inativa' },
    ],
  },
});
assert.deepEqual(
  div.map(p => p.id),
  ['genderIdentity', 'diversityGroup', 'peopleWithDisabilityAID'],
);
assert.deepEqual(
  perguntasCertas({ campos: [], obrigatorios: [], contratos: [], typeformId: null, perguntas: [...div, ...tf], fluxoCondicional: false }).map(p => p.id),
  ['diversityGroup', 'a', 'b', 'd'],
  'só obrigatórias e não condicionais',
);
const { SEQUENCIAL } = await import('./platforms/inhire/selectors.ts');
assert.ok(SEQUENCIAL.frameInHire.test('https://form-app.inhire.app/form?jobId=x&formId=y&type=subscription&flow=returnMessageToParent'));
assert.ok(SEQUENCIAL.frameTypeform.test('https://form.typeform.com/to/IjnhiKRd?typeform-embed=embed-widget'));
assert.ok(
  SEQUENCIAL.boasVindas.test('Responda as perguntas para finalizar sua inscrição:') &&
    SEQUENCIAL.iniciar.test('Iniciar') &&
    SEQUENCIAL.final.test('Enviar respostas') &&
    !SEQUENCIAL.final.test('Avançar'),
);
assert.equal(melhorOpcao(['Rio de Contas - BA', 'Rio de Janeiro - RJ'], 'Rio de Janeiro - RJ'), 1);
assert.equal(melhorOpcao(['Homem CisgêneroNasceu homem...', 'Prefiro não responder'], 'Prefiro não responder'), 1);
assert.equal(melhorOpcao(['Sim', 'Não'], 'nao'), 1);
assert.equal(melhorOpcao(['CLT', 'PJ'], 'Estágio'), -1);
assert.equal(papelDe({ nome: 'districtBr', rotulo: 'Cidade', tipo: 'dropdown' }), 'cidade');
assert.equal(papelDe({ nome: 'questionsDiversity.genderIdentity', rotulo: 'Qual é a sua identidade de gênero?', tipo: 'dropdown' }), null);
assert.equal(papelDe({ nome: '', rotulo: 'Pretensão salarial como CLT', tipo: 'texto' }), 'pretensao');
assert.equal(papelDe({ nome: '', rotulo: 'CPF', tipo: 'texto' }), 'cpf');
const dadosBase = {
  nome: 'Ana',
  email: 'a@b.c',
  celular: '(21) 99876-5432',
  linkedin: '',
  cidade: '',
  cpf: '',
  pretensao: 'R$ 4.500',
  regime: 'PJ' as const,
  curriculoPdf: '',
  responder: (p: { rotulo: string }) => (/indicad/i.test(p.rotulo) ? null : /inglês/i.test(p.rotulo) ? 'Básico' : null),
  ensaio: true,
  mostrarNavegador: false,
};
const campo = (extra: object) => ({ i: 0, tipo: 'texto' as const, nome: '', rotulo: '', obrigatorio: true, opcoes: [] as string[], preenchido: false, html: '', ...extra });
assert.deepEqual(resolverCampo(campo({ nome: 'phone' }), dadosBase), { acao: 'valor', valor: '21998765432', mascarado: true });
assert.equal(resolverCampo(campo({ nome: 'districtBr', tipo: 'dropdown' }), dadosBase).acao, 'pergunta', 'sem cidade no perfil → pergunta');
assert.deepEqual(resolverCampo(campo({ nome: 'contractType', tipo: 'radio', opcoes: ['CLT', 'PJ'] }), dadosBase), { acao: 'valor', valor: 'PJ' });
assert.deepEqual(resolverCampo(campo({ nome: 'isIndication', tipo: 'radio', opcoes: ['Não', 'Sim'] }), dadosBase), { acao: 'valor', valor: 'Não' });
assert.deepEqual(resolverCampo(campo({ tipo: 'radio', rotulo: 'Nível de inglês?', opcoes: ['Básico', 'Fluente'] }), dadosBase), { acao: 'valor', valor: 'Básico' });
assert.equal(resolverCampo(campo({ tipo: 'grupo', rotulo: 'Grupos?', opcoes: ['Mulher'], obrigatorio: false }), dadosBase).acao, 'pular', 'opcional sem resposta → pula');
assert.equal(resolverCampo(campo({ tipo: 'grupo', rotulo: 'Grupos?', opcoes: ['Mulher'] }), dadosBase).acao, 'pergunta', 'obrigatória sem resposta → pausa');
assert.deepEqual(resolverCampo(campo({ nome: 'privacyPolicy', tipo: 'checkbox' }), dadosBase), { acao: 'marcar' });
const { mascaraCPF } = await import('../src/mascaras.ts');
assert.equal(mascaraCPF('52998224725'), '529.982.247-25');
console.log('✓ Motor de formulário: schema, opções e classificação');

// 7) Autodeclaração / dados sensíveis: detecção por palavra-chave e política (funções puras)
const { categoriaSensivel, decidirSensivel, PREFIRO_NAO } = await import('../src/sensiveis.ts');
assert.equal(categoriaSensivel('Qual é a sua identidade de gênero?')?.id, 'genero');
assert.equal(categoriaSensivel('Qual é a sua orientação sexual?')?.id, 'orientacao');
assert.equal(categoriaSensivel('Qual é a sua cor ou raça?')?.id, 'raca');
assert.equal(categoriaSensivel('Deseja se candidatar para a vaga como pessoa com deficiência?')?.id, 'pcd');
assert.equal(categoriaSensivel('Você pertence a um dos grupos abaixo?')?.id, 'grupos');
assert.equal(categoriaSensivel('Você se declara uma pessoa com deficiência?')?.id, 'pcd');
assert.equal(categoriaSensivel('Qual o seu nível de conversação em inglês?'), null);
assert.equal(categoriaSensivel('Possui CNH categoria B?'), null);
assert.equal(categoriaSensivel('Qual a cor do seu carro?'), null, '"cor" sozinho não é sensível');
assert.ok(PREFIRO_NAO.test('Prefiro não responder') && PREFIRO_NAO.test('Não desejo informar') && !PREFIRO_NAO.test('Não'));
const casarOp = (ops: string[]) => (r: string) => ops.find(o => o.toLowerCase() === r.toLowerCase()) ?? null;
const genero = { rotulo: 'Qual é a sua identidade de gênero?', opcoes: ['Homem Cisgênero', 'Mulher Cisgênero', 'Prefiro não responder'], obrigatoria: false };
const casar = casarOp(genero.opcoes);
// 1) nunca por similaridade: resposta guardada para pergunta parecida (outra vaga) não vale
assert.equal(decidirSensivel(genero, [{ pergunta: 'Qual a sua identidade de gênero? *', resposta: 'Mulher Cisgênero' }], { modo: 'perguntar', padroes: {} }, casar), null);
// 2) pergunta literal (mesmo texto, ignorando acento/caixa) vale
assert.equal(decidirSensivel(genero, [{ pergunta: 'qual e a sua identidade de genero?', resposta: 'Mulher Cisgênero' }], { modo: 'perguntar', padroes: {} }, casar), 'Mulher Cisgênero');
// 3) prefiro_nao só quando opcional e a opção existe
assert.equal(decidirSensivel(genero, [], { modo: 'prefiro_nao', padroes: {} }, casar), 'Prefiro não responder');
assert.equal(decidirSensivel({ ...genero, obrigatoria: true }, [], { modo: 'prefiro_nao', padroes: {} }, casar), null, 'obrigatória → pausa');
assert.equal(decidirSensivel({ ...genero, opcoes: ['Homem', 'Mulher'] }, [], { modo: 'prefiro_nao', padroes: {} }, casar), null, 'sem a opção → pausa');
// 4) padrão por categoria, só se bater com uma opção
assert.equal(decidirSensivel({ ...genero, obrigatoria: true }, [], { modo: 'padrao', padroes: { genero: 'Homem Cisgênero' } }, casar), 'Homem Cisgênero');
assert.equal(decidirSensivel({ ...genero, obrigatoria: true }, [], { modo: 'padrao', padroes: { genero: 'Agênero' } }, casar), null, 'padrão que não existe na vaga → pausa');
assert.equal(decidirSensivel({ rotulo: 'Nível de inglês', opcoes: ['Básico'] }, [], { modo: 'padrao', padroes: {} }, casar), null, 'pergunta comum não passa por aqui');
console.log('✓ Autodeclaração: detecção por palavra-chave e política sem similaridade');

// 5b) Descoberta: subdomínio a partir de qualquer forma de entrada, URL com página de carreira, seed bem formado
const { extrairSubdominio } = await import('./platforms/inhire/discovery.ts');
const { urlVaga } = await import('./platforms/inhire/api.ts');
assert.equal(extrairSubdominio('db1'), 'db1');
assert.equal(extrairSubdominio('https://DB1.inhire.app/vagas'), 'db1');
assert.equal(extrairSubdominio('https://eurosolucoes.inhire.app/fitcard-tech/vagas/abc/analista'), 'eurosolucoes');
assert.equal(extrairSubdominio('https://www.inhire.com.br/x'), '');
assert.equal(urlVaga('acme', 'id1', 'Dev Júnior | SP', 'default'), 'https://acme.inhire.app/vagas/id1/dev-junior-or-sp');
assert.equal(urlVaga('euro', 'id1', 'Analista', 'fitcard-tech'), 'https://euro.inhire.app/fitcard-tech/vagas/id1/analista');
const seed = JSON.parse((await import('node:fs')).readFileSync(new URL('./platforms/inhire/seed_empresas_inhire.json', import.meta.url), 'utf8')) as {
  empresas: { subdominio: string; nome: string }[];
};
assert.ok(seed.empresas.length >= 10 && seed.empresas.every(e => /^[a-z0-9-]+$/.test(e.subdominio) && e.nome), 'seed inválido');
assert.equal(new Set(seed.empresas.map(e => e.subdominio)).size, seed.empresas.length, 'seed com subdomínio repetido');
console.log(`✓ Descoberta: subdomínios, URLs e seed (${seed.empresas.length} empresas)`);

// 5c) Envio: prova de rede, texto de confirmação e política de nova tentativa
const { SUCESSO, ROTAS_ENVIO } = await import('./platforms/inhire/selectors.ts');
for (const t of [
  'Candidatura enviada com sucesso!',
  'Inscrição realizada com sucesso',
  'Recebemos o seu currículo',
  'Obrigada por se candidatar',
  'Sua candidatura foi registrada',
  'Em breve entraremos em contato',
])
  assert.ok(SUCESSO.test(t), `confirmação não reconhecida: "${t}"`);
for (const t of ['Preencha os campos obrigatórios', 'Continuar inscrição', 'Ocorreu um erro']) assert.ok(!SUCESSO.test(t), `texto comum lido como confirmação: "${t}"`);
const definitiva = (url: string) => ROTAS_ENVIO.some(r => r.definitiva && r.re.test(url));
assert.ok(definitiva('https://api.inhire.app/job-talents/public/abc123/talents'), 'POST do talento é prova de envio');
assert.ok(definitiva('https://api.inhire.app/forms/form/submit'), 'submit do questionário é prova de envio');
assert.ok(!definitiva('https://api.inhire.app/job-posts/public/pages/abc123'), 'leitura da vaga não é envio');
assert.ok(!definitiva('https://api.typeform.com/responses'), 'resposta avulsa do Typeform não confirma a candidatura');

// Texto do botão de envio: varia por empresa (levantado nas páginas reais em 20/09/2026)
const { BOTAO_FINAL, BOTAO_PROXIMO } = await import('./platforms/inhire/selectors.ts');
for (const t of ['Continuar inscrição', 'Candidatar-se para a vaga', 'Candidatar-me', 'Enviar candidatura', 'Finalizar inscrição', 'Enviar'])
  assert.ok(BOTAO_FINAL.test(t), `botão de envio não reconhecido: "${t}"`);
// "Candidatar" sozinho é o botão do topo que só rola a página até o formulário: clicar nele trava o robô
for (const t of ['Candidatar', 'Vagas', 'Sobre a empresa', 'Anexar currículo', 'Voltar', 'Recursos Assistivos']) assert.ok(!BOTAO_FINAL.test(t), `"${t}" não pode ser confundido com o botão de envio`);
assert.ok(BOTAO_PROXIMO.test('Avançar') && BOTAO_PROXIMO.test('Continuar') && !BOTAO_PROXIMO.test('Continuar inscrição'));

// Senioridade DO CANDIDATO: o curriculo cita os cargos antigos, entao vale o nivel mais ALTO
const { inferirSenioridadeDoCurriculo, anosDeCarreira, familiaDoCargo } = await import('./resume/analyzer.ts');
assert.equal(anosDeCarreira('sou desenvolvedor full stack ha mais de 3 anos'), 3, '"ha mais de N anos" tem de contar');
assert.equal(anosDeCarreira('7+ anos de experiencia em backend'), 7);
assert.equal(anosDeCarreira('cursei 4 anos de faculdade'), 0, 'tempo de faculdade nao e carreira');
assert.equal(inferirSenioridadeDoCurriculo('Estagiario lider; desenvolvedor full stack ha mais de 3 anos'), 'Pleno', 'estagio antigo nao pode rebaixar quem tem 3 anos');
assert.equal(inferirSenioridadeDoCurriculo('Estagiario de TI, cursando Sistemas de Informacao'), 'Estágio', 'sem outro sinal, estagio vale');
assert.equal(inferirSenioridadeDoCurriculo('Desenvolvedor Senior, 8 anos de mercado'), 'Sênior');
assert.equal(inferirSenioridadeDoCurriculo('Desenvolvedor Junior com 1 ano de experiencia'), 'Júnior');
console.log('✓ Senioridade do curriculo: vale o nivel mais alto, nao o mais baixo');

// Familia de cargo: separa profissao, coisa que similaridade de texto nao faz
assert.equal(familiaDoCargo('Analista de Processos'), 'Processos e Negócio');
assert.equal(familiaDoCargo('Engenheiro de Software'), 'Desenvolvimento');
assert.equal(familiaDoCargo('Desenvolvedor Full Stack'), 'Desenvolvimento');
assert.equal(familiaDoCargo('Analista de Risco de Liquidez de Fundos de Investimento'), 'Financeiro e Contábil');
assert.equal(familiaDoCargo('Advogado Contencioso Civel'), 'Jurídico');
assert.equal(familiaDoCargo('Analista de Dados'), 'Dados e Analytics');
assert.ok(similaridade('Desenvolvedor Full Stack Ha Mais De 3 Anos', 'Analista de Processos') > 0.35, 'o texto ENGANA: por isso existe a familia');

// Score: vaga de outra funcao nao pode competir com vaga da sua
const meuPerfil = {
  area: 'Tecnologia da Informação',
  senioridade: 'Pleno',
  cargos: ['Desenvolvedor Full Stack'],
  skills: ['javascript', 'typescript', 'react', 'node.js', 'sql', 'docker', 'rest', 'testes', 'git'],
};
const vagaProcessos = { titulo: 'Analista de Processos', skills: ['sql', 'rest', 'testes'], descricao: 'mapeamento e automacao de processos, BPM e RPA', modelo: 'remoto' as const, local: 'BR' };
const vagaMinha = {
  titulo: 'Desenvolvedor Full Stack Pleno',
  skills: ['javascript', 'typescript', 'react', 'node.js', 'sql', 'docker'],
  descricao: 'aplicacoes web',
  modelo: 'remoto' as const,
  local: 'BR',
};
const sProcessos = calcularScore(vagaProcessos, meuPerfil, {});
const sMinha = calcularScore(vagaMinha, meuPerfil, {});
assert.ok(sMinha.score >= 80, `vaga da sua funcao deveria pontuar alto, deu ${sMinha.score}`);
assert.ok(sProcessos.score < 45, `vaga de outra funcao nao pode passar de 45, deu ${sProcessos.score} (${sProcessos.motivo})`);
assert.ok(sMinha.score - sProcessos.score > 35, 'a distancia entre as duas precisa ser clara');
assert.match(sProcessos.motivo, /outra função/);
// Rigido derruba ainda mais
assert.ok(calcularScore(vagaProcessos, meuPerfil, { cargoRigido: true }).score < sProcessos.score, 'filtro rigido tem de cortar mais');
// Vaga vaga (poucas competencias genericas) nao chega a 100% so por isso
assert.ok(calcularScore({ titulo: 'Analista Administrativo', skills: ['sql'], descricao: 'rotinas administrativas', modelo: 'remoto' as const, local: 'BR' }, meuPerfil, {}).score < 40);
console.log('✓ Score: funcao diferente cai, vaga generica nao infla, filtro rigido corta mais');

// Intervalo em segundos: o rotulo tem de ficar legivel nas quatro faixas usadas na tela
const { textoIntervalo } = await import('./queue.ts');
assert.equal(textoIntervalo(10), '10 s');
assert.equal(textoIntervalo(30), '30 s');
assert.equal(textoIntervalo(60), '1 min');
assert.equal(textoIntervalo(180), '3 min');
assert.equal(textoIntervalo(90), '1 min 30 s');
console.log('✓ Intervalo entre candidaturas legivel em segundos e minutos');

// Modo Sem Piedade: o que a IA devolve so passa se for curto, humano e (em lista) uma opcao real
const { CHEIRO_DE_IA, limparResposta } = await import('./ia.ts');
assert.equal(limparResposta('  "Tenho 3 anos de experiencia."  '), 'Tenho 3 anos de experiencia.');
assert.equal(limparResposta('Resposta: Sim'), 'Sim');
assert.equal(limparResposta('**Nao**'), 'Nao');
for (const ruim of [
  'Como profissional da area, posso afirmar que sim',
  'Vale ressaltar que tenho experiencia com React',
  'Trabalho com isso — e gosto muito',
  '- React e Node',
  'Alem disso, atuo com Docker',
  'Em resumo, sim',
  'Sou apaixonado por tecnologia',
  'Nao tenho acesso a essa informacao',
  'Com base no meu curriculo, sim',
  'Nao possuo informacoes suficientes para responder',
  'Nao informado no curriculo',
  'Nao consta',
  'Nao e possivel determinar com os dados disponiveis',
])
  assert.ok(CHEIRO_DE_IA.test(ruim), `deveria ser recusado por cheiro de IA: "${ruim}"`);
for (const bom of [
  'Sim',
  'Nao',
  '3 anos',
  'Tenho 3 anos com React e Node',
  'Disponibilidade imediata',
  'Ingles intermediario',
  'Ja trabalhei com Docker em producao',
  // Stack que o CV nao mostra: o tom pedido e "ainda estou aprendendo", nunca um nao seco nem experiencia inventada
  'Ainda nao usei em projeto, estou estudando.',
  'Ainda estou aprendendo, sem experiencia profissional ainda.',
])
  assert.ok(!CHEIRO_DE_IA.test(bom), `resposta humana e curta nao pode ser recusada: "${bom}"`);
console.log('✓ Sem Piedade: filtro de resposta rejeita texto com cara de IA e aceita resposta curta');

// Opcoes prontas de autodeclaracao: tem de casar com o que as vagas realmente escrevem
const { CATEGORIAS_SENSIVEIS: CATS, PREFIRO_NAO_RESPONDER } = await import('../src/sensiveis.ts');
for (const c of CATS) {
  assert.ok(c.opcoesComuns.length >= 2, `${c.id} precisa de opcoes prontas`);
  assert.ok(c.opcoesComuns.includes(PREFIRO_NAO_RESPONDER), `${c.id} deve oferecer "${PREFIRO_NAO_RESPONDER}"`);
  assert.ok(new Set(c.opcoesComuns).size === c.opcoesComuns.length, `${c.id} tem opcao repetida`);
}
// A escolha guardada precisa achar a opcao da vaga mesmo escrita diferente (o casamento e por similaridade)
const casarPorSimilaridade = (opcoes: string[]) => (r: string) => opcoes.find(o => similaridade(o, r) >= 0.7) ?? null;
const catGenero = CATS.find(c => c.id === 'genero')!;
assert.ok(catGenero.opcoesComuns.includes('Homem Cisgênero') && catGenero.opcoesComuns.includes('Mulher Cisgênero'));
const daVaga = ['Homem cisgênero', 'Mulher cisgênero', 'Homem transgênero', 'Mulher transgênero', 'Prefiro não responder'];
assert.equal(
  decidirSensivel({ rotulo: 'Qual é a sua identidade de gênero?', opcoes: daVaga, obrigatoria: true }, [], { modo: 'padrao', padroes: { genero: 'Homem Cisgênero' } }, casarPorSimilaridade(daVaga)),
  'Homem cisgênero',
  'a opcao pronta tem de casar com a grafia da vaga',
);
// PcD e saude usam Sim/Nao, que as vagas escrevem assim mesmo
assert.equal(
  decidirSensivel({ rotulo: 'Você é uma pessoa com deficiência?', opcoes: ['Sim', 'Não'], obrigatoria: true }, [], { modo: 'padrao', padroes: { pcd: 'Não' } }, casarPorSimilaridade(['Sim', 'Não'])),
  'Não',
);
// Sem padrao definido continua pausando
assert.equal(decidirSensivel({ rotulo: 'Qual é a sua identidade de gênero?', opcoes: daVaga, obrigatoria: true }, [], { modo: 'padrao', padroes: {} }, casarPorSimilaridade(daVaga)), null);
console.log('✓ Autodeclaracao: opcoes prontas casam com a grafia real das vagas');

// Pergunta sobre a propria empresa: nao pode nascer marcada para reaproveitar em outra vaga
const { perguntaSoDestaVaga } = await import('../src/dados.ts');
for (const [r, emp] of [
  ['Quais sao as suas impressoes sobre as nossas producoes?', 'Brasil Paralelo'],
  ['Voce ja conhece a Brasil Paralelo?', 'Brasil Paralelo'],
  ['Por que voce quer trabalhar conosco?', 'Acme'],
  ['O que voce sabe sobre a empresa?', 'Acme'],
  ['Por que se interessou por esta vaga?', 'Acme'],
  ['Como conheceu a QI Tech?', 'QI Tech'],
] as [string, string][])
  assert.ok(perguntaSoDestaVaga(r, emp), `deveria ser so desta vaga: "${r}"`);
for (const [r, emp] of [
  ['Qual o seu nivel de ingles?', 'Acme'],
  ['Anos de experiencia com React', 'Acme'],
  ['Possui CNH categoria B?', 'Acme'],
  ['Qual a sua pretensao salarial?', 'Acme'],
  ['Disponibilidade de inicio', 'Acme'],
  ['Conhece a metodologia Scrum?', 'Acme'],
] as [string, string][])
  assert.ok(!perguntaSoDestaVaga(r, emp), `deveria poder ser reaproveitada: "${r}"`);
console.log('✓ Pergunta sobre a propria empresa nao nasce marcada para reaproveitar');

// Afinidade: quem programa reconhece IA, QA, dados e seguranca como o mesmo mundo
const { familiasAfins } = await import('./resume/analyzer.ts');
assert.equal(familiaDoCargo('Engenheiro de IA'), 'IA e Machine Learning');
assert.equal(familiaDoCargo('QA Automation Engineer'), 'Qualidade e Testes');
for (const outra of ['IA e Machine Learning', 'Qualidade e Testes', 'Dados e Analytics', 'Segurança da Informação'])
  assert.ok(familiasAfins('Desenvolvimento', outra), `${outra} deveria ser afim de Desenvolvimento`);
for (const longe of ['Financeiro e Contábil', 'Jurídico', 'Processos e Negócio', 'Comercial e Vendas']) assert.ok(!familiasAfins('Desenvolvimento', longe), `${longe} NAO e do mundo de quem programa`);

// Com rigor RIGIDO, vaga de IA/QA/senior continua alta; outra profissao e cortada
const fRigido = { cargoRigido: true, local: 'Fortaleza - CE', presencialSoNaMinhaCidade: true };
const vagaRemota = (titulo: string, skills: string[], descricao = '') => ({ titulo, skills, descricao, modelo: 'remoto' as const, local: 'BR' });
const meuCv = {
  area: 'Tecnologia da Informação',
  senioridade: 'Pleno',
  cargos: ['Desenvolvedor Full Stack'],
  skills: ['javascript', 'typescript', 'react', 'node.js', 'sql', 'docker', 'python', 'git', 'rest'],
};
const meuStack = ['javascript', 'typescript', 'react', 'node.js', 'python', 'sql'];
for (const t of ['Engenheiro de IA', 'QA Automation Engineer', 'Desenvolvedor Full Stack Senior', 'Cientista de Dados'])
  assert.ok(
    calcularScore(vagaRemota(t, meuStack), meuCv, fRigido).score >= 60,
    `"${t}" deveria continuar relevante no rigor rigido (deu ${calcularScore(vagaRemota(t, meuStack), meuCv, fRigido).score})`,
  );
assert.ok(calcularScore(vagaRemota('Analista de Processos', ['sql', 'rest']), meuCv, fRigido).score < 30, 'outra profissao cai no rigor rigido');
assert.ok(calcularScore(vagaRemota('Advogado Contencioso', ['excel']), meuCv, fRigido).score < 20);
console.log('✓ Rigor rigido mantem dev/IA/QA/dados/seguranca e corta outras profissoes');

// Fora da cidade: so remotas. Presencial/hibrido em outra cidade nem pontua.
const vagaEm = (modelo: 'presencial' | 'hibrido' | 'remoto', local: string) => ({ titulo: 'Desenvolvedor Full Stack Pleno', skills: meuStack, descricao: '', modelo, local });
assert.equal(calcularScore(vagaEm('presencial', 'São Paulo, SP, BR'), meuCv, fRigido).score, 0, 'presencial em outra cidade tem de ser cortada');
assert.equal(calcularScore(vagaEm('hibrido', 'Belo Horizonte, MG, BR'), meuCv, fRigido).score, 0, 'hibrido em outra cidade tambem');
assert.ok(calcularScore(vagaEm('presencial', 'Fortaleza, CE, BR'), meuCv, fRigido).score >= 60, 'presencial NA sua cidade continua valendo');
assert.ok(calcularScore(vagaEm('hibrido', 'Fortaleza, CE, BR'), meuCv, fRigido).score >= 60, 'hibrido na sua cidade continua valendo');
assert.ok(calcularScore(vagaEm('remoto', 'BR'), meuCv, fRigido).score >= 60, 'remota sempre vale');
assert.ok(calcularScore(vagaEm('hibrido', 'BR'), meuCv, fRigido).score >= 60, 'local ilegivel nao pode sumir com a vaga');
assert.match(calcularScore(vagaEm('presencial', 'São Paulo, SP, BR'), meuCv, fRigido).motivo, /s[óo] quer remotas/);
// Sem a opcao ligada, volta a ser so penalidade
assert.ok(calcularScore(vagaEm('presencial', 'São Paulo, SP, BR'), meuCv, { ...fRigido, presencialSoNaMinhaCidade: false }).score > 0);
console.log('✓ Fora da sua cidade so passam remotas (presencial/hibrido local continuam valendo)');

// CPF: preenche sozinho em qualquer redacao de campo de digitar, mas nunca de terceiro nem em pergunta sim/nao
const texto = (rotulo: string, tipo = 'texto' as const) => ({ nome: '', rotulo, tipo });
for (const r of ['CPF', 'Coloque aqui o seu CPF', 'Qual o seu CPF?', 'CPF (somente numeros)', 'Informe seu CPF para cadastro'])
  assert.equal(papelDe(texto(r)), 'cpf', `deveria reconhecer CPF em "${r}"`);
for (const r of ['CPF do responsavel legal', 'CPF da empresa', 'CPF do conjuge', 'CPF do socio administrador'])
  assert.equal(papelDe(texto(r)), null, `CPF de terceiro nao pode ser preenchido: "${r}"`);
assert.equal(papelDe({ nome: '', rotulo: 'Voce possui CPF?', tipo: 'radio' }), null, 'pergunta sim/nao nao recebe o numero');
assert.equal(papelDe(texto('Qual o seu CNPJ?')), null, 'CNPJ nao e CPF');
assert.deepEqual(resolverCampo(campo({ rotulo: 'Coloque aqui o seu CPF', tipo: 'texto' }), { ...dadosBase, cpf: '529.982.247-25' }), { acao: 'valor', valor: '52998224725', mascarado: true });
assert.equal(resolverCampo(campo({ rotulo: 'Coloque aqui o seu CPF', tipo: 'texto' }), dadosBase).acao, 'pergunta', 'sem CPF no perfil, pergunta');
console.log('✓ CPF: preenchido sozinho em qualquer redacao; de terceiro ou sim/nao vira pergunta');

// Disponibilidade presencial: nunca afirmar "Sim" por conta propria quando a vaga e em outra cidade
const { disponibilidadeNoModelo } = await import('./platforms/inhire/formulario.ts');
const campoModelo = (rotulo: string) => ({ i: 0, tipo: 'radio' as const, nome: 'workModel', rotulo, obrigatorio: true, opcoes: ['Sim', 'Nao'], preenchido: false, html: '' });
const emFortaleza = { ...dadosBase, cidade: 'Fortaleza - CE' };
const perguntaSP = 'Voce tem disponibilidade para trabalhar no modelo presencial em Sao Paulo, Sao Paulo, Brasil, Pinheiros - SP?';
assert.equal(disponibilidadeNoModelo(campoModelo(perguntaSP), emFortaleza).acao, 'pergunta', 'presencial em outra cidade tem de perguntar');
assert.deepEqual(disponibilidadeNoModelo(campoModelo('Voce tem disponibilidade para o modelo presencial em Fortaleza - CE?'), emFortaleza), { acao: 'valor', valor: 'Sim' });
assert.deepEqual(disponibilidadeNoModelo(campoModelo('Voce aceita trabalhar no modelo remoto?'), emFortaleza), { acao: 'valor', valor: 'Sim' }, 'remoto nao precisa perguntar');
assert.equal(disponibilidadeNoModelo(campoModelo(perguntaSP), { ...dadosBase, cidade: '' }).acao, 'pergunta', 'sem a cidade do usuario, perguntar');
assert.equal(disponibilidadeNoModelo(campoModelo('Tem disponibilidade para o modelo hibrido?'), emFortaleza).acao, 'pergunta', 'hibrido sem cidade legivel: perguntar');
console.log('✓ Disponibilidade presencial: so afirma "Sim" quando a vaga e remota ou na regiao do usuario');

const { falhaRepetivel, esperaDaTentativa, MAX_TENTATIVAS: MAXT } = await import('./falhas.ts');
for (const m of [
  'Timeout 12000ms exceeded',
  'net::ERR_CONNECTION_RESET',
  'o questionário do InHire (form-app) não carregou: ficou em branco por 20 s',
  'sem confirmação do InHire após o envio',
  'Target page, context or browser has been closed',
])
  assert.ok(falhaRepetivel(m), `deveria tentar de novo: "${m}"`);
for (const m of [
  'o InHire pediu verificação (captcha); envie esta vaga manualmente',
  'formulário de candidatura não apareceu (vaga encerrada ou layout mudou)',
  'perfil ou currículo principal ausente',
  'o InHire recusou o envio (HTTP 400)',
  'parei para não candidatar duas vezes',
  'não sei preencher "X" (tipo desconhecido)',
])
  assert.ok(!falhaRepetivel(m), `não deveria repetir: "${m}"`);
assert.deepEqual([1, 2, 3, 9].map(esperaDaTentativa), [2, 10, 30, 30]);
assert.equal(MAXT, 3);
console.log('✓ Envio: prova de rede, confirmação e política de nova tentativa');

// 6) Perguntas parecidas
assert.ok(similaridade('Possui CNH?', 'Você possui CNH categoria B?') > 0.55);
assert.ok(similaridade('Nível de inglês', 'Qual seu nível de inglês?') > 0.55);
assert.ok(similaridade('Possui CNH?', 'Pretensão salarial') < 0.4);
console.log('✓ Similaridade de perguntas');

await fecharNavegador();
console.log('\nTudo certo.');
