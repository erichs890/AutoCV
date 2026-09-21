import { useState, type FormEvent } from 'react';
import { ShieldAlert, Trash2 } from 'lucide-react';
import { BotaoSalvar } from '../components/BotaoSalvar';
import { useEstado } from '../estado';
import { CATEGORIAS_SENSIVEIS, categoriaSensivel, type ModoSensivel } from '../sensiveis';

const OUTRA = '__outra__';

const MODOS: { id: ModoSensivel; titulo: string; texto: string }[] = [
  {
    id: 'perguntar',
    titulo: 'Sempre pausar e me perguntar',
    texto: 'O robô nunca responde sozinho. A cada pergunta desse tipo ele para e espera sua escolha, que fica guardada só para aquela pergunta exata.',
  },
  {
    id: 'prefiro_nao',
    titulo: 'Marcar "Prefiro não responder" quando der',
    texto: 'Se a pergunta for opcional e tiver essa opção, o robô a escolhe. Se for obrigatória ou não tiver a opção, ele pausa e pergunta.',
  },
  {
    id: 'padrao',
    titulo: 'Usar minhas respostas padrão por tipo',
    texto: 'Você define abaixo a resposta para cada tipo de pergunta. Quando a resposta não bater com nenhuma opção da vaga, o robô pausa e pergunta.',
  },
];

export default function ConfigSensiveis({ onSalvar }: { onSalvar: (t: string) => void }) {
  const { estado, salvar } = useEstado();
  const [modo, setModo] = useState<ModoSensivel>(estado.sensiveis.modo);
  const [padroes, setPadroes] = useState<Record<string, string>>(estado.sensiveis.padroes);
  const literais = estado.perguntas.filter(p => p.resposta.trim() && categoriaSensivel(p.pergunta));
  const temPadrao = Object.values(padroes).some(v => v.trim());

  async function enviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const limpos = Object.fromEntries(
      Object.entries(padroes)
        .map(([k, v]) => [k, v.trim()])
        .filter(([, v]) => v),
    );
    await salvar({ sensiveis: { modo, padroes: limpos } });
    onSalvar('Política de autodeclaração salva.');
  }

  /** Escolher uma resposta já liga o modo que a usa: senão o usuário define e nada acontece. */
  function definir(id: string, valor: string) {
    setPadroes(p => ({ ...p, [id]: valor }));
    if (valor.trim() && modo !== 'padrao') setModo('padrao');
  }

  async function esquecer(id: number) {
    await salvar({ perguntas: estado.perguntas.filter(p => p.id !== id) });
    onSalvar('Resposta apagada.');
  }

  return (
    <form
      className="flex flex-1 flex-col gap-4"
      onSubmit={enviar}
      onReset={() => {
        setModo(estado.sensiveis.modo);
        setPadroes(estado.sensiveis.padroes);
      }}
    >
      <div>
        <h2 className="text-base font-bold">Autodeclaração e dados sensíveis</h2>
        <p className="text-xs text-ink-soft">
          Identidade de gênero, orientação sexual, cor/raça, deficiência, religião, saúde e grupos de diversidade. Essas perguntas nunca são respondidas por semelhança com outras: só pela sua escolha
          explícita para a pergunta exata ou pela regra abaixo. O robô também nunca deduz uma resposta a partir do seu nome, foto ou currículo.
        </p>
      </div>

      <div className="rounded-lg border border-amber bg-amber/15 p-3 text-xs text-amber-ink">
        <ShieldAlert size={14} aria-hidden className="mr-1 inline" />
        Tudo o que você definir aqui fica só neste computador e é usado apenas para preencher esse tipo de campo quando ele aparecer numa vaga.
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="label mb-1">Quando uma vaga fizer uma pergunta desse tipo</legend>
        {MODOS.map(m => (
          <label key={m.id} className={`flex items-start gap-2.5 rounded-[7px] border p-3 ${modo === m.id ? 'border-blue-dark bg-blue-dark/5' : 'border-panel-border'}`}>
            <input type="radio" name="modo" value={m.id} checked={modo === m.id} onChange={() => setModo(m.id)} className="mt-0.5 size-4" />
            <span>
              <span className="block text-[13px] font-bold">{m.titulo}</span>
              <span className="block text-[11px] text-ink-soft">{m.texto}</span>
            </span>
          </label>
        ))}
      </fieldset>

      <div className="flex flex-col gap-2">
        <p className="label">Suas respostas, por tipo de pergunta</p>
        <p className="text-[11px] text-ink-soft">
          Escolha na lista — são as opções como as vagas costumam escrever, e o robô casa com a variação de cada formulário. Deixe em "Perguntar toda vez" para não responder sozinho. Definir qualquer
          uma aqui já liga o modo <strong>"usar minhas respostas"</strong>.
        </p>
        <ul className="grid grid-cols-2 gap-2.5 max-md:grid-cols-1">
          {CATEGORIAS_SENSIVEIS.map(c => {
            const valor = padroes[c.id] ?? '';
            const naLista = !valor || c.opcoesComuns.includes(valor);
            return (
              <li key={c.id} className="rounded-[7px] border border-panel-border p-2.5">
                <label className="flex flex-col gap-1">
                  <span className="text-xs font-bold">{c.rotulo}</span>
                  <span className="text-[10px] text-ink-soft">ex.: {c.exemplo}</span>
                  <select value={naLista ? valor : OUTRA} onChange={e => definir(c.id, e.target.value === OUTRA ? ' ' : e.target.value)} className="field">
                    <option value="">Perguntar toda vez</option>
                    {c.opcoesComuns.map(o => (
                      <option key={o} value={o}>
                        {o}
                      </option>
                    ))}
                    <option value={OUTRA}>Outra resposta…</option>
                  </select>
                </label>
                {!naLista && (
                  <input
                    value={valor.trim()}
                    onChange={e => definir(c.id, e.target.value)}
                    placeholder="Escreva como aparece na vaga"
                    aria-label={`Outra resposta para ${c.rotulo}`}
                    className="field mt-1.5"
                  />
                )}
              </li>
            );
          })}
        </ul>
        {temPadrao && modo !== 'padrao' && (
          <p className="rounded-lg border border-amber bg-amber/15 p-2.5 text-[11px] text-amber-ink">
            Você definiu respostas acima, mas o modo escolhido não as usa. Selecione <strong>"Usar minhas respostas padrão por tipo"</strong> para o robô responder sozinho.
          </p>
        )}
      </div>

      <div className="flex flex-col gap-2 border-t border-panel-border pt-3.5">
        <p className="label">Respostas que você já deu a perguntas exatas</p>
        {literais.length === 0 ? (
          <p className="text-[11px] text-ink-soft">
            Nenhuma ainda. Quando você responder uma pergunta de autodeclaração numa candidatura e escolher guardar, ela aparece aqui e vale só para a mesma pergunta, palavra por palavra.
          </p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {literais.map(p => (
              <li key={p.id} className="flex items-center gap-3 rounded-[7px] border border-panel-border p-2.5 text-xs">
                <span className="flex-1">
                  <span className="block font-bold">{p.pergunta}</span>
                  <span className="block text-ink-soft">{p.resposta}</span>
                </span>
                <button type="button" aria-label={`Apagar resposta: ${p.pergunta}`} className="btn btn-secondary size-[26px] p-0 text-orange-deep" onClick={() => esquecer(p.id)}>
                  <Trash2 size={14} aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="sticky bottom-0 mt-auto flex items-center gap-2.5 rounded-lg border border-panel-border bg-panel px-3.5 py-3">
        <p className="flex-1 text-xs text-ink-soft">A regra vale para as próximas candidaturas; as que já estão pausadas continuam esperando sua resposta.</p>
        <button type="reset" className="btn btn-secondary">
          Cancelar
        </button>
        <BotaoSalvar>Salvar</BotaoSalvar>
      </div>
    </form>
  );
}
