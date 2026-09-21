# AutoCV

Aplicação local que busca vagas e envia seu currículo automaticamente. Por enquanto só a plataforma **InHire** funciona; as outras aparecem como indisponíveis.

Roda no seu computador em dois processos: a interface (Vite + React) e o **núcleo** (Node + Playwright), que faz a automação de verdade.

## Como rodar

Dê dois cliques em **`start.bat`**. Ele abre duas janelas (interface e núcleo) e o navegador em `http://localhost:5173`. Na primeira vez instala as dependências — precisa de [Node.js](https://nodejs.org) 24+ e do Microsoft Edge ou Google Chrome instalado (o robô usa o navegador que já existe na máquina).

Pelo terminal:

```bash
npm install
npm run core   # núcleo, em um terminal
npm run dev    # interface, em outro
```

## Fluxo

1. **Cadastro:** nome, e-mail, telefone, link do LinkedIn e currículo em PDF. O núcleo lê o texto do PDF e monta o *perfil de busca* (área, cargos, competências, senioridade).
2. **Plataformas → InHire:** o InHire não tem busca geral; cada empresa publica em `empresa.inhire.app/vagas`. Ao conectar, o AutoCV carrega uma lista inicial de empresas verificadas (`core/platforms/inhire/seed_empresas_inhire.json`) e passa a revisitá-las periodicamente; você pode adicionar, pausar ou remover empresas e forçar uma varredura. Não há login nem senha.
3. **Automação:** escolha o modo (manual ou automático), filtros, ritmo e se o currículo deve ser adaptado por vaga. "Buscar vagas agora" lista as vagas com a compatibilidade calculada e o motivo. Com IA configurada, é ela que lê seu currículo e pontua cada vaga; sem IA, o score vem das competências técnicas, do cargo e da área. Em cada vaga, "Currículo adaptado" mostra o que mudaria e gera o PDF.
4. **Candidatura:** no modo manual, "Quero me candidatar"; no automático, o robô faz sozinho respeitando intervalo, limite diário e janela de horário. Ordem sempre: preencher → anexar → enviar → só então confirmar.

O formulário do InHire muda de vaga para vaga (uma ou duas abas, país/cidade, perguntas de diversidade, e um questionário "uma pergunta por tela" com as perguntas próprias da empresa, que pode vir antes ou depois de criar a candidatura). O robô não supõe um formulário fixo: antes de abrir o navegador ele lê pela API quais perguntas a vaga vai fazer e pede a você as que ainda não tem resposta; depois descobre os campos de cada etapa na própria página, preenche os fixos com seus dados (nome, e-mail, celular, CPF, LinkedIn, cidade, pretensão, CLT/PJ, currículo), responde as demais com as Perguntas Automáticas e avança até o envio. Cada campo preenchido aparece no log.

Perguntas de **autodeclaração** (identidade de gênero, orientação sexual, cor/raça, deficiência, religião, saúde, grupos de diversidade) são uma categoria à parte: o robô nunca as responde por semelhança com outra pergunta nem deduz nada do seu currículo. Em **Configurações › Autodeclaração e dados sensíveis** você escolhe se ele sempre pausa e pergunta, se marca "Prefiro não responder" quando a pergunta é opcional, ou se usa respostas padrão suas por tipo. O que você responde vale só para aquela pergunta exata e fica no seu computador.

O InHire exige LinkedIn (pedido no cadastro) e pretensão salarial; algumas vagas pedem cidade e CPF: preencha em Configurações › Meus Dados, ou o robô pergunta na primeira candidatura e guarda. Quando uma vaga faz uma pergunta que você ainda não respondeu, ou quando o currículo adaptado precisa de aprovação, só aquela vaga pausa e a interface pede sua decisão.

## Descoberta de vagas

O robô descobre as empresas sozinho. Ao conectar o InHire ele carrega uma lista inicial verificada e, **uma vez por dia**, consulta o Common Crawl (índice público e gratuito da web, sem chave) por endereços em `*.inhire.app`, confirma cada subdomínio na API do InHire e adiciona os ativos. Em **Configurações › Descoberta de vagas** você ajusta o intervalo de revarredura (padrão 6 h, roda mesmo com o robô parado), liga/desliga a descoberta e, se quiser, complementa com o Google Programmable Search (chave + ID do mecanismo). Em Plataformas dá para "Descobrir empresas agora", "Forçar varredura agora", adicionar, pausar ou remover empresas.

## Modo ensaio

Vem **ligado** por padrão: o robô abre a vaga, preenche todas as etapas, anexa o currículo, confere se o InHire liberou o botão de envio, tira uma captura de tela e **não clica em enviar**. Como garantia extra, em ensaio o navegador bloqueia as requisições que criariam a candidatura, mesmo que algo fosse clicado por engano. Confira as capturas (link "Ver captura de tela" na lista de vagas) e desligue o ensaio em Automação › Segurança quando estiver confiante.

## Adaptação do currículo — regra absoluta

O AutoCV **nunca inventa, exagera ou remove** informação. Sem IA, a adaptação só faz três coisas: reordena experiências, reordena habilidades e acrescenta ao resumo uma frase de foco com competências que já estão no currículo **e** na vaga. Depois, um validador compara palavra por palavra com o original; se aparecer qualquer termo novo, a adaptação é descartada e o original é enviado. `npm run check` exercita isso.

### Com IA (opcional)

Em **Configurações › Inteligência Artificial** escolha o provedor — **Google Gemini** (padrão `gemini-3.8-flash`) ou **Anthropic Claude** (padrão `claude-opus-5`) —, o modelo e cole a chave. "Testar conexão" faz uma chamada mínima. A IA pode reescrever frases com termos da vaga quando sua experiência já sustenta, mas o texto passa por uma validação de entidades: competência, número, sigla ou nome que não esteja no original, seção ou experiência removida, ou tamanho muito diferente fazem a reescrita ser descartada e a adaptação por regras entrar no lugar. A chave fica só neste computador.

## Onde ficam os dados

Em `%LOCALAPPDATA%\AutoCV`: banco SQLite (`autocv.sqlite`), PDFs originais (`curriculos/`), PDFs adaptados e capturas (`gerados/`) e o perfil do navegador (`navegador/`). Nada sai do computador além das próprias páginas de vagas. Em Configurações › Dados e Privacidade dá para apagar tudo.

## Scripts

| Comando | O que faz |
|---|---|
| `npm run dev` | interface (Vite) |
| `npm run core` | núcleo de automação (Node, porta 4780) |
| `npm run check` | auto-verificação do núcleo: PDF ⇄ Markdown, análise, score, adaptação sem invenção, similaridade |
| `npm run build` | checa os tipos do front e do núcleo e gera o `dist/` |

Mais contexto do projeto em [agentlog.md](agentlog.md).
