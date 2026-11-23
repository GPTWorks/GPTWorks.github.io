(function () {
  const grid = document.getElementById("art-grid");
  if (!grid) return;
  const src = grid.getAttribute("data-src");
  const root = grid.getAttribute("data-root") || "";
  const filtersEl = document.getElementById("art-filters");
  const filmsEl = document.getElementById("art-films");

  function esc(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function pieceHref(piece) {
    const href = piece.href || "";
    if (root === "../" && href.indexOf("artwork/") === 0) {
      const local = href.slice("artwork/".length);
      return local || "index.html";
    }
    return root + href;
  }

  function imageSrc(path) {
    if (!path) return "";
    if (/^(https?:|data:)/.test(path)) return path;
    return root + path;
  }

  fetch(src)
    .then((response) => {
      if (!response.ok) throw new Error("art list");
      return response.json();
    })
    .then((data) => {
      const pieces = data.pieces || [];
      if (filtersEl) {
        const filters = [{ id: "all", label: "All human-made" }];
        const seen = new Set();
        pieces.forEach((piece) => {
          if (!piece.filter || seen.has(piece.filter)) return;
          seen.add(piece.filter);
          filters.push({ id: piece.filter, label: piece.filterLabel || piece.kind || piece.filter });
        });
        filtersEl.innerHTML = "";
        filters.forEach((filter, index) => {
          const button = document.createElement("button");
          button.type = "button";
          button.className = "pill" + (index === 0 ? " is-on" : "");
          button.dataset.filter = filter.id;
          button.setAttribute("aria-pressed", index === 0 ? "true" : "false");
          button.textContent = filter.label;
          filtersEl.appendChild(button);
        });
        filtersEl.addEventListener("click", (event) => {
          const button = event.target.closest("button");
          if (!button || !filtersEl.contains(button)) return;
          const filter = button.dataset.filter;
          filtersEl.querySelectorAll("button").forEach((item) => {
            const on = item === button;
            item.classList.toggle("is-on", on);
            item.setAttribute("aria-pressed", on ? "true" : "false");
          });
          grid.querySelectorAll(".sphere").forEach((card) => {
            card.hidden = filter !== "all" && card.dataset.filter !== filter;
          });
        });
      }

      grid.innerHTML = "";
      pieces.forEach((piece) => {
        const link = document.createElement("a");
        link.className = "sphere";
        link.href = pieceHref(piece);
        link.dataset.filter = piece.filter || "all";
        if (piece.id) link.id = "card-" + piece.id;
        link.innerHTML =
          '<span class="orb">' +
            '<img class="holo" src="' + esc(imageSrc(piece.image)) + '" alt="">' +
            '<span class="orb-shade" aria-hidden="true"></span>' +
            '<span class="orb-shine" aria-hidden="true"></span>' +
            '<span class="orb-stars" aria-hidden="true"></span>' +
          "</span>" +
          '<span class="sphere-copy">' +
            '<span class="kind">Human-made · ' + esc(piece.kind) + "</span>" +
            '<span class="sphere-title">' + esc(piece.title) + "</span>" +
            '<span class="sphere-text">' + esc(piece.summary) + "</span>" +
          "</span>" +
          '<span class="pill">Open <span aria-hidden="true">→</span></span>';
        grid.appendChild(link);
      });

      if (filmsEl) {
        filmsEl.innerHTML = "";
        pieces.filter((piece) => piece.film).forEach((piece) => {
          const article = document.createElement("article");
          article.className = "film-piece";
          article.id = piece.id;
          article.innerHTML =
            '<p class="kind">Human-made · ' + esc(piece.kind) + "</p>" +
            "<h2>" + esc(piece.title) + "</h2>" +
            "<p>" + esc(piece.filmNote || piece.summary) + "</p>" +
            '<p class="actions"><button class="pill" type="button">Play the film <span aria-hidden="true">→</span></button></p>' +
            '<video controls playsinline preload="none" hidden poster="' + esc(imageSrc(piece.image)) + '">' +
              '<source src="' + esc(imageSrc(piece.film)) + '" type="video/mp4">' +
            "</video>";
          const button = article.querySelector("button");
          const video = article.querySelector("video");
          button.addEventListener("click", () => {
            video.hidden = false;
            button.hidden = true;
            const play = video.play();
            if (play && typeof play.catch === "function") play.catch(() => {});
          });
          filmsEl.appendChild(article);
        });
      }

      document.dispatchEvent(new CustomEvent("spheres:ready"));
    })
    .catch(() => {
      grid.innerHTML = '<p><a class="pill" href="' + esc(root) + 'artwork/">Open the artwork studio <span aria-hidden="true">→</span></a></p>';
    });
})();
