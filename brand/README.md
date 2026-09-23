# Marca

`acv.jpg` é a arte original: um mockup fotografado em papel. Tudo o que o app usa sai dela, por
`python brand/gerar-logo.py` — só precisa rodar de novo se a arte mudar. Não é passo de build: os
arquivos gerados vão versionados em `public/`.

## Tratamento

O fundo é papel texturizado (luminância ~243, mínimo medido 229) e a marca é cinza (~104). O alpha sai
de uma rampa entre 225 e 120: o papel some inteiro, a marca fica sólida e a faixa do meio vira a borda
antialiasada. Depois recorta no conteúdo, com margem proporcional.

## O que é gerado, e por quê cada um é diferente

| Arquivo | O que é |
|---|---|
| `public/logo.png` | Marca completa (monograma + rastro), branca com alpha. Usada como **máscara** CSS em `src/components/Logo.tsx`: a cor vem de `currentColor`, então o mesmo arquivo serve branco na sidebar e escuro nos painéis claros. |
| `public/favicon.ico` · `favicon-{16,32,48,192,512}.png` | Só o **monograma**, branco sobre quadrado azul. |
| `public/apple-touch-icon.png` | Igual, 180px, sem canto arredondado (o iOS arredonda sozinho) e sem transparência (o iOS ignora). |

Duas decisões do ícone, tomadas olhando a prova ampliada e não no palpite:

- **O avião sai.** A marca inteira é 1,71:1; espremida num quadrado de 16px ela vira um risco de 9px de
  altura. O corte não pode ser por densidade de coluna — o avião tem colunas tão cheias quanto partes do
  monograma. O desenho tem um vale de verdade entre os dois (o rastro fino, colunas ~900-940) e é nele
  que se corta.
- **Fundo sólido em vez de transparente.** A marca é fina e cinza: solta, ela some na aba escura do
  navegador e quase não aparece na clara. O quadrado ancora a forma e fica igual nos dois temas.

Cada tamanho é renderizado com a sua própria ocupação e raio de canto (16px não aguenta 74% de ocupação
nem canto arredondado). Nenhum é redução do outro: todos saem da arte, em 8x, reduzidos por Lanczos.

Ainda assim, a 16px este monograma é denso — é propriedade do desenho, não do processamento. O que
garante o reconhecimento nesse tamanho é o quadrado azul, não o traço.
