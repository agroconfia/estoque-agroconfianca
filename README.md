# Estoque AgroConfiança

Projeto de consulta por Código e Descrição com todas as posições de estoque: `Estoque calculado`, `EF(+)`, `PCNR(+)`, `PVNE(-)`, `CF(+)`, `VF(-)`, `RDR(-)`, `RDE(+)`, `CA(+)` e `VA(-)`.

O relatório possui os valores deslocados uma coluna à direita dos títulos. O importador corrige esse deslocamento automaticamente. O filtro e o total de Estoque Físico usam o valor corrigido de `PCNR(+)`.

A aba **Fornecedor** usa a coluna `Razão Social` para listar e filtrar os produtos de cada fornecedor.

Para atualizar, substitua `Fatu4184.XLS` mantendo a estrutura atual e execute `Atualizar Estoque.cmd`.

Cada publicação substitui integralmente a lista anterior: somente os produtos presentes na nova planilha permanecem no site. Antes da confirmação, o atualizador mostra os itens incluídos, alterados e removidos, com suas quantidades.

O site é publicado automaticamente no GitHub Pages após cada atualização enviada para a branch `main`.

## Instalar no celular

Abra o site no celular e toque em **Instalar no celular**. Se o navegador não exibir a confirmação automática, abra o menu e escolha **Instalar aplicativo** ou **Adicionar à tela inicial**.
