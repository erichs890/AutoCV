# PROMPT TÉCNICO — AUTOCV: SUPORTE A FLUXO SEQUENCIAL (TIPO TYPEFORM) NO MOTOR DE FORMULÁRIO

Copie e cole o conteúdo abaixo na conversa com o Fable (complementa o prompt anterior "Motor de Formulário Adaptativo". Não substitui o motor DOM-driven em abas já especificado — este é um **segundo paradigma de formulário** que o InHire também usa, e o motor precisa suportar os dois).

---

## CONTEXTO DO PROBLEMA

Além do formato em abas (uma tela com múltiplos campos, segunda aba destrava após preencher a primeira), identificamos que o InHire também usa, em algumas vagas, um formato de **questionário sequencial estilo Typeform**: uma tela de boas-vindas ("Responda as perguntas para finalizar sua inscrição" + botão "Iniciar"), seguida de **uma pergunta por tela**, avançando com Enter ou clique em seta, até uma tela final de envio.

O motor de formulário precisa **detectar qual dos dois paradigmas está sendo usado** e aplicar a estratégia correta — não dá para hardcodar um dos dois.

---

## ETAPA 0 — DETECTAR SE É UM WIDGET INCORPORADO (IFRAME) OU NATIVO

Antes de qualquer automação, investigar via DevTools (aba Elements e aba Network) se essa tela de perguntas sequenciais:

**(a) Está dentro de um `<iframe>` de um serviço externo** (ex. `typeform.com`, ou outro construtor de formulários) — nesse caso:
- Confirmar o domínio exato do iframe (`src` do elemento).
- Verificar na aba Network se esse serviço expõe uma **API de schema das perguntas** (ex. `api.typeform.com/forms/{id}`) antes ou durante o carregamento — se existir e for acessível sem autenticação complexa, essa é a abordagem preferencial (mesmo raciocínio já aplicado à API do InHire e do formulário em abas): buscar a lista de perguntas, tipos e ordem via API, e usar isso para guiar o preenchimento, evitando inferência por DOM.
- Se for de fato um iframe, todo o código Playwright de interação (localizadores, cliques, digitação) precisa operar dentro do contexto do frame, não da página principal: usar `page.frameLocator('iframe[src*="DOMINIO_DETECTADO"]')` como raiz para todos os `locator()` seguintes, em vez de `page.locator()` direto.

**(b) É um componente nativo** (o próprio InHire reimplementou visualmente o padrão "uma pergunta por tela", sem iframe de terceiro) — nesse caso, tudo continua no mesmo `page`/frame principal, sem necessidade de trocar de contexto, mas a lógica de navegação sequencial (Etapa 2) ainda se aplica.

Documentar no código qual dos dois casos foi confirmado, já que a resposta pode até variar entre vagas/empresas diferentes (uma empresa pode usar Typeform de verdade, outra pode usar o campo nativo do InHire) — o motor deve checar isso a cada candidatura, não assumir um resultado fixo global.

---

## ETAPA 1 — TELA DE BOAS-VINDAS

Antes do loop de perguntas, tratar a tela inicial ("Responda as perguntas para finalizar sua inscrição" / "Iniciar"):

```js
const raiz = usaIframe
  ? page.frameLocator('iframe[src*="DOMINIO_DETECTADO"]')
  : page;

const botaoIniciar = raiz.getByRole('button', { name: /iniciar/i });
if (await botaoIniciar.isVisible().catch(() => false)) {
  await botaoIniciar.click();
}
```

Essa tela pode não aparecer sempre (algumas vagas podem pular direto para a primeira pergunta) — não tratar a ausência do botão "Iniciar" como erro, apenas seguir para a Etapa 2.

---

## ETAPA 2 — LOOP DE PERGUNTA ÚNICA SEQUENCIAL

Implementar uma função `preencher_fluxo_sequencial(raiz) -> Result<()>` com um loop que, a cada iteração:

1. **Detecta a pergunta atualmente visível.** Capturar o texto da pergunta (geralmente um heading/título grande na tela) e classificar o tipo de resposta esperado com base no controle visível:
   - Campo de texto curto (`role="textbox"` de uma linha)
   - Campo de texto longo (`textarea`)
   - Múltipla escolha (lista de `role="radio"` ou botões/cards clicáveis, um por opção)
   - Sim/Não (geralmente dois botões ou dois radios)
   - Escala/rating (série de botões numerados ou estrelas)
   - Upload de arquivo (se alguma pergunta pedir anexo adicional além do currículo já enviado no formulário principal)

2. **Classifica a pergunta como campo fixo ou pergunta extra**, reaproveitando exatamente a mesma lógica já especificada no motor de formulário em abas: comparar o texto da pergunta com os campos fixos conhecidos (raramente vão aparecer aqui, já que normalmente essas perguntas sequenciais são triagem específica da vaga, mas tratar o caso mesmo assim) e, para pergunta extra, buscar resposta salva por similaridade ou pausar e pedir ao usuário via evento (mesmo mecanismo do prompt de automação original).

3. **Preenche a resposta** de acordo com o tipo detectado (digitar texto, clicar na opção certa, etc.).

4. **Avança para a próxima pergunta**: tentar primeiro `raiz.keyboard.press('Enter')` (padrão desse tipo de formulário); se não houver mudança de estado após um tempo curto, tentar localizar e clicar num botão/seta de "próxima" como alternativa (`role="button"` com ícone de seta ou `aria-label` de "próximo/avançar/next").

5. **Detecta se chegou ao fim do fluxo**: a cada iteração, checar se a tela atual é a última pergunta ou uma tela de conclusão/revisão/envio (ex. texto "Enviar candidatura", "Revisar respostas", ausência de nova pergunta após avançar). Ao detectar isso, sair do loop.

6. **Timeout de segurança**: limitar o número máximo de iterações do loop (ex. 50) para evitar loop infinito caso a detecção de "fim do fluxo" falhe silenciosamente — se atingir o limite, pausar e registrar erro para revisão manual, nunca ficar preso automaticamente sem log.

```js
let iteracoes = 0;
const LIMITE_ITERACOES = 50;

while (iteracoes < LIMITE_ITERACOES) {
  iteracoes++;

  const chegouAoFim = await detectarTelaFinal(raiz);
  if (chegouAoFim) break;

  const pergunta = await detectarPerguntaAtual(raiz);
  if (!pergunta) {
    // não conseguiu identificar nada reconhecível na tela — pausar para revisão manual
    await pausarParaRevisaoManual(pergunta, 'estrutura_nao_reconhecida');
    return;
  }

  const tipoResposta = classificarTipoCampo(pergunta);
  const resposta = await resolverResposta(pergunta, tipoResposta); // fixo, salvo, ou pausa esperando o usuário

  await preencherResposta(raiz, pergunta, tipoResposta, resposta);
  await avancarProximaPergunta(raiz);
}

if (iteracoes >= LIMITE_ITERACOES) {
  await pausarParaRevisaoManual(null, 'limite_de_iteracoes_atingido');
}
```

---

## ETAPA 3 — INTEGRAÇÃO COM O MOTOR EXISTENTE

O motor principal de candidatura (já especificado no prompt anterior) deve, ao chegar numa etapa/aba que aciona esse tipo de questionário sequencial (o gatilho visual é exatamente a tela "Responda as perguntas para finalizar sua inscrição"), **delegar o controle** para `preencher_fluxo_sequencial()` em vez de tentar aplicar a lógica de "descobrir campos da aba atual" do motor em abas. Depois que o fluxo sequencial terminar (chegou à tela final), o controle volta para o motor principal, que segue normalmente até o envio final da candidatura.

Ou seja, a arquitetura final do preenchimento deve reconhecer dois "modos" de etapa:
- **Modo formulário em abas** (múltiplos campos visíveis simultaneamente, avança destravando aba) → motor já especificado no prompt anterior.
- **Modo questionário sequencial** (uma pergunta por tela, avança com Enter) → motor especificado neste prompt.

Uma mesma candidatura pode passar pelos dois modos em etapas diferentes (ex.: primeira aba com dados fixos no formato "abas", segunda aba sendo na verdade esse questionário sequencial de triagem) — o motor precisa alternar entre os dois conforme detecta o padrão da tela atual, sem assumir que uma vaga usa só um dos formatos do início ao fim.

---

## REQUISITOS NÃO FUNCIONAIS (reforçando os já definidos)

- Sem timeouts fixos além do limite de segurança de iterações (item 6 da Etapa 2) — toda espera de UI usa auto-wait do Playwright.
- Toda pergunta respondida, pulada ou pausada nesse fluxo sequencial deve gerar log em tempo real, igual ao restante do motor.
- Testar contra a vaga real já usada como referência (Radix, UI/UX Júnior) e, se possível, encontrar/testar contra pelo menos mais uma vaga que use esse mesmo padrão sequencial, para confirmar que a detecção de tipo de pergunta e de fim de fluxo generaliza.

---

## ENTREGA ESPERADA NESTA ETAPA

1. Investigar e confirmar se a tela sequencial é iframe de terceiro ou componente nativo (Etapa 0) — isso decide se usamos `frameLocator` ou `page` direto daqui para frente.
2. Implementar a detecção da tela de boas-vindas (Etapa 1).
3. Implementar o loop de pergunta única (Etapa 2), reaproveitando a lógica de campo fixo/pergunta extra já existente.
4. Integrar esse novo modo ao motor principal como uma alternativa detectável em tempo real, não como um fluxo separado e paralelo (Etapa 3).
5. Testar de ponta a ponta contra a vaga de exemplo, confirmando que o motor consegue: preencher a etapa em abas normalmente → detectar a virada para o modo sequencial → completar as perguntas → detectar o fim → devolver controle ao motor principal → enviar a candidatura.

Pode me perguntar antes de começar se algo estiver ambíguo, mas priorize confirmar a Etapa 0 (iframe ou nativo) primeiro, já que isso muda a base de todos os seletores usados depois.
