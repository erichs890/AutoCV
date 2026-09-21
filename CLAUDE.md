# AutoCV

App local que acha vagas (InHire, Indeed, Vagas PJ) e candidata sozinho. Front Vite/React (`src/`) + núcleo Node/Playwright/SQLite (`core/`). PT-BR em tudo: código, comentários, UI, commits.

## Rodar

`npm run core` (núcleo, :4780) + `npm run dev` (UI, :5173) — ou `start.bat`. Dados em `%LOCALAPPDATA%\AutoCV`.
Antes de commitar: `npm run check` (50 verificações) e `npm run build` (biome + tsc + vite).

## Fluxo

varredura → score → fila → `executarCandidatura` → adapter → **preencher, anexar, enviar, só então confirmar**.

- `core/queue.ts` — trabalhador serial: encadeia vagas até um portão fechar (robô, modo, janela, intervalo, limite/dia). `rodando` ≠ `ocupado`. Pendência pausa **só aquela vaga**.
- `core/candidatura.ts` — uma candidatura ponta a ponta. `jaCandidatado()` trava duplicata por **empresa + título** (o InHire republica a mesma vaga com outro id).
- `core/platforms/inhire/formulario.ts` — motor adaptativo usado por **todas** as plataformas: descobre campos do DOM a cada etapa, classifica fixo × pergunta extra, preenche, avança. Nunca supõe layout. Cada plataforma passa as suas `Convencoes` (textos dos botões e da confirmação); campo fixo se reconhece pelo `name=`, nunca pelo rótulo.
- `core/localizacao.ts` — cidade/UF/país e a regra de compatibilidade de lugar. **Uma só, para todas as plataformas**: presencial/híbrida fora do estado ou do país zera; outra cidade do estado perde 40%; remota restrita a país não escolhido zera.
- `core/platforms/vagaspj/` — vagas PJ: lista pelo feed RSS + JSON-LD de cada página (só HTTP), candidatura num formulário de uma etapa. Um anúncio se intromete entre o botão final e o POST (`aposBotaoFinal`).
- `core/falhas.ts` — falha transitória volta à fila (2/10/30 min, 3x); captcha/vaga encerrada/recusa do servidor, não.

## Invariantes

1. **Sucesso é a resposta HTTP**, não texto na tela: 2xx em `ROTAS_ENVIO` = enviada. Texto muda, API não. Nunca reportar erro depois de um envio comprovado; nunca clicar no botão final duas vezes.
2. **Nunca inventar nada no currículo.** `validarAdaptacao` compara palavra a palavra; qualquer termo novo descarta a adaptação e manda o original.
3. **Autodeclaração** (gênero, raça, PcD, religião, saúde) nunca sai de similaridade, de currículo nem de IA — só da escolha explícita do usuário (`src/sensiveis.ts`).
4. **Uma vaga, uma candidatura.** Em qualquer caminho: fila, clique manual, retomada de pendência.
5. **Ensaio não envia.** As rotas de envio ficam abortadas no navegador.

## Uma fonte por campo

| Dado | Dono |
|---|---|
| nome, e-mail, celular, LinkedIn, CPF, cidade, pretensão, **cargo desejado** | `perfil` (Configurações › Meus Dados) |
| senioridade, área, rigor de função | `automacao` — editável **só** em Configurações; Automação espelha |
| cidade (presencial/híbrida) e países aceitos (remota) | `perfil.cidade` + `perfil.paisesRemoto` → `ler.localizacao()` |
| ritmo, limite, janela, modo, ensaio, adaptação, modo de perguntas | `automacao` (Automação) |
| plataforma ligada | `conexoes` |
| respostas de autodeclaração | `sensiveis` |
| perguntas das empresas | `perguntas` |

Nunca criar um segundo lugar que edite o mesmo campo. Campo que a UI mostra e o núcleo não lê é mentira: ou implementa, ou remove.

## Score (`core/resume/score.ts`)

Competências (60) + título (40), multiplicado por função, área, senioridade e local. Decisões que já custaram caro:

- Função é comparada por **família** (`FAMILIAS_CARGO`), não por semelhança de texto — "Analista de Processos" tinha 0,42 de similaridade com "Desenvolvedor Full Stack". Famílias afins (dev, IA, QA, dados, segurança) contam como a mesma.
- Competência conta dos **dois lados**: vaga genérica que cita "sql, rest, testes" não pode dar 100%.
- Senioridade do currículo é o nível **mais alto** (`inferirSenioridadeDoCurriculo`) — `inferirSenioridade` é para vaga e pega o mais baixo.
- Localização não se duplica: use `vagaCompativelComLocalizacao` de `core/localizacao.ts`.
- Mexeu no score? Suba `SCORE_VERSAO` em `core/server.ts`.

## Ao mexer

Teste primeiro em `core/self-check.ts` (puro), `core/fila-check.ts` (fila com adapter falso) ou `core/envio-check.ts` (InHire falso local). Bug achado = cenário novo.
Nada de dependência nova sem necessidade real. Histórico e decisões em `agentlog.md` — registre lá o que mudou e **por quê**.
