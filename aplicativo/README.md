# Consulta de Estoque — AgroConfiança

Página para consultar Código, Descrição e Estoque Físico dos produtos. Os valores são importados da coluna `PCNR(+)` da planilha.

## Atualizar o estoque

1. Substitua `Fatu4184.XLS` na pasta principal pelo relatório mais recente, mantendo a mesma estrutura.
2. Dê dois cliques em `Atualizar Estoque.cmd`.
3. Clique em **Analisar Fatu4184.XLS**.
4. Confira o resumo e clique em **Confirmar e publicar**.

O atualizador separa automaticamente o código da descrição, usa a coluna `PCNR(+)`, testa o site, registra a alteração no Git e envia para o GitHub Pages.

## Desenvolvimento

```bash
npm install
npm run dev
npm test
```
