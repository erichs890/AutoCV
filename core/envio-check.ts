// Verificação executável do ENVIO (o motor de formulário + a prova de rede), contra um InHire falso local.
//   node core/envio-check.ts   — ou `npm run check`, que roda este arquivo junto
//
// Por que um servidor local em vez do InHire de verdade: candidatar de verdade cria candidatura real numa vaga
// real. Aqui reproduzimos as três situações que decidem se o robô acerta ou erra o desfecho:
//   A) a plataforma aceita e a tela diz "candidatura enviada"      → enviada
//   B) a plataforma aceita mas a tela muda a redação (ou não muda) → enviada, pela resposta da API   ← o bug antigo
//   C) a plataforma recusa (HTTP 400)                              → erro com o motivo real do servidor
// Abre o Edge/Chrome headless, como uma candidatura de verdade.
import assert from 'node:assert/strict';
import { createServer, type Server } from 'node:http';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const DIR = mkdtempSync(join(tmpdir(), 'autocv-envio-'));
process.env.AUTOCV_DIR = DIR;
process.env.AUTOCV_PERFIL = join(DIR, 'navegador');

const { inhire } = await import('./platforms/inhire/index.ts');
const { fecharNavegador } = await import('./browser.ts');
import type { DadosCandidatura } from './platforms/adapter.ts';
import type { Vaga } from '../src/types.ts';

const curriculo = join(DIR, 'cv.pdf');
writeFileSync(curriculo, '%PDF-1.4 teste');

/** Página que imita o formulário público do InHire: campos fixos, aceite e o botão "Continuar inscrição". */
const paginaFormulario = (desfecho: 'sucesso' | 'redacao-nova' | 'recusa') => `<!doctype html>
<html lang="pt-BR"><meta charset="utf-8"><title>Vaga — Acme</title>
<body>
<form id="f">
  <label for="name">Nome completo *</label><input id="name" name="name" required>
  <label for="email">Seu melhor e-mail *</label><input id="email" name="email" type="email" required>
  <label for="phone">Celular *</label><input id="phone" name="phone" required>
  <label for="resume">Anexar currículo *</label><input id="resume" name="resume" type="file" required>
  <label><input id="privacyPolicy" name="privacyPolicy" type="checkbox" required> Li e concordo com a política de privacidade</label>
  <button type="button" id="enviar">Continuar inscrição</button>
</form>
<div id="saida"></div>
<script>
document.getElementById('enviar').addEventListener('click', async () => {
  const r = await fetch('/job-talents/public/vaga-1/talents', { method: 'POST', body: '{}' });
  const f = document.getElementById('f');
  const s = document.getElementById('saida');
  ${
    desfecho === 'sucesso'
      ? `f.remove(); s.textContent = 'Candidatura enviada com sucesso!';`
      : desfecho === 'redacao-nova'
        ? // A API aceitou, mas a tela não diz nada que o robô reconheça: era aqui que ele marcava erro
          `f.remove(); s.textContent = 'Tudo pronto por aqui.';`
        : `s.textContent = 'Não foi possível concluir.';`
  }
});
</script>
</body></html>`;

function subir(desfecho: 'sucesso' | 'redacao-nova' | 'recusa'): Promise<{ url: string; servidor: Server; posts: number }> {
  const estado = { posts: 0 };
  const servidor = createServer((req, res) => {
    if (req.url?.includes('/talents')) {
      estado.posts++;
      if (desfecho === 'recusa') {
        res.writeHead(400, { 'content-type': 'application/json' });
        return res.end(JSON.stringify({ message: 'CPF já cadastrado para esta vaga' }));
      }
      res.writeHead(201, { 'content-type': 'application/json' });
      return res.end('{"id":"t1"}');
    }
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    res.end(paginaFormulario(desfecho));
  });
  return new Promise(resolve => {
    servidor.listen(0, '127.0.0.1', () => {
      const { port } = servidor.address() as { port: number };
      resolve({
        url: `http://127.0.0.1:${port}/vagas/vaga-1/dev`,
        servidor,
        get posts() {
          return estado.posts;
        },
      } as never);
    });
  });
}

const vaga = (url: string): Vaga => ({
  id: 'inhire:acme:vaga-1',
  plataforma: 'inhire',
  tenant: 'acme',
  titulo: 'Pessoa Desenvolvedora Back-end',
  empresa: 'Acme',
  descricao: '',
  requisitos: '',
  regime: 'CLT',
  modelo: 'remoto',
  local: 'Remoto',
  url,
  skills: [],
  camposConhecidos: [],
  score: 80,
  status: 'em_andamento',
  encontradaEm: new Date().toISOString(),
  atualizadaEm: new Date().toISOString(),
});

const dados: DadosCandidatura = {
  nome: 'Marina Pitanga',
  email: 'marina@exemplo.com',
  celular: '11982324410',
  linkedin: 'https://linkedin.com/in/marina',
  cidade: 'Campinas - SP',
  cpf: '52998224725',
  pretensao: '4500',
  regime: 'CLT',
  curriculoPdf: curriculo,
  responder: () => null,
  ensaio: false,
  mostrarNavegador: false,
};

const silencio = () => {};

async function rodar(desfecho: 'sucesso' | 'redacao-nova' | 'recusa') {
  const s = await subir(desfecho);
  try {
    const r = await inhire.candidatar(vaga(s.url), dados, silencio);
    return { r, posts: s.posts };
  } finally {
    s.servidor.close();
  }
}

// ─── A) Caminho feliz: a plataforma aceita e a tela confirma ─────────────────────────────────────
let { r, posts } = await rodar('sucesso');
assert.equal(r.status, 'enviada', `esperava enviada, veio ${r.status}${r.status === 'erro' ? `: ${r.motivo}` : ''}`);
assert.equal(posts, 1, 'a candidatura deve ser criada uma única vez');
console.log('✓ Envio aceito e confirmado na tela → enviada (1 POST)');

// ─── B) O bug antigo: aceita pela API, tela com outra redação ────────────────────────────────────
({ r, posts } = await rodar('redacao-nova'));
assert.equal(r.status, 'enviada', `a candidatura FOI criada (HTTP 201); marcar ${r.status} faria o robô reenviar`);
assert.equal(posts, 1, 'não pode clicar em enviar de novo depois de a API aceitar');
console.log('✓ Aceito pela API mas sem confirmação na tela → enviada mesmo assim (1 POST)');

// ─── C) Recusa do servidor: erro com o motivo real, e nada de "enviada" ──────────────────────────
({ r, posts } = await rodar('recusa'));
assert.equal(r.status, 'erro', 'HTTP 400 não pode virar sucesso');
assert.match(r.status === 'erro' ? r.motivo : '', /400|CPF já cadastrado/, `o motivo devia citar a recusa do servidor, veio: ${r.status === 'erro' ? r.motivo : ''}`);
console.log('✓ Recusa do servidor → erro com o motivo devolvido pelo InHire');

// ─── D) Ensaio: preenche tudo e o POST nunca sai ─────────────────────────────────────────────────
const e = await subir('sucesso');
try {
  const saida = await inhire.candidatar(vaga(e.url), { ...dados, ensaio: true }, silencio);
  assert.equal(saida.status, 'ensaio', `em ensaio o resultado deve ser ensaio, veio ${saida.status}`);
  assert.equal(e.posts, 0, 'em ensaio NENHUMA requisição de envio pode sair');
} finally {
  e.servidor.close();
}
console.log('✓ Ensaio preenche o formulário e não dispara o envio (0 POST)');

await fecharNavegador();
console.log('\nEnvio: tudo certo.');
