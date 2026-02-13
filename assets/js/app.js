async function loadArticles() {
  const res = await fetch("data/articles.txt", { cache: "no-store" });
  if (!res.ok) throw new Error("Gagal load data/articles.txt");
  return await res.json();
}

function fmtDate(iso) {
  try {
    const d = new Date(iso + "T00:00:00");
    return d.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
  } catch {
    return iso;
  }
}

function getParam(name) {
  return new URLSearchParams(location.search).get(name);
}

function cardHTML(a) {
  const cover = a.cover ? `<img src="${a.cover}" alt="Cover" />` : "";
  return `
    <a class="card col-4" href="article-detail.html?id=${encodeURIComponent(a.id)}" data-topic="${a.topic}" data-title="${a.title}">
      <div class="card-media">${cover}</div>
      <div class="card-body">
        <div class="card-topic"><span class="dot"></span> ${a.topic}</div>
        <div class="card-title">${a.title}</div>
        <p class="card-excerpt">${a.excerpt || ""}</p>
        <div class="card-meta">
          <span>${fmtDate(a.date)}</span><span>•</span><span>${a.author || ""}</span>
        </div>
      </div>
    </a>
  `;
}

function detailHTML(a) {
  const cover = a.cover ? `
    <div class="article-cover">
      <img src="${a.cover}" alt="Cover artikel" />
    </div>` : "";

  return `
    <section class="hero" aria-label="Header">
      <div class="hero-inner">
        <div class="hero-kicker">ARTIKEL • <span style="opacity:.9">TOPIK: ${a.topic}</span></div>
        <h1 class="hero-title">${a.title}</h1>
        <p class="hero-sub">${a.excerpt || ""}</p>
      </div>
    </section>

    <div class="article-shell">
      <article class="article">
        ${cover}
        <header class="article-head">
          <div class="meta-bar">
            <span class="badge"><span class="dot"></span> ${a.topic}</span>
            <span>📅 ${fmtDate(a.date)}</span>
            <span>✍️ ${a.author || ""}</span>
          </div>
          <h1 class="article-title">${a.title}</h1>
        </header>

        <section class="article-content">
          ${a.content || "<p>(Belum ada isi)</p>"}
        </section>
      </article>

      <aside class="aside" aria-label="Sidebar">
        <div class="panel">
          <h4>Info</h4>
          <a href="#">Topik: ${a.topic}</a>
          <a href="#">Tanggal: ${fmtDate(a.date)}</a>
          <a href="#">Penulis: ${a.author || ""}</a>
        </div>
      </aside>
    </div>
  `;
}

async function initList() {
  const cards = document.getElementById("cards");
  if (!cards) return;

  const data = await loadArticles();
  let activeTopic = "all";

  const q = document.getElementById("q");
  const btnSearch = document.getElementById("btnSearch");
  const chips = document.querySelectorAll(".chip");

  function apply() {
    const query = (q?.value || "").trim().toLowerCase();
    const filtered = data.filter(a => {
      const matchTopic = (activeTopic === "all") || (a.topic === activeTopic);
      const matchQuery = !query || (a.title || "").toLowerCase().includes(query);
      return matchTopic && matchQuery;
    });

    cards.innerHTML = filtered.map(cardHTML).join("");
  }

  chips.forEach(chip => {
    chip.addEventListener("click", () => {
      chips.forEach(c => c.classList.remove("is-active"));
      chip.classList.add("is-active");
      activeTopic = chip.dataset.topic;
      apply();
    });
  });

  btnSearch?.addEventListener("click", apply);
  q?.addEventListener("keydown", (e) => e.key === "Enter" && apply());

  apply();
}

async function initDetail() {
  const mount = document.getElementById("detailMount");
  if (!mount) return;

  const id = getParam("id");
  const data = await loadArticles();
  const a = data.find(x => x.id === id) || data[0];

  mount.innerHTML = detailHTML(a);
}

initList().catch(console.error);
initDetail().catch(console.error);
