(function () {
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const root = document.documentElement;

  // Tree palette sampled from the GPTWorks logo (warm left → cool right).
  const palette = [
    [255, 77, 46],
    [255, 176, 32],
    [255, 79, 216],
    [124, 92, 255],
    [77, 183, 255],
    [46, 230, 199],
    [157, 255, 77]
  ];

  function mix(a, b, t) {
    return [
      Math.round(a[0] + (b[0] - a[0]) * t),
      Math.round(a[1] + (b[1] - a[1]) * t),
      Math.round(a[2] + (b[2] - a[2]) * t)
    ];
  }

  function cssColor(rgb, alpha) {
    if (alpha == null) return "rgb(" + rgb[0] + "," + rgb[1] + "," + rgb[2] + ")";
    return "rgba(" + rgb[0] + "," + rgb[1] + "," + rgb[2] + "," + alpha + ")";
  }

  function sample(phase) {
    const scaled = ((phase % 1) + 1) % 1 * palette.length;
    const i = Math.floor(scaled) % palette.length;
    const next = (i + 1) % palette.length;
    return mix(palette[i], palette[next], scaled - Math.floor(scaled));
  }

  let raf = 0;
  function driveLight(time) {
    const t = time * 0.001;
    const phase = (t / 8.5) % 1;
    const phase2 = (t / 8.5 + 0.38) % 1;
    const c1 = sample(phase);
    const c2 = sample(phase2);
    const angle = 96 + Math.sin(t / 3.2) * 38 + Math.cos(t / 5.1) * 12;
    const intensity = 0.28 + (Math.sin(t / 2.4) * 0.5 + 0.5) * 0.22;
    const x = 26 + Math.sin(t / 4.6) * 4;
    const y = 16 + Math.cos(t / 5.8) * 3;

    root.style.setProperty("--light-color", cssColor(c1));
    root.style.setProperty("--light-color-2", cssColor(c2));
    root.style.setProperty("--light-angle", angle.toFixed(2) + "deg");
    root.style.setProperty("--light-angle-base", angle.toFixed(2) + "deg");
    root.style.setProperty("--light-intensity", intensity.toFixed(3));
    root.style.setProperty("--light-intensity-base", intensity.toFixed(3));
    root.style.setProperty("--light-x", x.toFixed(2) + "%");
    root.style.setProperty("--light-y", y.toFixed(2) + "%");

    if (!reduce) raf = requestAnimationFrame(driveLight);
  }

  if (reduce) {
    root.style.setProperty("--light-color", "#67e8f9");
    root.style.setProperty("--light-color-2", "#ff4fd8");
    root.style.setProperty("--light-angle", "118deg");
    root.style.setProperty("--light-angle-base", "118deg");
    root.style.setProperty("--light-intensity", "0.4");
    root.style.setProperty("--light-intensity-base", "0.4");
  } else {
    raf = requestAnimationFrame(driveLight);
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) cancelAnimationFrame(raf);
      else raf = requestAnimationFrame(driveLight);
    });
  }

  // Animated logo video: play once, hold the final branded frame.
  const treeVideo = document.getElementById("tree-video");
  if (treeVideo) {
    treeVideo.muted = true;
    treeVideo.playsInline = true;
    treeVideo.loop = false;
    const tryPlay = () => {
      const play = treeVideo.play();
      if (play && typeof play.catch === "function") play.catch(() => {});
    };
    if (!reduce) {
      if (treeVideo.readyState >= 2) tryPlay();
      else treeVideo.addEventListener("loadeddata", tryPlay, { once: true });
      // Replay only when the visitor returns to the tab after it finished.
      document.addEventListener("visibilitychange", () => {
        if (document.hidden) return;
        if (treeVideo.ended) {
          treeVideo.currentTime = 0;
          tryPlay();
        } else {
          tryPlay();
        }
      });
    } else {
      treeVideo.removeAttribute("autoplay");
      treeVideo.pause();
      treeVideo.classList.add("is-fallback");
      const fallback = document.querySelector(".tree-fallback");
      if (fallback) fallback.hidden = false;
    }
    treeVideo.addEventListener("error", () => {
      treeVideo.classList.add("is-fallback");
      const fallback = document.querySelector(".tree-fallback");
      if (fallback) fallback.hidden = false;
    });
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
