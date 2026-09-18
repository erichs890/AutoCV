import { useState, type FormEvent } from 'react';
import { Building2, Plug, Plus, Trash2, Unplug } from 'lucide-react';
import Modal from '../components/Modal';
import { useEstado } from '../estado';
import { PLATAFORMAS, extrairTenant } from '../dados';

export default function Plataformas() {
  const { estado, salvar, registrar } = useEstado();
  const [aberto, setAberto] = useState(false);
  const [tenants, setTenants] = useState<string[]>([]);
  const [erro, setErro] = useState('');

  const conectadas = Object.keys(estado.conexoes).length;
  const conexaoInhire = estado.conexoes.inhire;

  function abrir() {
    setTenants(estado.automacao.tenants);
    setErro('');
    setAberto(true);
  }

  function adicionar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const campo = e.currentTarget.elements.namedItem('empresa') as HTMLInputElement;
    const t = extrairTenant(campo.value);
    if (!t) return setErro('Informe o nome da empresa como aparece em <empresa>.inhire.app.');
    if (tenants.includes(t)) return setErro('Essa empresa já está na lista.');
    setTenants([...tenants, t]);
    setErro('');
    campo.value = '';
  }

  async function confirmar() {
    if (!tenants.length) return setErro('Adicione pelo menos uma empresa.');
    await salvar({
      conexoes: { ...estado.conexoes, inhire: { conectadaEm: conexaoInhire?.conectadaEm ?? new Date().toISOString() } },
      automacao: { ...estado.automacao, tenants, plataformas: Array.from(new Set([...estado.automacao.plataformas, 'inhire'])) },
    });
    registrar('sucesso', `InHire conectado: ${tenants.length} empresa(s) para acompanhar.`);
    setAberto(false);
  }

  async function desconectar() {
    const { inhire: _fora, ...resto } = estado.conexoes;
    await salvar({ conexoes: resto, automacao: { ...estado.automacao, tenants: [], plataformas: estado.automacao.plataformas.filter(p => p !== 'inhire') } });
    registrar('alerta', 'InHire desconectado.');
  }

  return (
    <div className="stagger flex flex-col gap-4">
      <div className="rounded-lg border border-panel-border bg-panel px-3 py-[9px]">
        <p className="text-[13px] font-bold">
          {conectadas} {conectadas === 1 ? 'plataforma conectada' : 'plataformas conectadas'}{' '}
          <span className="text-xs font-normal text-ink-soft">• por enquanto só o InHire está disponível; as outras chegam como plugins</span>
        </p>
      </div>

      <ul className="grid grid-cols-4 gap-3.5 max-lg:grid-cols-2 max-md:grid-cols-1">
        {PLATAFORMAS.map(p => {
          const conexao = estado.conexoes[p.id];
          return (
            <li key={p.id} className={`flex min-h-[150px] flex-col gap-2.5 rounded-lg border border-panel-border bg-panel p-3 ${p.disponivel ? '' : 'opacity-60'}`} aria-disabled={!p.disponivel}>
              <div className="flex items-center gap-2.5">
                <span aria-hidden className={`flex size-[42px] shrink-0 items-center justify-center rounded-[10px] text-[17px] font-bold text-white ${p.disponivel ? p.cor : 'bg-ink-soft/50'}`}>
                  {p.sigla}
                </span>
                <div className="flex flex-col items-start gap-1">
                  <h3 className="text-[15px] font-bold">{p.nome}</h3>
                  <span
                    className={`inline-flex items-center gap-[5px] rounded-[9px] px-2 py-0.5 text-[10px] font-bold ${
                      conexao ? 'bg-green-deep text-white' : 'border border-panel-border bg-page-bg text-ink'
                    }`}
                  >
                    <span aria-hidden className="size-1.5 rounded-full bg-current" />
                    {conexao ? 'Conectado' : p.disponivel ? 'Não conectado' : 'Indisponível'}
                  </span>
                </div>
              </div>
              <p className="text-xs text-ink-soft">
                {p.id === 'inhire'
                  ? conexao
                    ? `${estado.automacao.tenants.length} empresa(s): ${estado.automacao.tenants.join(', ')}`
                    : 'Páginas de vagas públicas, sem login. Você escolhe as empresas que quer acompanhar.'
                  : 'Integração ainda não implementada.'}
              </p>
              <div className="mt-auto grid grid-cols-2 gap-2">
                {p.id === 'inhire' && conexao ? (
                  <>
                    <button type="button" className="btn btn-secondary btn-sm" onClick={abrir}>
                      <Building2 size={14} aria-hidden />
                      Empresas
                    </button>
                    <button type="button" className="btn btn-secondary btn-sm" onClick={desconectar}>
                      <Unplug size={14} aria-hidden />
                      Desconectar
                    </button>
                  </>
                ) : (
                  <button type="button" className="btn btn-success btn-sm col-span-2" disabled={!p.disponivel} onClick={abrir}>
                    <Plug size={14} aria-hidden />
                    {p.disponivel ? 'Conectar' : 'Indisponível'}
                    <span className="sr-only"> {p.nome}</span>
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      <Modal
        aberto={aberto}
        onFechar={() => setAberto(false)}
        icon={Plug}
        titulo="Conectar plataforma — InHire"
        rodape={
          <>
            <button type="button" className="btn btn-secondary" onClick={() => setAberto(false)}>
              Cancelar
            </button>
            <button type="button" className="btn btn-primary" onClick={confirmar}>
              <Plug size={16} aria-hidden />
              Salvar empresas
            </button>
          </>
        }
      >
        <p className="text-xs text-ink-soft">
          O InHire não tem uma busca geral: cada empresa publica as vagas em <code className="font-mono">empresa.inhire.app/vagas</code>. Cole aqui o endereço (ou só o nome) das empresas que
          quer acompanhar.
        </p>
        <form onSubmit={adicionar} className="flex gap-2">
          <input name="empresa" type="text" placeholder="ex.: vagasbyintera ou https://vagasbyintera.inhire.app/vagas" aria-label="Empresa no InHire" className="field flex-1" />
          <button type="submit" className="btn btn-secondary">
            <Plus size={16} aria-hidden />
            Adicionar
          </button>
        </form>
        {erro && (
          <p role="alert" className="text-xs font-bold text-orange-deep">
            {erro}
          </p>
        )}
        <ul className="flex flex-col gap-1.5">
          {tenants.map(t => (
            <li key={t} className="flex items-center gap-2 rounded-md border border-panel-border px-2.5 py-1.5 text-xs">
              <span className="flex-1 font-mono">{t}.inhire.app</span>
              <button type="button" aria-label={`Remover ${t}`} onClick={() => setTenants(tenants.filter(x => x !== t))} className="btn btn-secondary size-6 p-0 text-orange-deep">
                <Trash2 size={13} aria-hidden />
              </button>
            </li>
          ))}
          {tenants.length === 0 && <li className="text-xs text-ink-soft">Nenhuma empresa ainda.</li>}
        </ul>
      </Modal>
    </div>
  );
}
