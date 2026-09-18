import { useState, type FormEvent } from 'react';
import { Check, Eye, EyeOff, PlugZap, Sparkles } from 'lucide-react';
import type { ProvedorIA } from '../types';
import { useEstado } from '../estado';
import { post } from '../api';

// Aba "Inteligência artificial" das Configurações: provedor, modelo e chave usados na adaptação do currículo
const PROVEDORES: { id: ProvedorIA; nome: string; padrao: string; opcoes: string[]; ajuda: string }[] = [
  { id: 'nenhum', nome: 'Nenhuma — só regras', padrao: '', opcoes: [], ajuda: 'Reordena e destaca o que já está no currículo. Não precisa de chave.' },
  { id: 'gemini', nome: 'Google Gemini', padrao: 'gemini-2.5-flash', opcoes: ['gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-2.0-flash'], ajuda: 'Chave em aistudio.google.com/apikey. O modelo recomendado é o gemini-2.5-flash.' },
  { id: 'anthropic', nome: 'Anthropic Claude', padrao: 'claude-opus-5', opcoes: ['claude-opus-5', 'claude-sonnet-5', 'claude-haiku-4-5'], ajuda: 'Chave em console.anthropic.com. O padrão é o claude-opus-5.' },
];

export default function ConfigIA({ onSalvar }: { onSalvar: (t: string) => void }) {
  const { estado } = useEstado();
  const [provedor, setProvedor] = useState<ProvedorIA>(estado.ia.provedor);
  const [modelo, setModelo] = useState(estado.ia.modelo);
  const [chave, setChave] = useState('');
  const [mostrar, setMostrar] = useState(false);
  const [teste, setTeste] = useState<{ ok: boolean; msg: string } | null>(null);
  const [testando, setTestando] = useState(false);

  const info = PROVEDORES.find(p => p.id === provedor)!;
  const mudouProvedor = provedor !== estado.ia.provedor;
  const precisaChave = provedor !== 'nenhum' && !estado.ia.chaveDefinida && !chave.trim();

  function trocarProvedor(p: ProvedorIA) {
    setProvedor(p);
    setModelo(p === estado.ia.provedor ? estado.ia.modelo : (PROVEDORES.find(x => x.id === p)?.padrao ?? ''));
    setTeste(null);
  }

  async function salvar(e: FormEvent) {
    e.preventDefault();
    if (precisaChave) return setTeste({ ok: false, msg: 'Cole a chave da IA antes de salvar.' });
    await post('/ia', { provedor, modelo, chave: chave.trim() || undefined });
    setChave('');
    setTeste(null);
    onSalvar('Configuração de IA salva.');
  }

  async function testar() {
    setTestando(true);
    try {
      if (chave.trim() || mudouProvedor || modelo !== estado.ia.modelo) await post('/ia', { provedor, modelo, chave: chave.trim() || undefined });
      setChave('');
      setTeste(await post<{ ok: boolean; msg: string }>('/ia/testar'));
    } finally {
      setTestando(false);
    }
  }

  return (
    <form className="flex flex-1 flex-col gap-4" onSubmit={salvar}>
      <div className="mb-0 flex flex-wrap items-baseline gap-x-2.5 gap-y-1 border-b border-panel-border pb-3">
        <h2 className="text-lg font-bold">Inteligência artificial</h2>
        <p className="text-xs text-ink-soft">usada só para reescrever o currículo por vaga</p>
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="label">Qual IA usar</legend>
        <div className="grid grid-cols-3 gap-2.5 max-md:grid-cols-1">
          {PROVEDORES.map(p => (
            <label key={p.id} className="flex items-start gap-2.5 rounded-[7px] border border-panel-border p-3 hover:border-ink-soft has-checked:border-blue-dark has-checked:ring-1 has-checked:ring-blue-dark">
              <input type="radio" name="provedor" checked={provedor === p.id} onChange={() => trocarProvedor(p.id)} className="mt-0.5 size-[17px]" />
              <span>
                <span className="block text-xs font-bold">{p.nome}</span>
                <span className="block text-[11px] text-ink-soft">{p.ajuda}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      {provedor !== 'nenhum' && (
        <div className="grid grid-cols-2 gap-3 max-md:grid-cols-1">
          <label>
            <span className="label">Modelo</span>
            <input list="modelos-ia" value={modelo} onChange={e => setModelo(e.target.value)} placeholder={info.padrao} className="field font-mono" />
            <datalist id="modelos-ia">
              {info.opcoes.map(m => (
                <option key={m} value={m} />
              ))}
            </datalist>
          </label>
          <label>
            <span className="label">Chave da IA {estado.ia.chaveDefinida && !mudouProvedor && <span className="font-normal">— guardada (termina em …{estado.ia.chaveFinal}); cole outra para trocar</span>}</span>
            <span className="relative block">
              <input
                type={mostrar ? 'text' : 'password'}
                value={chave}
                onChange={e => setChave(e.target.value)}
                autoComplete="off"
                spellCheck={false}
                placeholder={estado.ia.chaveDefinida && !mudouProvedor ? '••••••••••••' : provedor === 'gemini' ? 'AIza...' : 'sk-ant-...'}
                className="field pr-9 font-mono"
              />
              <button type="button" aria-label={mostrar ? 'Ocultar chave' : 'Mostrar chave'} onClick={() => setMostrar(m => !m)} className="absolute top-1/2 right-2 -translate-y-1/2 rounded p-1 text-ink-soft hover:text-ink">
                {mostrar ? <EyeOff size={15} aria-hidden /> : <Eye size={15} aria-hidden />}
              </button>
            </span>
          </label>
        </div>
      )}

      <div className="rounded-lg border border-amber bg-amber/15 p-3 text-xs text-amber-ink">
        <p className="mb-1 font-bold">O que a IA pode e não pode fazer</p>
        <p>
          Ela só reordena, reescreve frases com termos da vaga quando sua experiência já sustenta e ajusta o resumo. Depois, o AutoCV confere o texto: qualquer competência, número, sigla ou nome que não
          esteja no seu currículo original faz a reescrita ser descartada — aí entra a adaptação por regras. A chave fica gravada só neste computador e é usada apenas para essas chamadas.
        </p>
      </div>

      {teste && (
        <p role="status" className={`text-xs font-bold ${teste.ok ? 'text-green-deep' : 'text-orange-deep'}`}>
          {teste.msg}
        </p>
      )}

      <div className="sticky bottom-0 mt-auto flex flex-wrap items-center gap-2.5 rounded-lg border border-panel-border bg-panel px-3.5 py-3">
        <Sparkles size={16} aria-hidden className="shrink-0 text-ink-soft" />
        <p className="flex-1 text-xs text-ink-soft">
          {estado.ia.provedor === 'nenhum' ? 'Hoje a adaptação é só por regras.' : `Hoje: ${estado.ia.provedor === 'gemini' ? 'Gemini' : 'Claude'} · ${estado.ia.modelo}${estado.ia.chaveDefinida ? '' : ' · sem chave'}`}
        </p>
        {provedor !== 'nenhum' && (
          <button type="button" className="btn btn-secondary" disabled={testando || precisaChave} onClick={testar}>
            <PlugZap size={16} aria-hidden />
            {testando ? 'Testando...' : 'Testar conexão'}
          </button>
        )}
        <button type="submit" className="btn btn-success">
          <Check size={16} aria-hidden />
          Salvar
        </button>
      </div>
    </form>
  );
}
