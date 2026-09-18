# PROMPT TÉCNICO — AUTOCV: MÓDULO DE AUTOMAÇÃO INHIRE

Copie e cole o conteúdo abaixo inteiro na conversa com o Fable para iniciar a implementação.

---

## CONTEXTO DO PROJETO

Estou desenvolvendo o **AutoCV**, um aplicativo desktop que automatiza a candidatura a vagas de emprego. O **front-end já está pronto e funcionando** (telas: Painel, Currículo, Plataformas, Automação, Configurações). Agora preciso implementar a **camada de automação/backend**, começando **exclusivamente pela plataforma InHire**.

**Stack técnica definida:**
- **Tauri** (Rust no backend/core do app, sem Electron) como shell desktop.
- **Playwright** para automação de navegador (login, navegação, preenchimento de formulários e envio de currículo dentro do InHire).
- O front-end (já existente) se comunica com essa camada via comandos Tauri (`invoke`) e eventos (`emit`/`listen`) para status em tempo real (fila, progresso, logs).

**Regra de escopo importante:** por enquanto, **apenas a plataforma InHire deve estar funcional**. Na aba "Plataformas" do app, apenas o card "InHire" deve estar ativo/clicável; todas as outras plataformas (LinkedIn, Indeed, Catho, Gupy etc.) devem aparecer com status "Indisponível" (desabilitadas, sem ação), preparando o terreno para plugins futuros de outras plataformas — ou seja, arquitete o código de automação de forma modular (ex.: uma interface/trait `PlatformAdapter` ou equivalente) para que no futuro eu só precise implementar um novo adapter por plataforma, sem reescrever o núcleo do app.

---

## REGRA ABSOLUTA E INEGOCIÁVEL (leia com atenção antes de programar qualquer coisa de IA/adaptação de currículo)

> **O sistema NUNCA pode inventar, mentir, exagerar ou remover informações verdadeiras do currículo do usuário.**

Isso significa, na prática:
- A "adaptação do currículo para a vaga" deve se limitar a: **reorganizar** a ordem de seções/experiências para priorizar o que é mais relevante para aquela vaga, **reescrever frases** para incluir sinônimos/palavras-chave da vaga **somente quando a experiência real do usuário já sustenta aquilo**, e **ajustar o resumo/objetivo profissional** no topo do currículo.
- **Proibido**: adicionar tecnologias, ferramentas, cargos, anos de experiência, certificações, ou qualquer dado que não esteja no currículo original enviado pelo usuário.
- **Proibido**: remover experiências, formações ou informações reais só porque "não combinam" com a vaga.
- Toda extração de palavras-chave da vaga deve ser cruzada com o conteúdo real do currículo antes de ser inserida — se a vaga pede "Docker" e o usuário nunca mencionou Docker em lugar nenhum do currículo, a palavra "Docker" **não pode** ser adicionada ao currículo adaptado.
- Implemente essa regra tanto na engenharia de prompt (se formos usar um modelo de linguagem para reescrever trechos) quanto em uma camada de validação pós-geração (um diff/comparação entre o currículo original e o adaptado, sinalizando qualquer trecho que introduza uma entidade/skill/dado não presente no original, para revisão antes do uso).

---

## FUNCIONALIDADES A IMPLEMENTAR

### 1. Conversão de Currículo: PDF ⇄ Markdown

- Função `pdf_to_markdown(caminho_pdf) -> String`: extrai texto e estrutura (títulos, listas, negritos quando possível) do PDF do currículo original e converte para Markdown, preservando seções (Dados pessoais, Resumo, Experiência, Formação, Habilidades, Idiomas, etc.).
- Função `markdown_to_pdf(markdown, template) -> caminho_pdf`: gera um PDF final bem formatado a partir do Markdown (adaptado ou não), para anexar na candidatura. Sugestão de libs: `pdf-extract` ou `lopdf`/`pdfium` no lado Rust, ou um microserviço local usando `pdfminer`/`weasyprint`/`headless Chromium` via Playwright mesmo (renderizar um HTML com CSS e exportar PDF) — escolha a abordagem mais estável e documente a decisão.
- O Markdown é o formato intermediário usado pela IA para análise/adaptação; o PDF é sempre o formato final anexado na vaga.
- Deve haver um **template visual de PDF limpo e profissional** para o currículo gerado, consistente independente da vaga.

### 2. Análise do Currículo Principal

- Ao subir o currículo (já feito na tela "Currículo" do front), rodar uma análise que extrai: área de atuação, cargo(s) de interesse, principais habilidades técnicas e comportamentais, nível de senioridade, e monta um "perfil de busca" (ex.: `{area: "TI", cargos: ["Desenvolvedor Backend", "Analista de Sistemas"], skills: [...], senioridade: "Júnior"}`).
- Esse perfil de busca é o que vai guiar a busca de vagas no InHire.

### 3. Busca de Vagas no InHire (via Playwright)

- Automatizar login no InHire (usuário/senha ou sessão salva com cookies persistidos localmente e criptografados).
- Navegar pelas vagas disponíveis no InHire, aplicando os filtros derivados do perfil de busca do usuário (área, cargo, senioridade, palavras-chave).
- Para cada vaga encontrada, extrair: título da vaga, empresa, descrição completa, requisitos, se é CLT ou PJ (ou ambos/a definir), localização/modelo (remoto/híbrido/presencial), link da vaga, e quaisquer **perguntas extras do formulário de candidatura** daquela vaga específica.
- Calcular um **score de compatibilidade** entre a vaga e o currículo do usuário (baseado em interseção de skills/palavras-chave reais, não inventadas), para exibir no front (isso já existe como "medidor de compatibilidade" na tela Currículo — reaproveitar a mesma lógica/score aqui).
- Persistir as vagas encontradas em um banco local (SQLite via `rusqlite`/`sqlx`, ou similar) para exibição no Painel e na Automação.

### 4. Formulário de Candidatura no InHire — Campos a Preencher

O formulário do InHire pede:
1. Nome
2. E-mail
3. Celular
4. Currículo em anexo (PDF — usar o adaptado ou o original, conforme configuração)
5. LinkedIn
6. Pretensão salarial
7. Regime: CLT ou PJ

**Regras de preenchimento automático:**
- Nome, e-mail, celular, LinkedIn e pretensão salarial vêm diretamente do cadastro do usuário na aba "Configurações" (Meus Dados) do app.
- **CLT ou PJ deve ser decidido automaticamente por vaga**: ler o campo de regime extraído da descrição/formulário da vaga (passo 3) e marcar a opção correspondente. Se a vaga aceitar os dois regimes e pedir para o candidato escolher, usar uma preferência padrão configurável pelo usuário em "Configurações" (ex.: "Se a vaga permitir escolha, prefiro: CLT" ou "PJ" ou "Perguntar sempre").
- **Perguntas extras do formulário** (campos que não são os 7 fixos acima): quando o Playwright detectar um campo de formulário não mapeado, ele deve:
  - Primeiro checar se já existe uma resposta salva para uma pergunta semelhante na aba "Configurações → Perguntas Automáticas" (comparação por similaridade de texto, ex.: usando distância de string ou embeddings simples).
  - Se não houver resposta salva, **pausar o fluxo daquela candidatura** e emitir um evento para o front-end criar dinamicamente um input pedindo a resposta ao usuário em tempo real (modal ou painel lateral "O InHire perguntou: '<pergunta>' — responda para continuar"). A resposta deve, opcionalmente, poder ser salva para reuso futuro em perguntas parecidas.

### 5. Adaptação do Currículo por Vaga

- Antes de preencher o campo de anexo, se a opção de adaptação estiver ativa (ver item 8), gerar uma versão adaptada do currículo (Markdown → reescrita respeitando a REGRA ABSOLUTA acima → PDF) específica para aquela vaga, priorizando as skills/experiências reais que mais casam com a descrição da vaga e inserindo palavras-chave da vaga **apenas quando fundamentadas no conteúdo real**.
- Gerar também um pequeno "relatório de adaptação" (diff) mostrando o que mudou em relação ao currículo original, para transparência do usuário.

### 6. Envio da Candidatura e Confirmação

- Ordem obrigatória do fluxo: **1) preencher formulário → 2) anexar o currículo (adaptado ou original) → 3) enviar a candidatura no InHire → 4) só então enviar a confirmação ao usuário**.
- A "confirmação" é uma notificação/registro local (e, opcionalmente, e-mail, se configurado na aba Notificações) informando: vaga, empresa, data/hora, dados usados na candidatura (nome, e-mail, celular, qual versão do currículo foi enviada), e link da vaga — isso só deve ser dado como certo depois de confirmar que o InHire realmente recebeu o envio (checar mensagem de sucesso na página, ex.: toast/redirecionamento de confirmação do próprio InHire).
- Se o envio falhar em qualquer etapa, registrar erro detalhado no log e marcar a vaga como "Erro" na fila (sem enviar confirmação de sucesso falsa).

### 7. Modo Automático vs. Modo Manual

- **Modo Automático**: o robô varre as vagas compatíveis continuamente e vai se candidatando sozinho, respeitando o timer/fila (já definido na tela Automação do front), sem intervenção do usuário — exceto quando surgir uma pergunta extra não respondida (item 4), que sempre pausa aquele item específico da fila até resposta, sem travar os outros.
- **Modo Manual**: o robô apenas **lista as vagas compatíveis** com o currículo principal (sem se candidatar) e exibe, para cada vaga, um botão **"Quero me candidatar"**. Só ao clicar nesse botão o robô executa o fluxo completo (adaptar currículo se configurado → preencher → anexar → enviar → confirmar) para aquela vaga específica.
- Essa escolha (Automático/Manual) deve ser uma configuração clara e visível na tela Automação, já prevista no front.

### 8. Preview do Currículo Adaptado (opcional, configurável)

- Configuração com duas opções, no fluxo de candidatura (tanto automático quanto manual):
  - **"Mostrar antes de enviar"**: o app gera o currículo adaptado, exibe um preview (lado a lado com o original, se possível, destacando as mudanças) e só prossegue com o envio após o usuário clicar em "Aprovar e enviar" (ou "Editar" / "Usar original em vez disso").
  - **"Enviar direto sem mostrar"**: pula o preview e segue o fluxo automaticamente após gerar a adaptação.
- No modo Automático, se "Mostrar antes de enviar" estiver ativo, cada vaga que exigir aprovação deve pausar apenas aquele item da fila (mesma lógica do item 4), continuando os demais itens que não precisam de aprovação pendente.

---

## ARQUITETURA SUGERIDA (para orientar, ajuste como achar melhor)

```
/src-tauri
  /src
    /platforms
      mod.rs              -> trait PlatformAdapter { login, search_jobs, fill_application, submit }
      inhire/
        mod.rs             -> implementação do adapter para InHire usando Playwright
        selectors.rs        -> seletores de UI do InHire centralizados (fácil manutenção se o site mudar)
    /resume
      pdf_to_md.rs
      md_to_pdf.rs
      analyzer.rs           -> extrai perfil de busca do currículo
      adapter.rs             -> lógica de adaptação por vaga + validação anti-invenção (diff checker)
    /queue
      mod.rs                 -> fila de candidaturas, timer, estados (pendente, em andamento, aguardando resposta, enviado, erro)
    /storage
      db.rs                  -> SQLite local (vagas, candidaturas, respostas salvas de perguntas, credenciais criptografadas)
    /commands.rs             -> comandos expostos ao front via #[tauri::command]
    /events.rs               -> eventos emitidos ao front (progresso da fila, pergunta pendente, log em tempo real)
    main.rs
/playwright
  inhire.spec / scripts de automação chamados via processo Node (Playwright) a partir do Rust (ex.: via sidecar do Tauri) OU via biblioteca Rust de automação de navegador equivalente — definir a melhor integração Tauri + Playwright (sidecar binary é a abordagem recomendada, já que Playwright roda em Node.js)
```

**Observação de integração Tauri + Playwright:** como o Playwright é uma ferramenta Node.js, a forma recomendada de integrá-lo ao Tauri é через um **sidecar** (processo Node empacotado junto ao app, iniciado pelo Rust via `tauri::api::process::Command`), comunicando por stdin/stdout (JSON) ou por um pequeno servidor local (ex.: WebSocket/HTTP em `localhost` apenas, nunca exposto externamente) entre o core Rust e o script Playwright. Implemente essa ponte de forma robusta, com tratamento de timeout e reinício do processo sidecar se ele travar.

---

## REQUISITOS NÃO FUNCIONAIS

- **Segurança**: credenciais do InHire e dados pessoais do usuário devem ser armazenados localmente de forma criptografada (ex.: usando `keyring`/cofre do SO via Tauri, ou criptografia simétrica com chave derivada de uma senha mestra do app). Nunca enviar esses dados para servidores externos sem que isso seja explicitado.
- **Resiliência da automação**: seletores do Playwright devem ser centralizados e com fallback (ex.: tentar por `data-testid`, depois por texto, depois por posição), já que sites mudam de layout. Implementar retry com backoff em falhas transitórias (timeout de rede, elemento não carregado).
- **Rate limiting ético**: respeitar sempre o timer configurado pelo usuário entre candidaturas, e nunca paralelizar múltiplas candidaturas simultâneas no mesmo navegador/sessão para não sobrecarregar ou disparar bloqueios anti-bot do InHire.
- **Logs em tempo real**: cada ação relevante (login, vaga encontrada, currículo adaptado, formulário preenchido, candidatura enviada, erro) deve emitir um evento para o front alimentar o console de log já existente na tela Automação.
- **Testabilidade**: escrever o adapter do InHire de forma que os seletores e fluxos possam ser testados com Playwright Test isoladamente, sem depender do restante do app Tauri.

---

## ENTREGA ESPERADA NESTA ETAPA

Quero que você comece implementando, nesta ordem de prioridade:

1. Estrutura base do módulo `platforms` com a trait/interface `PlatformAdapter` (mesmo que só InHire seja implementado agora).
2. Conversão PDF ⇄ Markdown funcionando de ponta a ponta com um currículo de exemplo.
3. O adapter de login + busca de vagas do InHire via Playwright (sidecar), com extração dos dados da vaga.
4. A lógica de score de compatibilidade e persistência das vagas no SQLite.
5. O fluxo completo de candidatura automática para uma vaga (preencher, anexar, enviar, confirmar), incluindo a lógica de CLT/PJ automática e o tratamento de perguntas extras via evento para o front.
6. Só depois disso, implementar a camada de adaptação de currículo por vaga (respeitando a REGRA ABSOLUTA) e o preview configurável.
7. Por fim, implementar a diferenciação Modo Automático vs Manual na fila.

Pode me fazer perguntas de esclarecimento antes de começar se algo estiver ambíguo, mas priorize já ir estruturando o código seguindo a arquitetura sugerida.
