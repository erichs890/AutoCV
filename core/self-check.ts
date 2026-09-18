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
const score = calcularScore(VAGA, perfil);
assert.ok(score >= 50 && score <= 100, `score inesperado: ${score}`);
const scoreRuim = calcularScore({ titulo: 'Consultor Comercial', descricao: 'Vendas, negociação, CRM', skills: extrairSkills('Vendas, negociação, CRM') }, perfil);
assert.ok(scoreRuim < 30, `score de vaga incompatível deveria ser baixo: ${scoreRuim}`);
console.log(`✓ Score: vaga compatível ${score}, vaga incompatível ${scoreRuim}`);

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

// 6) Perguntas parecidas
assert.ok(similaridade('Possui CNH?', 'Você possui CNH categoria B?') > 0.55);
assert.ok(similaridade('Nível de inglês', 'Qual seu nível de inglês?') > 0.55);
assert.ok(similaridade('Possui CNH?', 'Pretensão salarial') < 0.4);
console.log('✓ Similaridade de perguntas');

await fecharNavegador();
console.log('\nTudo certo.');
