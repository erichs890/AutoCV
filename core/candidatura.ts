import { join } from 'node:path';
import { existsSync } from 'node:fs';
import type { Pendencia, PerguntaExtra, Vaga } from '../src/types.ts';
import { adapters } from './platforms/adapter.ts';
import { candidaturas, kv, log, vagas } from './storage/db.ts';
import { ler } from './estado.ts';
import { emitir } from './events.ts';
import { DIRS } from './config.ts';
import { adaptarComIA, adaptarCurriculo, validarAdaptacao } from './resume/adapter.ts';
import { completar, iaAtiva, lerIA } from './ia.ts';
import { markdownParaPdf } from './resume/mdToPdf.ts';
import { similaridade } from './resume/texto.ts';

const registrar = log.registrar;

// Perguntas cuja resposta vai para o perfil (Configurações → Meus Dados), não para a lista de perguntas automáticas
export const PERGUNTA_LINKEDIN = 'Link do seu perfil no LinkedIn (a vaga exige)';
export const PERGUNTA_PRETENSAO = 'Sua pretensão salarial (ex.: R$ 4.500,00)';
export const PERGUNTA_REGIME = 'Regime de contratação';

/** Resposta salva (Configurações → Perguntas Automáticas) para uma pergunta parecida, ou null. */
export function respostaSalva(pergunta: PerguntaExtra): string | null {
  let melhor: { resposta: string; s: number } | null = null;
  for (const p of ler.perguntas()) {
    if (!p.resposta.trim()) continue;
    const s = similaridade(p.pergunta, pergunta.rotulo);
    if (s >= 0.55 && (!melhor || s > melhor.s)) melhor = { resposta: p.resposta.trim(), s };
  }
  if (!melhor) return null;
  if (pergunta.tipo === 'opcoes' && pergunta.opcoes?.length) {
    // Resposta salva precisa bater com uma das opções da vaga
    const opcao = pergunta.opcoes.find(o => similaridade(o, melhor!.resposta) >= 0.7);
    return opcao ?? null;
  }
  return melhor.resposta;
}

function decidirRegime(vaga: Vaga): 'CLT' | 'PJ' | null | 'perguntar' {
  if (vaga.regime === 'CLT' || vaga.regime === 'PJ') return vaga.regime;
  const pref = ler.automacao().regimePreferido;
  return pref === 'perguntar' ? 'perguntar' : pref;
}

function pendente(vaga: Vaga, pendencia: Pendencia) {
  const status = pendencia.tipo === 'pergunta' ? 'aguardando_pergunta' : 'aguardando_aprovacao';
  vagas.atualizar(vaga.id, { status, pendencia });
  registrar('aguardo', pendencia.tipo === 'pergunta' ? `"${vaga.titulo}" aguarda sua resposta: ${pendencia.pergunta.rotulo}` : `"${vaga.titulo}" aguarda sua aprovação do currículo adaptado.`);
  emitir({ tipo: 'aviso', nivel: 'info', msg: pendencia.tipo === 'pergunta' ? `O InHire perguntou: ${pendencia.pergunta.rotulo}` : `Currículo adaptado pronto para revisão: ${vaga.titulo}` });
}

/** IA (se configurada) com validação de entidades; qualquer problema → cai para a adaptação por regras. */
async function gerarAdaptacao(original: string, vaga: Vaga): Promise<{ markdown: string; diff: string[]; viaIA: boolean }> {
  if (iaAtiva()) {
    const { provedor, modelo } = lerIA();
    try {
      const r = await adaptarComIA(original, vaga, completar);
      if (r.problemas.length === 0) {
        registrar('sucesso', `Currículo reescrito por ${provedor === 'gemini' ? 'Gemini' : 'Claude'} (${modelo}) para "${vaga.titulo}" e validado: nenhuma entidade nova.`);
        return { ...r, viaIA: true };
      }
      registrar('alerta', `Reescrita por IA descartada para "${vaga.titulo}": ${r.problemas.slice(0, 5).join('; ')}. Usando adaptação por regras.`);
    } catch (e) {
      registrar('alerta', `IA indisponível (${(e as Error).message}). Usando adaptação por regras.`);
    }
  }
  return { ...adaptarCurriculo(original, vaga), viaIA: false };
}

/**
 * Fluxo completo de uma candidatura. Ordem obrigatória: preencher → anexar → enviar → só então confirmar.
 * Pausa (sem travar as outras) quando falta resposta de pergunta ou aprovação de preview.
 */
export async function executarCandidatura(id: string) {
  const vaga = vagas.get(id);
  if (!vaga) return;
  const perfil = ler.perfil();
  const cfg = ler.automacao();
  const adapter = adapters[vaga.plataforma];
  const principal = ler.curriculos()[0];
  if (!perfil || !principal?.caminho || !existsSync(principal.caminho)) {
    vagas.atualizar(id, { status: 'erro', erro: 'perfil ou currículo principal ausente' });
    registrar('erro', `"${vaga.titulo}": perfil ou currículo principal ausente.`);
    return;
  }
  if (!adapter) {
    vagas.atualizar(id, { status: 'erro', erro: `plataforma ${vaga.plataforma} sem adapter` });
    return;
  }

  // Campos que o InHire exige e o cadastro inicial não pediu: pergunta uma vez e guarda no perfil
  const exige = (campo: string) => vaga.camposConhecidos.length === 0 || vaga.camposConhecidos.includes(campo);
  if (exige('linkedin') && !perfil.linkedin?.trim()) return pendente(vaga, { tipo: 'pergunta', pergunta: { rotulo: PERGUNTA_LINKEDIN, tipo: 'texto' } });
  if (exige('salary') && !perfil.pretensao?.trim()) return pendente(vaga, { tipo: 'pergunta', pergunta: { rotulo: PERGUNTA_PRETENSAO, tipo: 'texto' } });

  const regime = decidirRegime(vaga);
  if (regime === 'perguntar') {
    pendente(vaga, { tipo: 'pergunta', pergunta: { rotulo: `${PERGUNTA_REGIME} para "${vaga.titulo}" (a vaga ${vaga.regime === 'ambos' ? 'aceita CLT e PJ' : 'não informou o regime'})`, tipo: 'opcoes', opcoes: ['CLT', 'PJ'] } });
    return;
  }

  vagas.atualizar(id, { status: 'em_andamento', pendencia: undefined, erro: undefined });
  emitir({ tipo: 'estado' });

  // 1) Currículo: original ou adaptado (com validação anti-invenção)
  let curriculoPdf = principal.caminho;
  let versao: 'original' | 'adaptada' = 'original';
  const aprovacao = vaga.pendencia?.tipo === 'aprovacao' ? vaga.pendencia : null;
  if (cfg.adaptar && principal.markdown && vaga.decisaoPreview !== 'original') {
    const adaptacao = aprovacao ? { markdown: aprovacao.adaptado, diff: aprovacao.diff, viaIA: false } : await gerarAdaptacao(principal.markdown, vaga);
    // Aprovado pelo usuário ou gerado por IA: validação de entidades (sinônimos ok, dado novo não). Regras: validação palavra a palavra.
    const novas = aprovacao || adaptacao.viaIA ? [] : validarAdaptacao(principal.markdown, adaptacao.markdown);
    if (novas.length) {
      registrar('alerta', `Adaptação descartada para "${vaga.titulo}": introduziria termos ausentes do original (${novas.slice(0, 5).join(', ')}). Usando o original.`);
    } else if (adaptacao.diff.length === 0) {
      registrar('info', `Nada a adaptar para "${vaga.titulo}": currículo original enviado.`);
    } else {
      if (cfg.preview === 'mostrar' && !aprovacao && vaga.decisaoPreview !== 'adaptado') {
        pendente(vaga, { tipo: 'aprovacao', original: principal.markdown, adaptado: adaptacao.markdown, diff: adaptacao.diff });
        return;
      }
      curriculoPdf = join(DIRS.gerados, `${vaga.id.replace(/[^a-z0-9]/gi, '_')}.pdf`);
      await markdownParaPdf(adaptacao.markdown, curriculoPdf, cfg.mostrarNavegador);
      versao = 'adaptada';
      registrar('sucesso', `Currículo adaptado para "${vaga.titulo}" (${adaptacao.diff.length} mudança(s), nada inventado).`);
    }
  }

  // 2) Preencher, anexar e enviar
  const resultado = await adapter.candidatar(
    vaga,
    {
      nome: perfil.nome,
      email: perfil.email,
      celular: perfil.telefone,
      linkedin: perfil.linkedin ?? '',
      pretensao: perfil.pretensao ?? '',
      regime,
      curriculoPdf,
      responder: respostaSalva,
      ensaio: cfg.ensaio,
      mostrarNavegador: cfg.mostrarNavegador,
    },
    registrar,
  );

  // 3) Só depois do resultado real: confirmação ou erro
  if (resultado.status === 'pergunta') return pendente(vaga, { tipo: 'pergunta', pergunta: resultado.pergunta });
  if (resultado.status === 'erro') {
    vagas.atualizar(id, { status: 'erro', erro: resultado.motivo, captura: resultado.captura });
    registrar('erro', `Falha em "${vaga.titulo}" (${vaga.empresa}): ${resultado.motivo}`);
    emitir({ tipo: 'aviso', nivel: 'erro', msg: `Falha ao candidatar: ${vaga.titulo}` });
    return;
  }
  const enviadaEm = new Date().toISOString();
  candidaturas.inserir({
    vagaId: vaga.id,
    titulo: vaga.titulo,
    empresa: vaga.empresa,
    plataforma: vaga.plataforma,
    url: vaga.url,
    enviadaEm,
    nome: perfil.nome,
    email: perfil.email,
    celular: perfil.telefone,
    curriculo: curriculoPdf,
    versao,
    regime: regime ?? '',
    resultado: resultado.status,
  });
  vagas.atualizar(id, { status: resultado.status === 'ensaio' ? 'ensaio' : 'enviada', pendencia: undefined, captura: resultado.status === 'ensaio' ? resultado.captura : undefined });
  if (resultado.status === 'ensaio') {
    if (resultado.pronto) registrar('sucesso', `Ensaio concluído para "${vaga.titulo}": formulário aceito pelo InHire, NADA foi enviado (modo ensaio ligado).`);
    else registrar('alerta', `Ensaio de "${vaga.titulo}" preenchido, mas ${resultado.observacao}. Veja a captura.`);
    emitir({ tipo: 'aviso', nivel: resultado.pronto ? 'sucesso' : 'info', msg: `Ensaio: ${vaga.titulo} ${resultado.pronto ? 'pronta para envio' : 'com pendência no formulário'}` });
  } else {
    registrar('sucesso', `Candidatura confirmada: "${vaga.titulo}" em ${vaga.empresa} — currículo ${versao}, regime ${regime ?? 'não pedido'}.`);
    emitir({ tipo: 'aviso', nivel: 'sucesso', msg: `Candidatura enviada: ${vaga.titulo} (${vaga.empresa})` });
  }
  kv.set('proximoEnvioEm', new Date(Date.now() + cfg.intervalo * 60000).toISOString());
}
