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
assert.ok(perfil.cargos.some(c => /desenvolvedora/i.test(c)), JSON.stringify(perfil.cargos));
console.log('✓ Análise do currículo:', JSON.stringify(perfil));

// 3) Score
const { score, motivo } = calcularScore(VAGA, perfil);
assert.ok(score >= 50 && score <= 100, `score inesperado: ${score}`);
const ruim = calcularScore({ titulo: 'Consultor Comercial', descricao: 'Vendas, negociação, CRM e boa comunicação', skills: extrairSkills('Vendas, negociação, CRM, comunicação, proatividade') }, perfil);
assert.ok(ruim.score < 25, `score de vaga incompatível deveria ser baixo: ${ruim.score} (${ruim.motivo})`);
const generica = calcularScore({ titulo: 'Supervisor de Atendimento', descricao: 'Comunicação, organização, proatividade, trabalho em equipe', skills: extrairSkills('Comunicação, organização, proatividade, trabalho em equipe') }, perfil);
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
const senior = calcularScore({ ...VAGA, titulo: BASE + ' Sênior' }, perfil);
const pleno = calcularScore({ ...VAGA, titulo: BASE + ' Pleno' }, perfil);
const junior = calcularScore({ ...VAGA, titulo: BASE + ' Júnior' }, perfil);
assert.ok(senior.score < pleno.score && pleno.score < junior.score, `júnior deve pontuar mais que pleno e sênior: ${junior.score} / ${pleno.score} / ${senior.score}`);
assert.ok(senior.score <= junior.score * 0.5, `dois níveis acima deve cortar pelo menos metade: ${senior.score} vs ${junior.score}`);
assert.ok(/acima do seu nível/.test(senior.motivo), senior.motivo);
const configurado = calcularScore({ ...VAGA, titulo: BASE + ' Sênior' }, perfil, { senioridade: 'Sênior' });
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
assert.equal(hibrida.score, score, 'híbrida não considera cidade');
assert.equal(calcularScore({ ...VAGA, modelo: 'presencial', local: 'Curitiba - PR' }, perfil).score, score, 'sem cidade no perfil não penaliza');
assert.ok(/fora do seu estado/.test(foraEstado.motivo), foraEstado.motivo);
console.log(`✓ Local presencial: cidade ${naCidade.score} · estado ${noEstado.score} · fora ${foraEstado.score} · remota ${remota.score}`);

// 4) Adaptação sem invenção
const adaptacao = adaptarCurriculo(CV, VAGA);
assert.deepEqual(validarAdaptacao(CV, adaptacao.markdown), [], 'adaptação introduziu palavras novas');
assert.ok(!adaptacao.markdown.toLowerCase().includes('docker'), 'Docker NÃO pode aparecer: não está no currículo');
assert.ok(adaptacao.markdown.includes('Foco em java'), adaptacao.markdown);
const habilidades = adaptacao.markdown.split('## Habilidades')[1].split('##')[0];
assert.ok(habilidades.indexOf('Java') < habilidades.indexOf('Excel'), 'habilidades pedidas devem vir antes');
assert.ok(adaptacao.markdown.includes('Estagiária de Suporte'), 'experiência real removida');
assert.deepEqual(validarAdaptacao(CV, CV + '\nCertificação AWS'), ['certificacao', 'aws'], 'validador deve pegar termo inventado');
console.log('✓ Adaptação:', adaptacao.diff.join(' | '));

// 4b) Validação de texto reescrito por IA: sinônimos passam, entidade nova não
const { validarEntidades, adaptarComIA } = await import('./resume/adapter.ts');
const reescrito = CV.replace('APIs REST em Java com Spring Boot e PostgreSQL', 'Construção de APIs REST com Java, Spring Boot e PostgreSQL').replace('Desenvolvedora back-end júnior com 2 anos', 'Desenvolvedora back-end júnior, com 2 anos');
assert.deepEqual(validarEntidades(CV, reescrito), [], 'sinônimos e reordenação devem passar');
const inventado = CV.replace('Testes automatizados com JUnit', 'Testes automatizados com JUnit e Docker na AWS desde 2019');
const p = validarEntidades(CV, inventado);
assert.ok(p.includes('docker') && p.includes('aws') && p.includes('2019'), `deveria pegar docker/aws/2019: ${p}`);
assert.ok(validarEntidades(CV, CV.replace('**Estagiária de Suporte — Bitmarco (2023–2024)**\n- Atendimento a usuários e help desk\n', '')).some(x => x.startsWith('item removido')), 'remoção de experiência deve ser pega');
const simulada = await adaptarComIA(CV, VAGA, async () => '```markdown\n' + inventado + '\n```');
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
    { id: 'a', ref: 'r1', type: 'multiple_choice', title: 'Nível de inglês?', validations: { required: true }, properties: { choices: [{ label: 'Básico' }, { label: 'Fluente' }], allow_multiple_selection: false } },
    { id: 'b', ref: 'r2', type: 'multiple_choice', title: 'Formatos aceitos?', validations: { required: true }, properties: { choices: [{ label: 'Remoto' }, { label: 'Híbrido' }], allow_multiple_selection: true } },
    { id: 'c', ref: 'r3', type: 'short_text', title: 'Se sim, quem?', validations: { required: false } },
    { id: 'd', ref: 'r4', type: 'yes_no', title: 'Já foi servidor público?', validations: { required: true } },
    { id: 'e', ref: 'r5', type: 'statement', title: 'Obrigado!' },
    { id: 'f', ref: 'r6', type: 'long_text', title: 'Conte mais', validations: { required: true } },
  ],
  logic: [{ type: 'field', ref: 'r1', actions: [{ details: { to: { value: 'r6' } } }] }],
});
assert.deepEqual(tf.map(p => `${p.tipo}${p.obrigatoria ? '*' : ''}${p.condicional ? '?' : ''}`), ['opcoes*', 'multipla*', 'texto', 'opcoes*', 'texto*?'], JSON.stringify(tf));
assert.deepEqual(tf[3].opcoes, ['Sim', 'Não']);
const div = perguntasDaDiversidade({ diversity: { questions: [
  { id: 'genderIdentity', active: true, required: false, answerType: 'singleChoice', question: 'Qual é a sua identidade de gênero?', answerOptions: [{ title: 'Homem Cisgênero' }, { title: 'Prefiro não responder' }] },
  { id: 'diversityGroup', active: true, required: true, answerType: 'multipleChoice', question: 'Você pertence a um dos grupos abaixo?', answerOptions: [{ title: 'Mulher' }, { title: 'Prefiro não responder' }] },
  { id: 'peopleWithDisabilityAID', active: true, required: true, answerType: 'longText', question: 'Precisa de adaptação?' },
  { id: 'antiga', active: false, required: true, answerType: 'shortText', question: 'Inativa' },
] } });
assert.deepEqual(div.map(p => p.id), ['genderIdentity', 'diversityGroup', 'peopleWithDisabilityAID']);
assert.deepEqual(perguntasCertas({ campos: [], obrigatorios: [], contratos: [], typeformId: null, perguntas: [...div, ...tf], fluxoCondicional: false }).map(p => p.id), ['diversityGroup', 'a', 'b', 'd'], 'só obrigatórias e não condicionais');
const { SEQUENCIAL } = await import('./platforms/inhire/selectors.ts');
assert.ok(SEQUENCIAL.frameInHire.test('https://form-app.inhire.app/form?jobId=x&formId=y&type=subscription&flow=returnMessageToParent'));
assert.ok(SEQUENCIAL.frameTypeform.test('https://form.typeform.com/to/IjnhiKRd?typeform-embed=embed-widget'));
assert.ok(SEQUENCIAL.boasVindas.test('Responda as perguntas para finalizar sua inscrição:') && SEQUENCIAL.iniciar.test('Iniciar') && SEQUENCIAL.final.test('Enviar respostas') && !SEQUENCIAL.final.test('Avançar'));
assert.equal(melhorOpcao(['Rio de Contas - BA', 'Rio de Janeiro - RJ'], 'Rio de Janeiro - RJ'), 1);
assert.equal(melhorOpcao(['Homem CisgêneroNasceu homem...', 'Prefiro não responder'], 'Prefiro não responder'), 1);
assert.equal(melhorOpcao(['Sim', 'Não'], 'nao'), 1);
assert.equal(melhorOpcao(['CLT', 'PJ'], 'Estágio'), -1);
assert.equal(papelDe({ nome: 'districtBr', rotulo: 'Cidade', tipo: 'dropdown' }), 'cidade');
assert.equal(papelDe({ nome: 'questionsDiversity.genderIdentity', rotulo: 'Qual é a sua identidade de gênero?', tipo: 'dropdown' }), null);
assert.equal(papelDe({ nome: '', rotulo: 'Pretensão salarial como CLT', tipo: 'texto' }), 'pretensao');
assert.equal(papelDe({ nome: '', rotulo: 'CPF', tipo: 'texto' }), 'cpf');
const dadosBase = { nome: 'Ana', email: 'a@b.c', celular: '(21) 99876-5432', linkedin: '', cidade: '', cpf: '', pretensao: 'R$ 4.500', regime: 'PJ' as const, curriculoPdf: '', responder: (p: { rotulo: string }) => (/indicad/i.test(p.rotulo) ? null : /inglês/i.test(p.rotulo) ? 'Básico' : null), ensaio: true, mostrarNavegador: false };
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
const seed = JSON.parse((await import('node:fs')).readFileSync(new URL('./platforms/inhire/seed_empresas_inhire.json', import.meta.url), 'utf8')) as { empresas: { subdominio: string; nome: string }[] };
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
for (const t of ['Preencha os campos obrigatórios', 'Continuar inscrição', 'Ocorreu um erro'])
  assert.ok(!SUCESSO.test(t), `texto comum lido como confirmação: "${t}"`);
const definitiva = (url: string) => ROTAS_ENVIO.some(r => r.definitiva && r.re.test(url));
assert.ok(definitiva('https://api.inhire.app/job-talents/public/abc123/talents'), 'POST do talento é prova de envio');
assert.ok(definitiva('https://api.inhire.app/forms/form/submit'), 'submit do questionário é prova de envio');
assert.ok(!definitiva('https://api.inhire.app/job-posts/public/pages/abc123'), 'leitura da vaga não é envio');
assert.ok(!definitiva('https://api.typeform.com/responses'), 'resposta avulsa do Typeform não confirma a candidatura');

const { falhaRepetivel, esperaDaTentativa, MAX_TENTATIVAS: MAXT } = await import('./falhas.ts');
for (const m of ['Timeout 12000ms exceeded', 'net::ERR_CONNECTION_RESET', 'o questionário do InHire (form-app) não carregou: ficou em branco por 20 s', 'sem confirmação do InHire após o envio', 'Target page, context or browser has been closed'])
  assert.ok(falhaRepetivel(m), `deveria tentar de novo: "${m}"`);
for (const m of ['o InHire pediu verificação (captcha); envie esta vaga manualmente', 'formulário de candidatura não apareceu (vaga encerrada ou layout mudou)', 'perfil ou currículo principal ausente', 'o InHire recusou o envio (HTTP 400)', 'parei para não candidatar duas vezes', 'não sei preencher "X" (tipo desconhecido)'])
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
