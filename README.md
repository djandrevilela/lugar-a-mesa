# Lugar à Mesa

**Organizador de Mesas de Casamento e Batizado** · Wedding and Christening Table Planner · Organizador de Mesas para Bodas y Bautizos

Página simples (HTML, CSS e JavaScript, sem servidor) para organizar quem se senta em cada mesa.
Repositório: https://github.com/djandrevilela/lugar-a-mesa

## O que faz
- Mesa principal (oval) e mesas redondas com mínimo e máximo configuráveis (por defeito 8 a 12).
- Sala em grelha: arrasta as mesas e acrescenta linhas ou colunas para qualquer lado.
- Arrasta convidados da lista para as mesas, reordena os lugares e muda-os de mesa.
- Adicionar pessoas à mão, importar convidados de Excel (há modelo vazio) e exportar/importar tudo em JSON.
- Exportar a lista das mesas em Excel, Word ou PDF.
- Imprimir a sala em A4 (horizontal ou vertical, ajustado automaticamente).
- 5 temas de cores: Água, Sálvia, Rosa, Lavanda e Noite.
- 3 idiomas: português (pt-PT), inglês (en-GB) e espanhol (es-ES). O idioma segue o do browser e pode ser mudado no topo.
- Rodapé com informação, ligação ao GitHub e botão de apoio no Ko-fi.

## Privacidade
Os dados ficam apenas no browser de quem usa (localStorage). Nada é enviado para servidores e a página não faz pedidos externos (as ligações do GitHub e do Ko-fi só abrem se alguém clicar). Para mudar de computador ou fazer cópia de segurança, usa **Ficheiros › Exportar JSON**.

## Publicar no GitHub Pages
1. Cria o repositório `lugar-a-mesa` no GitHub.
2. Carrega **o conteúdo** desta pasta (index.html, styles.css, app.js, i18n.js, a pasta vendor, etc.) para a raiz do repositório (Add file › Upload files).
3. Em **Settings › Pages**, escolhe *Deploy from a branch*, ramo `main` e pasta `/ (root)`.
4. Ao fim de um ou dois minutos, o site fica em `https://djandrevilela.github.io/lugar-a-mesa/`.

> Se o repositório for público, não coloques nomes de convidados nos ficheiros do site. Os convidados são importados no browser e não ficam no repositório.

## Ficheiros
- `index.html`, `styles.css`, `app.js`: a aplicação. `i18n.js`: traduções (para acrescentar um idioma, copia um bloco).
- `vendor/`: bibliotecas incluídas: SheetJS (Excel, Apache-2.0), jsPDF (PDF, MIT) e docx (Word, MIT).
- `LICENSE`: MIT.
