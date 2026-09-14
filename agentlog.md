# AutoCV — Agent Log

Contexto do projeto para quem (humano ou agente) for continuar o trabalho. Leia antes de mexer no código.

---

## 1. O produto

**AutoCV** é uma plataforma web brasileira de **envio automático de currículos**. A pessoa conecta suas contas nas plataformas de vagas (LinkedIn, Catho, Gupy, InfoJobs, Vagas.com, Indeed, Glassdoor, Trampos.co), sobe o currículo, define critérios de busca e liga um "robô". O robô procura vagas compatíveis, preenche formulários, responde perguntas padrão e envia o currículo sozinho, respeitando limites e intervalos.

- **Público:** profissionais brasileiros em recolocação, perfil técnico júnior/pleno. Usam mais no desktop; no mobile, só acompanham o status.
- **Tom:** ferramenta de trabalho, estética de "painel de controle". Denso e informativo, sem animação decorativa.
- **Idioma:** 100% português do Brasil. Datas `DD/MM`, horas 24h, milhar com ponto (`1.247`), `%` colado.
- **Usuária de exemplo nos mocks:** Marina Pitanga.

## 2. Stack

| Camada | Escolha |
|---|---|
| UI | React 18 + TypeScript (strict) |
| Build | Vite 8 |
| Estilo | Tailwind CSS v4, tokens em `@theme` (`src/index.css`) |
| Rotas | React Router 7 (`BrowserRouter`) |
| Ícones | lucide-react |
| Fonte | PT Sans 400/700 (Google Fonts, em `index.html`) |
| Banco (planejado) | Supabase (Postgres + Auth + Storage) |

**Regras fixas:** sem biblioteca de componentes, sem biblioteca de gráficos (as barras são `div`s com altura/largura em %), sem Redux/Zustand (só `useState`/`useReducer`), sem biblioteca de formulário (controles nativos + `FormData`).

Comandos: `npm run dev`, `npm run build` (roda `tsc --noEmit` antes do Vite), `npm run preview`.

## 3. Estrutura

```
src/
  App.tsx          Layout (sidebar + topbar + main + footer + bottom nav) e rotas
  main.tsx         entrada
  index.css        tokens @theme + classes .btn .field .label .switch .dual-range .stagger
  types.ts         Envio, Plataforma, ItemFila, PontoAtividade, LinhaLog, Pergunta
  components/      Sidebar, BottomNav, Topbar, Footer, Panel, Badge, StatCard,
                   BarChart, Countdown, Modal
  pages/           Painel, Curriculo, Plataformas, Automacao, Configuracoes
  mocks/           dados fake atrás de funções get*() — trocar por Supabase
database/
  schema.sql       tabelas, enums, triggers, views, RLS, storage
  seed.sql         catálogo de plataformas
```

É uma árvore rasa de propósito: um arquivo por componente e nenhum `index.ts` de barril.

## 4. Rotas e telas

| Rota | Tela | Observações |
|---|---|---|
| `/painel` | 01 Painel | 4 stats, gráfico de 7 barras (Semana/Mês/Ano), fila do robô com countdown, tabela "Últimos envios" com paginação |
| `/painel?vazio` | 01b Estado vazio | mesmo componente; aparece quando `getConfig().roboConfigurado` é `false` ou com `?vazio` |
| `/curriculo` | 02 Currículo | dropzone (input file nativo + drag & drop), currículo principal, revisão para vaga (donut SVG), histórico de versões, outros currículos |
| `/plataformas` | 03 Plataformas + 03b Modal | grid de 8 cards, barras horizontais, "em breve"; o modal "Conectar plataforma" usa `<dialog>` |
| `/automacao` | 04 Automação | barra de status com pulso, formulário em 4 passos (`useReducer`), fila arrastável, log |
| `/configuracoes?tab=` | 05 / 05b / 05c | abas `dados`, `perguntas`, `notificacoes`, `conta` (as duas últimas mostram a mesma tela) |
| `*` | — | redireciona para `/painel` |

**Mobile (< 900px):** não existe tela separada. O mesmo componente muda com a variante `max-md:` (breakpoint `md` redefinido para 56.25rem). A sidebar vira drawer, a topbar fica com 50px, os stats viram 2×2, a tabela vira cards e aparece uma bottom nav fixa.

**Estado global:** só o estado do robô (`ativo | pausado | erro`), guardado no `Layout` e passado às páginas via `useOutletContext<AppContexto>()`.

## 5. Design system

As telas de referência eram mockups exportados do Pencil (`html/` e `preview/`, 1440×1024). Eles foram removidos após a implementação e continuam no commit `d088330`, recuperáveis com `git checkout d088330 -- html preview`.

**Tokens** (em `src/index.css`, geram utilitários como `bg-panel`, `text-ink-soft`, `border-panel-border`):

- Superfícies: `page-bg #EAEAEA`, `panel #FFF`, `panel-border #C3C9D1`
- Texto: `ink #333`, `ink-soft #6B7480`
- Marca: `blue #2F7FD1`, `blue-dark #1A6DC4`, `blue-deep #0F4C8F`
- Semântica: `aqua #6EC648`, `green-dark #4A9B2C`, `orange #E8622C`, `purple #8B5FBF`
- Sidebar: `side-top #3D4756` → `side-bottom #232A34`
- Adicionados (extraídos do HTML do design, para passar AA): `green-deep #3E8524`, `orange-deep #C8481A`, `orange-light #FF8B5E`, `amber #E8C86A`, `amber-ink #7A6320`

**Regras visuais:**
- Raio de 8px em painéis e botões. Separação por borda de 1px; sombra só em modal e toast.
- **Gradiente só na sidebar.** O brilho dos botões e headers do mockup foi trocado por cor chapada de propósito.
- Headers de painel: `blue-dark`, `green-deep`, `side-top`, `purple` ou `orange-deep` (prop `tone` do `<Panel>`).
- Texto branco nunca vai sobre `aqua`, `green-dark`, `orange` ou `blue` puros, porque falha no AA. Use as variantes `-deep`/`-dark`.
- `ink-soft` só sobre branco (dá 4,6:1). Sobre `page-bg` ou fundos tingidos ele falha no AA.
- Números (timers, horários, contadores, tabelas) usam `tabular-nums`.
- Tipografia real do design: título de página 19px, título de painel 13px, corpo 12px, labels 11px, stat 30px.

**Transições:**
- **Entrada de página:** a classe `.stagger` fica na raiz de cada página (e no estado vazio). Os blocos filhos sobem 8px com fade em 0,45s, em cascata de 60ms.
- **Modal:** `dialog[open]` abre com fade + scale 0,97→1 em 0,2s.
- **Micro-interações:** fundo de botões e switches com transição de 0,15s; botão desce 1px ao clicar; pulso no status do robô quando ativo.
- `prefers-reduced-motion` desliga todas as animações e transições.

## 6. Decisões tomadas (e o porquê)

- **Medidas do HTML exportado, não do prompt.** O prompt original (`PROMPT-IMPLEMENTACAO.md`, removido) dizia 25px/17px/34px, mas o design real é menor.
- **Badges seguem o mockup:** Visualizado é azul e Enviado é verde (o prompt dizia o inverso). São sólidos porque a versão clara falhava no contraste.
- **Modal com `<dialog>.showModal()` dentro de `createPortal`.** O navegador já prende o foco, trata o Esc e devolve o foco ao botão que abriu. O clique no overlay é tratado à parte.
- **Foco visível global:** outline azul + anel branco (`box-shadow`), para aparecer tanto no fundo claro quanto na sidebar escura.
- **Faixa salarial:** dois `input[type=range]` sobrepostos (classe `.dual-range`), sem biblioteca.
- **Toggles:** checkbox nativo com `role="switch"` e a classe `.switch`.
- **Fila da Automação:** reordena arrastando (drag nativo) ou pelo teclado (setas no número da posição).
- **Avatar:** iniciais "MP", porque não havia a foto.
- **Tailwind** escaneia só `src/` (`@import "tailwindcss" source(".")`).

## 7. O que ainda é mock ou não funciona

- Todos os dados vêm de `src/mocks/*.ts`. A troca por API é substituir o corpo das funções `get*()`.
- Upload, análise de compatibilidade e paginação são simulados. Os pontos de troca têm comentário `ponytail:` (`grep -r "ponytail:" src`).
- O countdown "Próximo envio" é local de cada tela e reinicia ao navegar.
- Botões sem ação (dependem de API ou de telas inexistentes): Baixar, Fazer upgrade, Gerenciar plano, Encerrar assinatura, menu do usuário, sino de notificações e a busca da topbar.
- Não há autenticação (login/cadastro) no front.

## 8. Banco de dados (Supabase)

Arquivos em `database/`. Para aplicar: rode `schema.sql` e depois `seed.sql` no SQL Editor. A sintaxe foi validada com o parser do Postgres (libpg_query), mas ainda não foi aplicada num projeto real.

**Tabelas:** `plataformas` (catálogo global), `perfis` (1:1 com `auth.users`, inclui notificações e plano), `curriculos`, `curriculo_versoes`, `automacao_config` (1 por usuário), `conexoes`, `fila_envio`, `envios`, `log_atividade`, `perguntas_automaticas`, `faturas`.

**Views:** `painel_resumo` (total, mês, hoje, erros_hoje, semana, semana_anterior) e `envios_por_dia`. Ambas `security_invoker`.

**Segurança:**
- RLS em todas as tabelas; cada usuário só vê as próprias linhas.
- `envios`, `log_atividade`, `faturas` e `conexoes` (exceto desconectar) são escritos só pelo backend com `service_role`.
- Grants por coluna impedem o usuário de alterar `plano`, `envios_limite`, `renova_em` e `proximo_envio_em`.
- Trigger `on_auth_user_created` cria o perfil, a config do robô e as 8 perguntas padrão.
- Buckets privados `curriculos` (PDF/DOCX até 5 MB) e `avatares`, com path `{user_id}/...`.
- **Senhas e tokens das plataformas não ficam em tabela.** Precisam ir para o Supabase Vault via Edge Function.

**Limitações conhecidas:** "hoje" e "mês" nas views usam UTC, não o fuso de São Paulo.

## 9. Próximos passos sugeridos

1. Criar o projeto no Supabase e aplicar `database/`.
2. Instalar `@supabase/supabase-js` e trocar os mocks por queries.
3. Criar telas de login/cadastro (Supabase Auth) e proteger as rotas.
4. Criar a Edge Function de conexão com as plataformas (OAuth/credenciais no Vault) e ligar ao modal.
5. Criar o worker do robô: consome `fila_envio`, grava `envios` e `log_atividade`, atualiza `proximo_envio_em`.
6. Usar Supabase Realtime em `log_atividade` e `fila_envio` para o painel atualizar ao vivo.

## 10. Histórico

| Data | O que foi feito |
|---|---|
| — | `1917caa` first commit: mockups exportados (`html/`, `preview/`), `tokens.css`, prompt de implementação |
| 11/09/2026 | Implementação completa do front a partir do prompt: shell, 5 rotas, modal, estado vazio, mobile. Validado com build e screenshots em 1366/1440/1920/600px. Commit `d088330` |
| 11/09/2026 | Limpeza: removidos mockups, galeria, `tokens.css`, prompt e `dist/`. Commit `fa33d76` |
| 14/09/2026 | Criada a pasta `database/` com schema e seed para o Supabase (ainda não commitada) |
| 14/09/2026 | Criado este `agentlog.md` |
| 14/09/2026 | Testado um redesign escuro (skill ui-ux-pro-max + claude-cookbooks); a pedido, **desfeito**, mantendo só as transições (entrada em cascata das páginas e abertura do modal) sobre o tema original |

**Convenções para quem continuar:** textos da interface em PT-BR; commits pequenos; rode `npm run build` antes de commitar; nada de dependência nova sem necessidade real; acessibilidade (labels, foco, `aria-*`, contraste AA) não fica para depois.
