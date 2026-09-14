import { useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Accessibility, ArrowUp, Bell, Briefcase, Calendar, Camera, Car, Check, CircleCheck, CreditCard, Crown, DollarSign, House, Info, Languages,
  Lightbulb, LogOut, MessageSquare, Pencil, Plane, Plus, Settings, Trash2, User, X, type LucideIcon,
} from 'lucide-react';
import { getFaturas, getNotificacoes, getPerfil, getPerguntas, getPlano } from '../mocks/usuario';

const abas = [
  { id: 'dados', label: 'Meus Dados', icon: User },
  { id: 'perguntas', label: 'Perguntas Automáticas', icon: MessageSquare },
  { id: 'notificacoes', label: 'Notificações', icon: Bell },
  { id: 'conta', label: 'Conta e Assinatura', icon: CreditCard },
];

const iconesPergunta: Record<string, LucideIcon> = {
  salario: DollarSign,
  experiencia: Briefcase,
  viagem: Plane,
  remoto: House,
  cnh: Car,
  inicio: Calendar,
  ingles: Languages,
  pcd: Accessibility,
};

export default function Configuracoes() {
  const [params, setParams] = useSearchParams();
  const [toast, setToast] = useState(false);
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const indice = Math.max(0, abas.findIndex(a => a.id === params.get('tab')));
  const atual = abas[indice].id;

  function ir(i: number) {
    const j = (i + abas.length) % abas.length;
    setParams({ tab: abas[j].id }, { replace: true });
    refs.current[j]?.focus();
  }

  function onKeyDown(e: KeyboardEvent) {
    const alvos: Record<string, number> = { ArrowRight: indice + 1, ArrowLeft: indice - 1, Home: 0, End: abas.length - 1 };
    if (!(e.key in alvos)) return;
    e.preventDefault();
    ir(alvos[e.key]);
  }

  const salvar = () => setToast(true);

  return (
    <div className="stagger flex min-h-full flex-col">
      <div role="tablist" aria-label="Configurações" onKeyDown={onKeyDown} className="flex items-end gap-1 overflow-x-auto px-1.5">
        {abas.map(({ id, label, icon: Icon }, i) => (
          <button
            key={id}
            ref={el => {
              refs.current[i] = el;
            }}
            type="button"
            role="tab"
            id={`tab-${id}`}
            aria-selected={id === atual}
            aria-controls="painel-aba"
            tabIndex={id === atual ? 0 : -1}
            onClick={() => ir(i)}
            className={`-mb-px flex shrink-0 items-center gap-[7px] rounded-t-[9px] border border-b-0 border-panel-border text-[13px] font-bold ${
              id === atual ? 'relative h-[37px] bg-panel px-[18px] text-blue-dark' : 'h-[31px] bg-page-bg px-4 text-ink hover:bg-panel'
            }`}
          >
            <Icon size={15} aria-hidden />
            {label}
          </button>
        ))}
      </div>

      <div role="tabpanel" id="painel-aba" aria-labelledby={`tab-${atual}`} className="relative flex flex-1 flex-col rounded-lg border border-panel-border bg-panel p-[18px]">
        {toast && (
          <div role="status" className="absolute top-3 right-[18px] z-10 flex items-center gap-[9px] rounded-[9px] bg-green-deep px-3.5 py-2.5 text-[13px] font-bold text-white shadow-lg">
            <CircleCheck size={20} aria-hidden />
            Alterações salvas com sucesso!
            <button type="button" aria-label="Fechar aviso" onClick={() => setToast(false)} className="rounded p-0.5 hover:bg-white/15">
              <X size={14} aria-hidden />
            </button>
          </div>
        )}
        {atual === 'dados' && <AbaDados onSalvar={salvar} />}
        {atual === 'perguntas' && <AbaPerguntas onSalvar={salvar} />}
        {(atual === 'notificacoes' || atual === 'conta') && <AbaNotificacoesConta onSalvar={salvar} />}
      </div>
    </div>
  );
}

function Cabecalho({ titulo, sub }: { titulo: string; sub?: string }) {
  return (
    <div className="mb-4 flex items-baseline gap-2.5 border-b border-panel-border pb-3">
      <h2 className="text-lg font-bold">{titulo}</h2>
      {sub && <p className="text-xs text-ink-soft">{sub}</p>}
    </div>
  );
}

function BarraSalvar({ texto, cancelar = true }: { texto: string; cancelar?: boolean }) {
  return (
    <div className="sticky bottom-0 mt-auto flex items-center gap-2.5 rounded-lg border border-panel-border bg-panel px-3.5 py-3">
      <Info size={16} aria-hidden className="shrink-0 text-ink-soft" />
      <p className="flex-1 text-xs text-ink-soft">{texto}</p>
      {cancelar && (
        <button type="reset" className="btn btn-secondary">
          Cancelar
        </button>
      )}
      <button type="submit" className="btn btn-success">
        <Check size={16} aria-hidden />
        Salvar alterações
      </button>
    </div>
  );
}

function Campo({ label, children, className = '' }: { label: string; children: ReactNode; className?: string }) {
  return (
    <label className={className}>
      <span className="label">{label}</span>
      {children}
    </label>
  );
}

function AbaDados({ onSalvar }: { onSalvar: () => void }) {
  const p = getPerfil();
  const [sujo, setSujo] = useState(false);
  const [foto, setFoto] = useState<string | null>(null);

  return (
    <form
      className="flex flex-1 flex-col gap-4"
      onChange={() => setSujo(true)}
      onReset={() => {
        setSujo(false);
        setFoto(null);
      }}
      onSubmit={e => {
        e.preventDefault();
        setSujo(false);
        onSalvar();
      }}
    >
      <Cabecalho titulo="Meus dados" sub="usados pelo robô para preencher formulários das vagas" />
      <div className="flex gap-6 max-md:flex-col">
        <div className="flex w-[190px] shrink-0 flex-col items-center gap-2.5 self-start rounded-lg border border-panel-border p-3.5 max-md:w-full">
          {foto ? (
            <img src={foto} alt="" className="size-[110px] rounded-full object-cover" />
          ) : (
            <span aria-hidden className="flex size-[110px] items-center justify-center rounded-full bg-purple text-3xl font-bold text-white">
              MP
            </span>
          )}
          <p className="text-sm font-bold">{p.nomeCurto}</p>
          <p className="-mt-2 text-[11px] text-ink-soft">{p.cargo}</p>
          <label className="btn btn-secondary btn-sm">
            <Camera size={14} aria-hidden />
            Trocar foto
            <input type="file" accept="image/*" className="sr-only" onChange={e => e.target.files?.[0] && setFoto(URL.createObjectURL(e.target.files[0]))} />
          </label>
        </div>
        <div className="grid flex-1 grid-cols-2 content-start gap-3 max-md:grid-cols-1">
          <Campo label="Nome completo"><input name="nome" autoComplete="name" defaultValue={p.nome} className="field" /></Campo>
          <Campo label="E-mail"><input name="email" type="email" autoComplete="email" defaultValue={p.email} className="field" /></Campo>
          <Campo label="Telefone"><input name="telefone" type="tel" autoComplete="tel" defaultValue={p.telefone} className="field" /></Campo>
          <Campo label="Cidade / Estado">
            <select name="cidade" defaultValue={p.cidade} className="field">
              <option>São Paulo — SP</option>
              <option>Campinas — SP</option>
              <option>Rio de Janeiro — RJ</option>
              <option>Belo Horizonte — MG</option>
            </select>
          </Campo>
          <Campo label="LinkedIn"><input name="linkedin" defaultValue={p.linkedin} className="field" /></Campo>
          <Campo label="GitHub"><input name="github" defaultValue={p.github} className="field" /></Campo>
          <Campo label="Portfólio"><input name="portfolio" autoComplete="url" defaultValue={p.portfolio} className="field" /></Campo>
          <Campo label="Endereço"><input name="endereco" autoComplete="street-address" defaultValue={p.endereco} className="field" /></Campo>
        </div>
      </div>

      <section aria-labelledby="dados-extra" className="flex flex-col gap-3 border-t border-panel-border pt-3.5">
        <h3 id="dados-extra" className="text-sm font-bold">Dados complementares</h3>
        <div className="grid grid-cols-4 gap-3 max-lg:grid-cols-2 max-md:grid-cols-1">
          <Campo label="CPF"><input name="cpf" inputMode="numeric" defaultValue={p.cpf} className="field tabular-nums" /></Campo>
          <Campo label="Data de nascimento"><input name="nascimento" type="date" autoComplete="bday" defaultValue={p.nascimento} className="field" /></Campo>
          <Campo label="Disponibilidade">
            <select name="disponibilidade" defaultValue={p.disponibilidade} className="field">
              <option>Imediata</option>
              <option>15 dias</option>
              <option>30 dias</option>
            </select>
          </Campo>
          <Campo label="PcD">
            <select name="pcd" defaultValue={p.pcd} className="field">
              <option>Não</option>
              <option>Sim</option>
            </select>
          </Campo>
        </div>
        <div className="grid grid-cols-3 gap-3 max-lg:grid-cols-1">
          <Campo label="Escolaridade">
            <select name="escolaridade" defaultValue={p.escolaridade} className="field">
              <option>Superior completo — Ciência da Computação</option>
              <option>Superior incompleto</option>
              <option>Técnico</option>
              <option>Ensino médio</option>
            </select>
          </Campo>
          <Campo label="Idiomas"><input name="idiomas" defaultValue={p.idiomas} className="field" /></Campo>
          <Campo label="Pretensão salarial"><input name="pretensao" defaultValue={p.pretensao} className="field" /></Campo>
        </div>
        <p className="flex w-[440px] max-w-full gap-2.5 rounded-[10px] border border-amber bg-amber/15 p-3 text-xs text-amber-ink">
          <Lightbulb size={18} aria-hidden className="shrink-0" />
          Dica: mantenha seus dados atualizados — o robô usa estas informações para preencher os formulários das vagas automaticamente.
        </p>
      </section>

      <BarraSalvar texto={sujo ? 'Você tem alterações não salvas nesta aba.' : 'Alterações são aplicadas ao salvar.'} />
    </form>
  );
}

function AbaPerguntas({ onSalvar }: { onSalvar: () => void }) {
  const [perguntas, setPerguntas] = useState(getPerguntas);

  return (
    <form
      className="flex flex-1 flex-col gap-4"
      onReset={() => setPerguntas(getPerguntas())}
      onSubmit={e => {
        e.preventDefault();
        onSalvar();
      }}
    >
      <Cabecalho titulo="Perguntas automáticas" sub="respostas que o robô usa ao preencher formulários das plataformas" />
      <ul className="flex flex-col gap-2">
        {perguntas.map(q => {
          const Icon = iconesPergunta[q.icone] ?? MessageSquare;
          const idResposta = `resposta-${q.id}`;
          return (
            <li key={q.id} className="flex items-center gap-3 rounded-[7px] border border-panel-border p-2.5 max-md:flex-wrap">
              <span aria-hidden className="flex size-[30px] shrink-0 items-center justify-center rounded-lg bg-blue-dark text-white">
                <Icon size={16} />
              </span>
              {q.personalizada ? (
                <input aria-label="Pergunta personalizada" placeholder="Digite a pergunta" defaultValue={q.pergunta} className="field w-[280px] font-bold" />
              ) : (
                <label htmlFor={idResposta} className="w-[280px] text-[13px] font-bold">
                  {q.pergunta}
                </label>
              )}
              <input id={idResposta} name={idResposta} aria-label={q.personalizada ? 'Resposta' : undefined} defaultValue={q.resposta} className="field min-w-[160px] flex-1" />
              <button type="button" aria-label={`Editar resposta: ${q.pergunta || 'pergunta personalizada'}`} onClick={() => document.getElementById(idResposta)?.focus()} className="btn btn-secondary size-[26px] p-0">
                <Pencil size={14} aria-hidden />
              </button>
              <button
                type="button"
                aria-label={`Excluir pergunta: ${q.pergunta || 'pergunta personalizada'}`}
                onClick={() => setPerguntas(ps => ps.filter(x => x.id !== q.id))}
                className="btn btn-secondary size-[26px] p-0 text-orange-deep"
              >
                <Trash2 size={14} aria-hidden />
              </button>
            </li>
          );
        })}
      </ul>
      <button
        type="button"
        className="btn btn-primary self-start"
        onClick={() => setPerguntas(ps => [...ps, { id: Date.now(), icone: '', pergunta: '', resposta: '', personalizada: true }])}
      >
        <Plus size={16} aria-hidden />
        Adicionar pergunta personalizada
      </button>
      <BarraSalvar texto="O robô responde automaticamente apenas as perguntas preenchidas acima." />
    </form>
  );
}

function AbaNotificacoesConta({ onSalvar }: { onSalvar: () => void }) {
  const plano = getPlano();
  const uso = Math.round((plano.usados / plano.limite) * 100);

  return (
    <div className="grid flex-1 grid-cols-[1fr_420px] gap-[18px] max-lg:grid-cols-1">
      <form
        className="flex flex-col gap-3.5"
        onSubmit={e => {
          e.preventDefault();
          onSalvar();
        }}
      >
        <Cabecalho titulo="Notificações" sub="avisos do robô" />
        <ul className="flex flex-col gap-3.5">
          {getNotificacoes().map(n => (
            <li key={n.id}>
              <label className="flex items-center gap-3 rounded-[7px] border border-panel-border p-[11px]">
                <span className="flex-1">
                  <span className="block text-[13px] font-bold">{n.titulo}</span>
                  <span className="block text-[11px] text-ink-soft">{n.descricao}</span>
                </span>
                <input type="checkbox" role="switch" name={n.id} defaultChecked={n.ativo} className="switch" />
              </label>
            </li>
          ))}
        </ul>
        <BarraSalvar texto="Alterações são aplicadas ao salvar." cancelar={false} />
      </form>

      <section aria-labelledby="conta-titulo" className="flex flex-col gap-3.5">
        <div className="mb-0.5 border-b border-panel-border pb-3">
          <h2 id="conta-titulo" className="text-lg font-bold">
            Conta e assinatura
          </h2>
        </div>
        <div className="flex flex-col gap-3 rounded-[10px] border border-blue/40 bg-blue/5 p-4">
          <div className="flex items-center gap-3">
            <span aria-hidden className="flex size-11 items-center justify-center rounded-xl bg-blue-dark text-white">
              <Crown size={22} />
            </span>
            <div>
              <p className="text-lg font-bold text-blue-deep">{plano.nome}</p>
              <p className="text-xs text-blue-deep">
                {plano.preco} — renova em {plano.renova}
              </p>
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <div className="flex text-xs font-bold text-blue-deep tabular-nums">
              <span>
                {plano.usados} de {plano.limite} envios utilizados este mês
              </span>
              <span className="ml-auto">{uso}%</span>
            </div>
            <div role="progressbar" aria-label="Envios utilizados este mês" aria-valuemin={0} aria-valuemax={plano.limite} aria-valuenow={plano.usados} className="h-[18px] rounded-[9px] border border-panel-border bg-panel p-0.5">
              <div className="h-full rounded-[7px] bg-blue-dark" style={{ width: `${uso}%` }} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" className="btn btn-success">
              <ArrowUp size={16} aria-hidden />
              Fazer upgrade
            </button>
            <button type="button" className="btn btn-secondary">
              <Settings size={16} aria-hidden />
              Gerenciar plano
            </button>
          </div>
        </div>
        <div className="rounded-lg border border-panel-border p-3.5">
          <h3 className="mb-2 text-[13px] font-bold">Últimas faturas</h3>
          <ul>
            {getFaturas().map(f => (
              <li key={f.data} className="flex items-center gap-2 border-b border-panel-border/60 py-1.5 text-xs last:border-0">
                <span className="flex-1 tabular-nums">{f.data}</span>
                <span className="font-bold tabular-nums">{f.valor}</span>
                <span className="rounded-lg bg-green-deep px-2 py-0.5 text-[10px] font-bold text-white">Paga</span>
              </li>
            ))}
          </ul>
        </div>
        <button type="button" className="btn btn-secondary mt-auto w-full">
          <LogOut size={16} aria-hidden />
          Encerrar assinatura
        </button>
      </section>
    </div>
  );
}
