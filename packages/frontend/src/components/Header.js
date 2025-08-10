// components/Header.js
function Header() {
  return `
    <header class="site-header">
      <div class="container">
        <h1 class="logo">Daneel</h1>
        <nav class="main-nav">
          <a href="/" class="nav-link active">Home</a>
          <a href="#features" class="nav-link">Features</a>
          <a href="#about" class="nav-link">About</a>
          <a href="#contact" class="nav-link">Contact</a>
        </nav>
      </div>
    </header>
  `;
}

module.exports = Header;