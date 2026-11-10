(function () {
  const canvas = document.getElementById("field");
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (canvas && canvas.getContext) {
    const ctx = canvas.getContext("2d", { alpha: true });
    const palette = ["#f5d0fe", "#e879f9", "#c026d3", "#a78bfa", "#67e8f9", "#ffffff"];
    let nodes = [];
    let w = 0;
    let h = 0;
    let raf = 0;
    const pointer = { x: -9999, y: -9999 };

    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = w + "px";
      canvas.style.height = h + "px";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const count = w < 700 ? 46 : 88;
      nodes = Array.from({ length: count }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.22,
        vy: (Math.random() - 0.5) * 0.22,
        r: Math.random() * 1.7 + 0.5,
        c: palette[(Math.random() * palette.length) | 0]
      }));
    }

    function draw(time) {
      ctx.clearRect(0, 0, w, h);
      const reach = 118;
      for (let i = 0; i < nodes.length; i++) {
        const n = nodes[i];
        if (!reduce) {
          n.x += n.vx;
          n.y += n.vy;
          const dx = pointer.x - n.x;
          const dy = pointer.y - n.y;
          const dist = Math.hypot(dx, dy);
          if (dist < 160 && dist > 0) {
            n.x -= (dx / dist) * 0.2;
            n.y -= (dy / dist) * 0.2;
          }
          if (n.x < 0 || n.x > w) n.vx *= -1;
          if (n.y < 0 || n.y > h) n.vy *= -1;
        }
      }
      ctx.lineWidth = 1;
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const a = nodes[i];
          const b = nodes[j];
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const d2 = dx * dx + dy * dy;
          if (d2 < reach * reach) {
            const alpha = 1 - Math.sqrt(d2) / reach;
            ctx.strokeStyle = "rgba(232, 180, 255," + (alpha * 0.45) + ")";
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
            if (!reduce && alpha > 0.72) {
              const t = (time / 1400 + i * 0.07) % 1;
              ctx.fillStyle = "#fff";
              ctx.beginPath();
              ctx.arc(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t, 1.6, 0, Math.PI * 2);
              ctx.fill();
            }
          }
        }
      }
      for (const n of nodes) {
        ctx.fillStyle = n.c;
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
        ctx.fill();
      }
      if (!reduce) raf = requestAnimationFrame(draw);
    }

    resize();
    draw(0);
    window.addEventListener("resize", () => { resize(); if (reduce) draw(0); });
    if (!reduce) {
      window.addEventListener("pointermove", (event) => {
        pointer.x = event.clientX;
        pointer.y = event.clientY;
      }, { passive: true });
      document.addEventListener("visibilitychange", () => {
        if (document.hidden) cancelAnimationFrame(raf);
        else raf = requestAnimationFrame(draw);
      });
    }
  }

  const reveals = document.querySelectorAll(".reveal");
  if (reduce || !("IntersectionObserver" in window)) {
    reveals.forEach((el) => el.classList.add("in"));
  } else {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("in");
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.14 });
    reveals.forEach((el) => observer.observe(el));
  }

  const toggle = document.getElementById("nav-toggle");
  const nav = document.getElementById("site-nav");
  if (toggle && nav) {
    toggle.addEventListener("click", () => {
      const open = nav.classList.toggle("open");
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
      document.body.classList.toggle("nav-open", open);
    });
    nav.querySelectorAll("a").forEach((link) => {
      link.addEventListener("click", () => {
        nav.classList.remove("open");
        toggle.setAttribute("aria-expanded", "false");
        document.body.classList.remove("nav-open");
      });
    });
  }

  const views = document.getElementById("viewCount");
  if (views) {
    fetch("https://countapi.mileshilliard.com/api/v1/hit/gptworks-main")
      .then((response) => response.json())
      .then((data) => { views.textContent = data.value || "0"; })
      .catch(() => { views.textContent = "—"; });
  }
})();
