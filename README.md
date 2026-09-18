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
2. **Plataformas → InHire:** o InHire não tem busca geral; cada empresa publica em `empresa.inhire.app/vagas`. Cole os endereços das empresas que quer acompanhar. Não há login nem senha.
3. **Automação:** escolha o modo (manual ou automático), filtros, ritmo e se o currículo deve ser adaptado por vaga. "Buscar vagas agora" lista as vagas com a compatibilidade calculada.
4. **Candidatura:** no modo manual, "Quero me candidatar"; no automático, o robô faz sozinho respeitando intervalo, limite diário e janela de horário. Ordem sempre: preencher → anexar → enviar → só então confirmar.

O InHire exige LinkedIn (pedido no cadastro) e pretensão salarial: preencha em Configurações › Meus Dados, ou o robô pergunta na primeira candidatura e guarda. Quando uma vaga faz uma pergunta que você ainda não respondeu, ou quando o currículo adaptado precisa de aprovação, só aquela vaga pausa e a interface pede sua decisão.

## Modo ensaio

Vem **ligado** por padrão: o robô abre a vaga, preenche tudo, anexa o currículo, confere se o InHire aceitou os campos, tira uma captura de tela e **não clica em enviar**. Confira as capturas (link "Ver captura de tela" na lista de vagas) e desligue o ensaio em Automação › Segurança quando estiver confiante.

## Adaptação do currículo — regra absoluta

O AutoCV **nunca inventa, exagera ou remove** informação. Sem IA, a adaptação só faz três coisas: reordena experiências, reordena habilidades e acrescenta ao resumo uma frase de foco com competências que já estão no currículo **e** na vaga. Depois, um validador compara palavra por palavra com o original; se aparecer qualquer termo novo, a adaptação é descartada e o original é enviado. `npm run check` exercita isso.

### Com IA (opcional)

Em **Configurações › Inteligência Artificial** escolha o provedor — **Google Gemini** (padrão `gemini-2.5-flash`) ou **Anthropic Claude** (padrão `claude-opus-5`) —, o modelo e cole a chave. "Testar conexão" faz uma chamada mínima. A IA pode reescrever frases com termos da vaga quando sua experiência já sustenta, mas o texto passa por uma validação de entidades: competência, número, sigla ou nome que não esteja no original, seção ou experiência removida, ou tamanho muito diferente fazem a reescrita ser descartada e a adaptação por regras entrar no lugar. A chave fica só neste computador.

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
