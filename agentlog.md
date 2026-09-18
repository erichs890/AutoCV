# AutoCV — Agent Log

Contexto do projeto para quem (humano ou agente) for continuar o trabalho. Leia antes de mexer no código.

---

## 1. O produto

**AutoCV** automatiza a candidatura a vagas. A pessoa cadastra nome, e-mail, telefone, link do LinkedIn e currículo, conecta plataformas de vagas, configura o robô e ele busca vagas compatíveis, preenche o formulário, anexa o currículo (original ou adaptado) e envia — respeitando ritmo e limites, e pausando quando precisa da pessoa.

- **Público:** profissionais brasileiros em recolocação. Interface 100% em português do Brasil.
- **Escopo atual:** **só o InHire** funciona. As outras plataformas aparecem como "Indisponível" e entram como novos adapters.
- **Regra absoluta (currículo):** nunca inventar, exagerar ou remover informação. Ver §7.

## 2. Estado atual (18/09/2026)

App local em dois processos, ambos abertos pelo `start.bat`:

- **Interface** (`src/`): React + Vite, porta 5173.
- **Núcleo** (`core/`): Node 24 + TypeScript rodado direto pelo Node (sem build), porta 4780. Faz tudo que é automação: SQLite, Playwright, PDF ⇄ Markdown, análise, score, adaptação, fila.

Funciona de ponta a ponta contra o InHire real, **verificado em 18/09/2026** com um PDF de teste: cadastro → perfil de busca extraído → InHire conectado (empresa `vagasbyintera`) → busca via API pública (9 vagas, score 64% na compatível, ≤23% nas outras) → "Quero me candidatar" → pendências de LinkedIn e pretensão (a vaga exige; vão para o perfil) → preview do currículo adaptado → aprovação → página real aberta, 7 campos preenchidos, PDF adaptado anexado pelo seletor de arquivo → **InHire habilitou "Continuar inscrição"** (todos os campos válidos) → **ensaio** parou aí, captura salva.

Dois detalhes descobertos só nesse teste, já corrigidos: a máscara de pretensão salarial interpreta os dígitos como reais inteiros (digitar "450000" vira R$ 450.000,00 e o InHire recusa acima de R$ 300.000); e `setInputFiles` direto no `<input type=file>` não atualiza a interface do InHire — o anexo passa pelo botão "Anexar currículo" + evento `filechooser`.

O que **não** foi verificado ao vivo: o clique em "Continuar inscrição" e o que vem depois (segundo passo com perguntas específicas, mensagem de sucesso). Clicar criaria uma candidatura real numa empresa real, então isso ficou de fora dos testes. O código para essa parte existe (`core/platforms/inhire/index.ts`, depois do `ensaio`) mas é a parte mais provável de precisar ajuste na primeira candidatura real.

## 3. Decisões de arquitetura (e por quê)

- **Tauri/Rust ficou para depois.** O prompt pedia Tauri + Rust com Playwright como sidecar Node. Rust e MSVC não estão instalados nesta máquina, então o núcleo foi escrito direto em Node — é exatamente o sidecar que o Tauri chamaria. Quando houver Rust: o shell Tauri só precisa iniciar `node core/server.ts` e apontar a webview para o Vite/`dist`. O front já fala com o núcleo por HTTP/SSE em `localhost`, não por `invoke`.
- **API pública do InHire para buscar, Playwright só para candidatar.** Observando o tráfego do site descobri `https://api.inhire.app` (`GET /job-posts/public/pages` e `/job-posts/public/pages/<id>`, cabeçalho `x-tenant: <empresa>`). Busca por JSON é muito mais robusta que raspar DOM. O formulário de candidatura precisa de navegador (reCAPTCHA invisível, upload).
- **Não há login no InHire.** As páginas de vagas são públicas e o formulário não pede conta. Logo não há credenciais para criptografar; o modal "Conectar" pede só as empresas (`<slug>.inhire.app`). O prompt previa usuário/senha — não se aplica.
- **Não existe busca global no InHire** (`inhire.app/vagas` = "empresa não encontrada"). Por isso o módulo de **descoberta** (`core/platforms/inhire/discovery.ts`, separado da candidatura): tabela `empresas_inhire` (subdomínio, nome, ativo, origem seed/manual/busca, última verificação, total de vagas, falhas), seed com 29 empresas confirmadas na API em 18/09/2026, revarredura a cada `intervaloHoras` (padrão 6 h) independente do robô, pausa de 2 s entre empresas e vagas novas lidas 3 por vez (PARALELO em discovery.ts; ~2 vagas/s — primeira varredura de ~100 empresas leva ~15 min, as seguintes só relistam), progresso `descoberta.progresso` (empresa X de Y) exibido em Plataformas, empresa desativada após 3 falhas seguidas, vagas que somem viram `encerrada`. Fonte B (1x/dia, ligada por padrão) = **Common Crawl** (`index.commoncrawl.org/<índice>-index?url=*.inhire.app`, os 10 índices mais recentes, sem chave — 8 índices renderam 53 subdomínios em 32 s no teste de 18/09) + Google Programmable Search opcional (chave + cx), com validação de cada subdomínio via `tenants/public/config` (404/inativo → descartado sem log individual). Fontes que NÃO servem: crt.sh (certificado curinga `*.inhire.app`) e a API do InHire (não lista clientes). Seed controlado por `kv.seedVersao` (`SEED_VERSAO` em discovery.ts): suba a versão ao acrescentar empresas ao JSON; a importação inicial falhava quando a migração de `automacao.tenants` já tinha populado a tabela — corrigido. A extração é pela **API JSON**, não por Playwright: o layout customizado por empresa não afeta nada. Vagas em páginas de carreira nomeadas usam `/<careerPageId>/vagas/...` na URL.
- **Navegador do sistema.** `chromium.launchPersistentContext` com `channel: 'msedge'` (fallback `chrome`, depois Chromium do Playwright). O download do Chromium pelo CDN falhou aqui por timeout, e usar o Edge evita 150 MB por instalação. Cookies ficam no perfil em `%LOCALAPPDATA%\AutoCV\navegador` (não criptografados — não há segredo neles hoje).
- **Adaptação por regras, com IA opcional.** Sem IA configurada, a adaptação é por regras (reordenar + frase de foco com skills reais) e `validarAdaptacao` garante palavra por palavra que nada novo entra. Com IA (Configurações › Inteligência Artificial: Google Gemini via REST, padrão `gemini-2.5-flash`; ou Anthropic via `@anthropic-ai/sdk`, padrão `claude-opus-5`), `core/ia.ts` faz a chamada e `adaptarComIA` passa o resultado por `validarEntidades`: sinônimos e conectivos podem mudar, mas competência do dicionário, número/ano, sigla ou nome próprio ausentes do original, seção/experiência removida ou tamanho muito diferente descartam a reescrita — e o fluxo cai para as regras. A chave fica no SQLite local (não criptografada; sem cofre do SO nesta fase) e nunca é enviada ao front (só "definida" + 4 últimos caracteres). A chamada à Anthropic não usa `fallbacks` de recusa porque o modelo é escolhido pelo usuário.
- **Score em duas camadas.** Léxico (`resume/score.ts`): técnicas pesam 85% e comportamentais 15% (lista `SOFT` em `texto.ts`), 40% vem da similaridade do título com os cargos do currículo (ou o cargo configurado), e área diferente (`inferirArea`, por skills e por termos do título) corta pela metade. Com IA configurada, `avaliarVagas` (lotes de 6, JSON) pontua cada vaga nova lendo o currículo e devolve um `motivo`; o léxico fica de reserva se a IA falhar. O motivo aparece na lista de vagas.
- **Currículo adaptado sempre visível.** Cada vaga guarda `adaptado` (markdown, diff, viaIA, pdf). O botão "Currículo adaptado" chama `POST /preview/gerar` (usa o guardado ou gera) e `POST /preview/pdf` gera o PDF em `gerados/preview_<id>.pdf`; a lista também linka o PDF que foi de fato anexado na candidatura.
- **Modo ensaio ligado por padrão.** O robô só clica em enviar quando o usuário desliga o ensaio. Primeiras execuções produzem capturas para conferência.
- **Estado inteiro no núcleo.** O front não tem `localStorage` mais: `GET /estado`, `POST /estado` (parcial) e SSE `/eventos` (qualquer mudança → o front recarrega). Estado é pequeno; simplicidade ganha.
- **`node:sqlite`** (embutido no Node 24) em vez de better-sqlite3: zero dependência nativa. Tabelas: `kv` (blobs JSON: perfil, currículos, config…), `vagas`, `candidaturas`, `log`.
- **PDF → Markdown com pdfjs-dist**; **Markdown → PDF com o próprio navegador** (`page.pdf`) e um template fixo. A ida-e-volta é testada em `npm run check`. Negrito se perde na extração; itens de lista sobrevivem porque o template imprime "• " como texto.

## 4. Estrutura

```
start.bat            abre núcleo (2ª janela) + interface
core/
  server.ts          HTTP + SSE (porta 4780); rotas em um mapa "MÉTODO /caminho"
  estado.ts          monta o Estado para o front; grava parciais no kv
  queue.ts           fila: busca periódica, uma candidatura por vez, janela/limite/intervalo, modo auto/manual
  candidatura.ts     fluxo de uma candidatura: currículo (original/adaptado) → adapter → confirmação/erro
  browser.ts         uma sessão de navegador (Edge/Chrome/Chromium)
  events.ts          emissor → SSE
  config.ts          %LOCALAPPDATA%\AutoCV e subpastas
  storage/db.ts      node:sqlite
  ia.ts              provedor de IA (Gemini REST / Anthropic SDK): ler/salvar config, completar(), testar
  platforms/adapter.ts        interface PlatformAdapter + registro
  platforms/inhire/api.ts     API pública (x-tenant)
  platforms/inhire/selectors.ts  convenções do InHire: campos fixos (name → papel), botões próximo/final, regex de sucesso
  platforms/inhire/schema.ts  ETAPA 0: schema do formulário via API (fields/requiredFields, diversity.questions, Typeform público) → perguntas prévias
  platforms/inhire/formulario.ts  motor DOM: descobrirCampos / resolverCampo / preencher por tipo / avançar etapas / preencherTypeform
  platforms/inhire/discovery.ts  descoberta: empresas, seed, varredura (Fonte A), Common Crawl + Google opcional (Fonte B)
  platforms/inhire/seed_empresas_inhire.json  lista inicial de empresas verificadas
  platforms/inhire/index.ts   adapter: buscarVagas → discovery; candidatar (Playwright)
  resume/texto.ts    normalização, dicionário de skills, similaridade (Dice + contenção)
  resume/pdfToMd.ts  pdfjs → Markdown (títulos por tamanho/nome de seção, listas)
  resume/mdToPdf.ts  Markdown → HTML (template) → PDF via navegador
  resume/analyzer.ts perfil de busca (área, cargos, skills, senioridade)
  resume/score.ts    compatibilidade 0–100
  resume/adapter.ts  adaptação por regras + validarAdaptacao (anti-invenção)
  self-check.ts      npm run check
src/
  types.ts           tipos compartilhados front/núcleo (o core importa daqui)
  api.ts             cliente HTTP do núcleo
  estado.tsx         ProvedorEstado: GET/POST /estado + SSE; useEstado()
  dados.ts           catálogo: plataformas (só InHire disponível), rótulos de status, validações
  pages/             Cadastro, Painel, Curriculo, Plataformas (+ empresas monitoradas), Automacao, Configuracoes, ConfigIA, ConfigDescoberta
  components/        Sidebar, BottomNav, Topbar, Footer, Panel, Badge, StatCard, BarChart, Modal
database/            schema Supabase antigo (não usado pelo app local; ver §9)
```

## 5. Como adicionar uma plataforma

1. Criar `core/platforms/<id>/index.ts` implementando `PlatformAdapter` (`buscarVagas`, `candidatar`) e chamar `registrarAdapter`.
2. Importar o módulo em `core/server.ts` (como o InHire).
3. Em `src/dados.ts`, marcar `disponivel: true` e, se a plataforma precisar de credenciais, tratar no modal de Plataformas.

O núcleo (fila, currículo, pendências, confirmação) não muda.

## 6. Fluxo de uma candidatura (core/candidatura.ts)

1. Decide regime: vaga só CLT ou só PJ → esse; ambos/indefinido → preferência do usuário; "perguntar" → pendência.
2. Currículo: se `adaptar`, gera adaptação → `validarAdaptacao` (qualquer palavra nova = descarta e usa o original) → se `preview = mostrar` e ainda sem decisão, pendência de aprovação → senão gera o PDF adaptado.
3. `adapter.perguntasPrevias` (antes de adaptar o currículo): lê o schema da vaga pela API (`schema.ts`) e devolve as perguntas obrigatórias e não condicionais (diversidade + Typeform); cada uma sem resposta salva vira pendência, sem abrir navegador.
4. `adapter.candidatar` → `executarFormulario` (`formulario.ts`): em cada etapa, `descobrirCampos` marca os controles visíveis com `data-autocv` (texto, textarea, arquivo, rádio agrupado, checkbox/grupo, select, `react-dropdown-select`), `resolverCampo` classifica (`CAMPO_FIXO` por `name`, `ROTULO_FIXO` por rótulo; o resto é pergunta extra → `respostaSalva`, opcional sem resposta = pula, obrigatória = pendência), preenche por tipo (dropdown: abre, digita para filtrar, escolhe `[role=option]` por `melhorOpcao`), repete a descoberta para campos condicionais (país → cidade), acha o botão (`BOTAO_PROXIMO` × `BOTAO_FINAL`), espera ficar habilitado (10 s) e avança até o conjunto de campos mudar. Em ensaio: para antes do botão final (e as rotas de envio estão abortadas no navegador). Depois do envio real: sucesso, iframe do Typeform (`preencherTypeform`: bloco ativo = `[data-qa^=blocktype-]:not([inert])`, opções `role=radio/checkbox`, OK, `submit-button`) ou mais campos nativos. A estrutura descoberta vai para a tabela `formularios` e o resumo para `vaga.formulario`.
5. Só com sucesso confirmado: grava `candidaturas`, marca `enviada`, log + aviso. Erro → `erro` com motivo e captura.

Pendências pausam **só aquela vaga**; a fila segue com as outras. Ao responder/aprovar, a vaga volta para `na_fila` e o fluxo recomeça do zero (mais simples e robusto do que manter a página aberta).

## 7. Regra absoluta do currículo — como está garantida

- `adaptarCurriculo` (regras) só reordena blocos/itens existentes e acrescenta uma frase "Foco em X, Y" com skills que estão **no currículo e na vaga** (interseção).
- `validarAdaptacao(original, adaptado)` devolve palavras do adaptado ausentes do original (só "foco" e "em" são toleradas). Lista não vazia → adaptação descartada, log de alerta, envio do original.
- `adaptarComIA` (opcional) manda o prompt com a regra absoluta e as listas explícitas de skills permitidas (interseção) e proibidas (só na vaga); o texto volta por `validarEntidades` (competências, números, siglas, nomes próprios em meio de frase, seções e itens em negrito preservados, tamanho 60–160%). Qualquer problema → regras.
- O preview mostra original e adaptado lado a lado com o relatório de mudanças.
- `npm run check` afirma que "Docker" (pedido pela vaga, ausente do CV) não aparece e que uma "Certificação AWS" inserida à força é detectada.

## 8. Design system

Tema claro dos mockups originais (recuperáveis com `git checkout d088330 -- html preview`). Tokens em `src/index.css`: `page-bg`, `panel`, `panel-border`, `ink`, `ink-soft`, `blue*`, `aqua`, `green-dark/deep`, `orange*`, `purple`, `amber*`, `side-*`. Raio 8px, borda 1px, sombra só em modal/toast, gradiente só na sidebar, `tabular-nums` em números, `.stagger` para a entrada das páginas, `prefers-reduced-motion` respeitado.

## 9. Pendências e limites conhecidos

- **Questionário sequencial do InHire (form-app.inhire.app) não pôde ser observado:** em 18/09/2026 o app estava quebrado no servidor do InHire (asset JS servido como HTML), então o iframe fica em branco para todo mundo. O motor genérico foi escrito pelas heurísticas do prompt e validado contra o Typeform embutido; quando o form-app voltar, a primeira candidatura real numa empresa com fluxo condicional (Loggi, Conta Azul, Alelo) é o teste que falta — o ensaio nessas empresas já percorre o caminho e devolve "questionário não carregou" enquanto o app estiver fora.
- **O que acontece depois de "Continuar inscrição" não foi testado ao vivo** (criaria candidaturas reais). Verificado em ensaio (rotas de envio abortadas): as duas abas do InHire em Radix, DB1, Conta Azul e Loggi (país/cidade, CPF, rádios, diversidade, aceite, botão final liberado) e o motor Typeform nos formulários públicos da Radix, Conta Azul e Loggi (todas as perguntas respondidas até o botão Enviar). Não verificado: o iframe do Typeform dentro da página do InHire após criar o talento, e o "conditional flow" (empresas com `publicCapabilities: requireCustomFormCompletion`, ex.: Loggi, em que o InHire renderiza as perguntas do Typeform nativamente e cria o talento só no fim, via `POST /forms/form/submit`) — o laço genérico deve cobrir, mas vale conferir a primeira candidatura real olhando o log.
- **reCAPTCHA Enterprise** (invisível, por pontuação) protege `POST /job-talents/public/<jobId>/talents`. Se o InHire desafiar, o fluxo marca erro "verificação (captcha)" e não finge sucesso.
- **Dropdowns de diversidade** mostram título + descrição colados no DOM; as opções são lidas pelo primeiro texto e casadas por `melhorOpcao` (igual → prefixo → contém → similaridade ≥ 0,6).
- **DOCX** é aceito no upload mas não é lido; só PDF com texto gera perfil de busca.
- **Perguntas extras com upload de arquivo** são ignoradas (só o currículo é anexado).
- **E-mail de confirmação** não é enviado; a confirmação é log + registro + aviso na interface.
- **Score** é léxico (dicionário de ~90 competências + cargos). Sem embeddings.
- `database/` é o schema Supabase de uma fase anterior; o app local não o usa.
- Tauri: ver §3.

## 10. Verificações

- `npm run check` — auto-verificação do núcleo (roda em ~10 s, abre o Edge headless para o PDF).
- `npm run build` — tipos do front (`tsc`), do núcleo (`tsc -p core`) e build do Vite.
- Ponta a ponta manual: `start.bat`, cadastrar com um PDF de texto, conectar `vagasbyintera`, buscar, candidatar em ensaio, abrir a captura.

## 11. Histórico

| Data | O que foi feito |
|---|---|
| 11/09/2026 | Front completo a partir dos mockups; depois limpeza dos mockups. Commits `d088330`, `fa33d76` |
| 14/09/2026 | Schema Supabase em `database/`; `agentlog.md`; redesign escuro testado e desfeito (ficaram só as transições). Commit `1f9de5b` |
| 17/09/2026 | App local funcional com `start.bat`, cadastro inicial e estado no `localStorage`; mocks removidos |
| 18/09/2026 | **Combobox rico + política para autodeclaração:** (1) dropdowns com título + descrição por opção (`react-dropdown-select` da diversidade; também `[aria-haspopup=listbox/menu]`) viram `OpcaoDropdown {textoPrincipal, textoSecundario}` em `formulario.ts` — casamento só pelo título, log com a descrição; rótulo pela heurística do elemento anterior quando não há aria-label. (2) `src/sensiveis.ts` (compartilhado front/núcleo): categorias versionadas por palavra-chave (gênero, orientação, raça/cor, PcD, religião, saúde, grupos de diversidade), `decidirSensivel` puro — nunca por similaridade: resposta literal → padrão por categoria (modo "padrao") → "Prefiro não responder" (modo "prefiro_nao", só se opcional e a opção existir) → pausa sinalizada como dado sensível (`PerguntaExtra.sensivel`, modal avisa). Nova aba Configurações › Autodeclaração e dados sensíveis (`ConfigSensiveis.tsx`, kv `sensiveis`). `PerguntaExtra.obrigatoria` passa a viajar do DOM/schema até a política. Nenhuma inferência a partir de nome/foto/currículo. Schema tolera formId UUID (formulário nativo do InHire, sem definição pública). Verificado em ensaio na Radix: parecidas não reaproveitadas, opcionais com "Prefiro não responder", obrigatória pausa como sensível, literal completa o formulário |
| 18/09/2026 | **Modo sequencial (uma pergunta por tela):** Etapa 0 confirmou que o questionário chega como **iframe do próprio InHire** (`form-app.inhire.app/form?jobId&formId=<typeformId>&type=subscription`, com `talentId` depois de criar o talento ou `flow=returnMessageToParent` no fluxo condicional das empresas com `publicCapabilities: requireCustomFormCompletion` — Loggi, Conta Azul, Alelo — em que o questionário vem ANTES do talento); em `/forms/preview/<id>` é o widget do Typeform. `detectarModo` roda a cada etapa (frames + página nativa); `preencherSequencial` escolhe o motor Typeform (data-qa) ou o genérico (`preencherSequencialGenerico`: pergunta em destaque, controles visíveis, Enter → botão próximo, tela final, limite 50). Ensaio clica o botão final só no fluxo condicional (abre o questionário sem criar nada; POSTs abortados). **Limite:** no dia do teste o form-app estava quebrado (o `index.html` dele aponta para um `.js` que devolve HTML), então o motor genérico foi validado numa página-mãe local com o Typeform embutido em iframe (Radix 4 perguntas, Conta Azul 9 com múltipla escolha, Loggi 4: detecção → boas-vindas → respostas → botão Enviar, em ensaio) e o caminho real da Loggi devolve o erro específico "questionário não carregou". Regras que fizeram diferença: ignorar `[inert]`/`aria-hidden` (telas vizinhas ficam no DOM), clicar no título antes do Enter (foco no iframe), "OK" com dica colada |
| 18/09/2026 | **Motor de formulário adaptativo (InHire):** Etapa 0 confirmou schema via API (`job-posts/public/pages/<id>` → `settings.fields/requiredFields` + `diversity.questions`; `forms/public/job-id/<id>/subscription` → `typeformId`; `form.typeform.com/forms/<id>` público) → `schema.ts` + `perguntasPrevias` no adapter (pausa antes de abrir o navegador). `formulario.ts` substitui o fluxo fixo: descoberta de campos por etapa, classificação fixo × extra, preenchimento por tipo (inclui `react-dropdown-select` de país/cidade e grupos de checkbox), navegação Avançar → Continuar inscrição, motor Typeform por bloco ativo. Novos: `PerguntaExtra.tipo = 'multipla'` (resposta "A \| B", modal com checkboxes), CPF e cidade no perfil (`PERGUNTA_CPF`/`PERGUNTA_CIDADE` vão para o perfil), tabela `formularios` + `vaga.formulario`, ensaio aborta as rotas de envio no navegador. Ensaio OK em Radix, DB1, Conta Azul e Loggi; Typeform OK em 3 formulários públicos |
| 18/09/2026 | **Local no score (só presencial):** `lerLocal` (cidade + UF a partir de "Cidade - UF", "Cidade, Estado", nome de estado sozinho) e `fatorLocal` em score.ts: vaga presencial na mesma cidade 1, outra cidade do mesmo estado 0,6, outro estado 0,2; remoto/híbrido ignoram. Cidade do candidato = `perfil.cidade` (Configurações → Dados); mudar ela repontua. `SCORE_VERSAO` = 3. Máscaras de telefone e pretensão em `src/mascaras.ts` |
| 18/09/2026 | **Senioridade no score:** `inferirSenioridade` (título manda, nível mais baixo quando cita vários; fallback "N anos de experiência"), fator 0,7 um nível acima / 0,35 dois ou mais acima da senioridade do candidato, seletor de senioridade na Automação (padrão = a do currículo), `repontuar()` quando os filtros mudam e uma vez por `SCORE_VERSAO` ao subir o núcleo, badge de nível nas vagas, senioridade informada à IA |
| 18/09/2026 | **Módulo de descoberta InHire:** tabela `empresas_inhire`, seed de 29 empresas verificadas, varredura agendada (Fonte A) com encerramento de vagas sumidas, Fonte B via Common Crawl (sem chave; Google opcional) — teste de 18/09 achou 75 empresas novas sozinho, UI de empresas monitoradas em Plataformas, aba Descoberta em Configurações, indicador no Painel. `automacao.tenants` migrado para a tabela |
| 18/09/2026 | Aba **Inteligência Artificial** em Configurações: provedor (nenhum / Gemini / Anthropic), modelo e chave; `core/ia.ts`; adaptação por IA com `validarEntidades`. Rotas `/ia` e `/ia/testar` testadas com chaves falsas (erros amigáveis); chamada real não testada por falta de chave |
| 18/09/2026 | **Módulo de automação InHire:** núcleo Node (`core/`) com `PlatformAdapter`, API pública do InHire, Playwright no Edge, SQLite, PDF ⇄ Markdown, perfil de busca, score, adaptação sem invenção + validador, fila com modo automático/manual, perguntas extras e preview como pendências, modo ensaio. Estado migrou do `localStorage` para o núcleo. Verificado ponta a ponta em ensaio contra o InHire real |

**Convenções:** textos em PT-BR; commits pequenos; `npm run build` e `npm run check` antes de commitar; nada de dependência nova sem necessidade real; nunca simular sucesso de envio; nunca deixar o adaptador de currículo introduzir informação.
