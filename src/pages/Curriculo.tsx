import { useEffect, useRef, useState } from 'react';
import { Check, CloudUpload, Download, FileCheck, FileText, FolderOpen, History, Plus, RotateCcw, SearchCheck, Sparkles, Upload } from 'lucide-react';
import Panel from '../components/Panel';
import { areas, descricaoExemplo, getAnalise, getCurriculos, getVersoes, niveis, skillsDetectadas } from '../mocks/curriculo';

const LIMITE_MB = 5;
const linhasPreview = [108, 96, 104, 72, 110, 88, 100, 64, 106, 92];

export default function Curriculo() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [erro, setErro] = useState('');
  const [arrastando, setArrastando] = useState(false);
  const [progresso, setProgresso] = useState(0);
  const [curriculos] = useState(getCurriculos);
  const [principalId, setPrincipalId] = useState('cv1');
  const [versaoAtual, setVersaoAtual] = useState('v3');
  const [salvo, setSalvo] = useState(false);
  const [descricao, setDescricao] = useState(descricaoExemplo);
  const [analise, setAnalise] = useState(() => getAnalise(descricaoExemplo));

  const principal = curriculos.find(c => c.id === principalId)!;
  const outros = curriculos.filter(c => c.id !== principalId);

  // ponytail: upload simulado; troque pelo POST real quando houver API
  useEffect(() => {
    if (!arquivo) return;
    const t = setInterval(() => setProgresso(p => Math.min(p + 4, 100)), 80);
    const fim = setTimeout(() => clearInterval(t), 80 * 26);
    return () => {
      clearInterval(t);
      clearTimeout(fim);
    };
  }, [arquivo]);

  function escolher(f?: File) {
    if (!f) return;
    if (!/\.(pdf|docx)$/i.test(f.name) || f.size > LIMITE_MB * 1024 * 1024) {
      setErro(`Envie um arquivo PDF ou DOCX de até ${LIMITE_MB} MB.`);
      return;
    }
    setErro('');
    setProgresso(0);
    setArquivo(f);
  }

  return (
    <div className="stagger grid grid-cols-[1fr_340px] items-start gap-4 max-lg:grid-cols-1">
      <div className="flex flex-col gap-4">
        <Panel icon={Upload} title="Enviar currículo" bodyClassName="flex flex-col gap-3 p-3.5">
          <div
            onDragOver={e => {
              e.preventDefault();
              setArrastando(true);
            }}
            onDragLeave={() => setArrastando(false)}
            onDrop={e => {
              e.preventDefault();
              setArrastando(false);
              escolher(e.dataTransfer.files[0]);
            }}
            className={`flex flex-col items-center gap-1.5 rounded-[10px] border-2 border-dashed px-3.5 py-[18px] text-center ${arrastando ? 'border-blue-dark bg-blue/10' : 'border-blue/50 bg-panel'}`}
          >
            <span className="flex size-[52px] items-center justify-center rounded-full bg-blue-dark text-white">
              <CloudUpload size={26} aria-hidden />
            </span>
            <p className="text-[15px] font-bold">Arraste seu currículo aqui</p>
            <p className="text-xs text-ink-soft">PDF ou DOCX até {LIMITE_MB} MB — ou clique para selecionar</p>
            <label className="btn btn-secondary mt-1">
              <FolderOpen size={16} aria-hidden />
              Selecionar arquivo
              <input ref={inputRef} type="file" accept=".pdf,.docx" className="sr-only" onChange={e => escolher(e.target.files?.[0])} />
            </label>
          </div>
          {erro && (
            <p role="alert" className="text-xs font-bold text-orange-deep">
              {erro}
            </p>
          )}
          {arquivo && (
            <div className="flex flex-col gap-[5px]">
              <div className="flex items-center gap-2 text-xs">
                <FileText size={14} aria-hidden />
                <span className="font-bold">{arquivo.name}</span>
                <span className="text-ink-soft">{(arquivo.size / 1024 / 1024).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} MB</span>
                <span role="status" className="ml-auto text-[11px] text-blue-dark tabular-nums">
                  {progresso < 100 ? `${progresso}% — enviando...` : 'Enviado'}
                </span>
              </div>
              <div role="progressbar" aria-label="Envio do arquivo" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progresso} className="h-4 rounded-lg border border-panel-border bg-page-bg p-px">
                <div className="h-full rounded-[7px] bg-green-dark" style={{ width: `${progresso}%` }} />
              </div>
            </div>
          )}
        </Panel>

        <Panel icon={FileCheck} title="Currículo principal" tone="slate">
          <form
            key={principalId}
            onSubmit={e => {
              e.preventDefault();
              setSalvo(true);
            }}
            onChange={() => setSalvo(false)}
            className="flex gap-3.5 max-md:flex-col"
          >
            <div aria-hidden className="flex h-[176px] w-[132px] shrink-0 flex-col gap-[5px] rounded border border-panel-border p-3">
              <span className="h-[9px] w-[70px] rounded-sm bg-side-top" />
              <span className="mb-1 h-[5px] w-[48px] rounded-sm bg-panel-border" />
              {linhasPreview.map((w, i) => (
                <span key={i} className="h-1 rounded-sm bg-page-bg" style={{ width: w }} />
              ))}
            </div>
            <div className="flex flex-1 flex-col gap-2.5">
              <div className="grid grid-cols-2 gap-2.5 max-md:grid-cols-1">
                <label>
                  <span className="label">Nome do arquivo</span>
                  <input name="arquivo" defaultValue={principal.arquivo} className="field" />
                </label>
                <label>
                  <span className="label">Cargo alvo</span>
                  <input name="cargo" defaultValue={principal.cargo} className="field" />
                </label>
                <label>
                  <span className="label">Área de atuação</span>
                  <select name="area" defaultValue={principal.area} className="field">
                    {areas.map(a => (
                      <option key={a}>{a}</option>
                    ))}
                  </select>
                </label>
                <label>
                  <span className="label">Nível</span>
                  <select name="nivel" defaultValue={principal.nivel} className="field">
                    {niveis.map(n => (
                      <option key={n}>{n}</option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="label mb-0">Detectado:</span>
                <ul className="contents">
                  {skillsDetectadas.map(s => (
                    <li key={s} className="rounded-[9px] border border-blue/40 bg-blue/10 px-2 py-[3px] text-[11px] font-bold text-blue-deep">
                      {s}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button type="submit" className="btn btn-primary">
                  <Check size={16} aria-hidden />
                  Salvar como principal
                </button>
                <a href="#descricao-vaga" className="btn btn-success">
                  <Sparkles size={16} aria-hidden />
                  Enviar para análise
                </a>
                <button type="button" className="btn btn-secondary">
                  <Download size={16} aria-hidden />
                  Baixar
                </button>
                {salvo && (
                  <p role="status" className="text-xs font-bold text-green-deep">
                    Currículo principal salvo.
                  </p>
                )}
              </div>
            </div>
          </form>
        </Panel>

        <Panel
          icon={SearchCheck}
          title="Revisar para vaga específica"
          tone="purple"
          aside={<span className="rounded bg-amber px-2 py-0.5 text-[10px] font-bold text-ink">NOVO!</span>}
        >
          <div className="grid grid-cols-[1fr_1.9fr] gap-3.5 max-xl:grid-cols-1">
            <div className="flex flex-col gap-2">
              <label htmlFor="descricao-vaga" className="text-xs font-bold">
                Cole aqui a descrição da vaga:
              </label>
              <textarea id="descricao-vaga" rows={12} value={descricao} onChange={e => setDescricao(e.target.value)} className="field flex-1" />
              <button type="button" className="btn btn-purple" disabled={!descricao.trim()} onClick={() => setAnalise(getAnalise(descricao))}>
                <Sparkles size={16} aria-hidden />
                Analisar compatibilidade
              </button>
            </div>
            <div role="region" aria-label="Resultado da análise" className="flex items-center gap-3.5 rounded-lg border border-purple/30 bg-purple/5 p-3 max-md:flex-col">
              <div className="relative size-[132px] shrink-0">
                <svg viewBox="0 0 36 36" aria-hidden className="size-full -rotate-90">
                  <circle cx="18" cy="18" r="15.9155" fill="none" strokeWidth="4" className="stroke-purple/20" />
                  <circle cx="18" cy="18" r="15.9155" fill="none" strokeWidth="4" strokeDasharray={`${analise.compatibilidade} 100`} className="stroke-purple" />
                </svg>
                <p className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-[34px] leading-none font-bold text-purple tabular-nums">{analise.compatibilidade}%</span>
                  <span className="text-[11px]">compatível</span>
                </p>
              </div>
              <div className="flex flex-1 flex-col gap-[7px]">
                <h3 className="text-[13px] font-bold text-purple">Sugestões para melhorar</h3>
                <ul className="flex flex-col gap-[7px]">
                  {analise.sugestoes.map(s => (
                    <li key={s.texto} className="flex items-center gap-[7px] rounded-md border border-panel-border bg-panel px-2 py-1.5 text-xs">
                      {s.ok ? <Check size={14} aria-label="Ok" className="shrink-0 text-green-deep" /> : <Plus size={14} aria-label="Sugestão" className="shrink-0 text-orange-deep" />}
                      {s.texto}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </Panel>
      </div>

      <div className="flex flex-col gap-4">
        <Panel icon={History} title="Histórico de versões" tone="orange" bodyClassName="flex flex-col gap-2.5 p-3.5">
          {getVersoes().map(v => {
            const atual = v.id === versaoAtual;
            return (
              <article key={v.id} className={`flex flex-col gap-[7px] rounded-[7px] border p-2.5 ${atual ? 'border-green-dark ring-1 ring-green-dark' : 'border-panel-border'}`}>
                <div className="flex items-center gap-[7px]">
                  <span className={`flex h-[22px] w-[30px] items-center justify-center rounded-[5px] text-[11px] font-bold ${atual ? 'bg-green-deep text-white' : 'border border-panel-border bg-page-bg'}`}>{v.id}</span>
                  <span className="text-[11px] text-ink-soft tabular-nums">{v.data}</span>
                  {atual && <span className="ml-auto rounded-lg bg-green-deep px-[7px] py-0.5 text-[10px] font-bold text-white">atual</span>}
                </div>
                <p className="text-xs">{v.nota}</p>
                <div className="grid grid-cols-2 gap-1.5">
                  <button type="button" className="btn btn-secondary btn-sm" disabled={atual} onClick={() => setVersaoAtual(v.id)}>
                    <RotateCcw size={14} aria-hidden />
                    Restaurar<span className="sr-only"> {v.id}</span>
                  </button>
                  <button type="button" className="btn btn-secondary btn-sm">
                    <Download size={14} aria-hidden />
                    Baixar<span className="sr-only"> {v.id}</span>
                  </button>
                </div>
              </article>
            );
          })}
        </Panel>

        <Panel icon={FolderOpen} title="Outros currículos" tone="slate" bodyClassName="flex flex-col gap-2.5 p-3.5">
          {outros.length > 0 ? (
            <ul className="flex flex-col gap-2">
              {outros.map(c => (
                <li key={c.id} className="flex items-center gap-2.5 rounded-[7px] border border-panel-border p-2.5">
                  <FileText size={24} strokeWidth={1.5} aria-hidden className="shrink-0 text-ink-soft" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-bold">{c.arquivo}</p>
                    <p className="text-[11px] text-ink-soft">
                      {c.versao} • {c.foco}
                    </p>
                  </div>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => setPrincipalId(c.id)}>
                    Tornar principal<span className="sr-only"> {c.arquivo}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <div className="flex flex-col items-center gap-2 py-6 text-center">
              <span className="flex size-16 items-center justify-center rounded-full border border-panel-border bg-page-bg text-ink-soft">
                <FolderOpen size={28} aria-hidden />
              </span>
              <p className="text-[13px] font-bold">Nenhum outro currículo enviado ainda</p>
              <p className="text-xs text-ink-soft">Envie uma versão alternativa para testar outras áreas de atuação.</p>
            </div>
          )}
          <button type="button" className="btn btn-primary self-center" onClick={() => inputRef.current?.click()}>
            <Plus size={16} aria-hidden />
            Enviar outro currículo
          </button>
        </Panel>
      </div>
    </div>
  );
}
