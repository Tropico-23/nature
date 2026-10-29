(() => {
  "use strict";

  const root = document.documentElement;
  const header = document.querySelector(".site-header");
  const progress = document.querySelector(".progress");

  /* Barre de progression et en-tête : un seul écouteur passif, limité à une image par frame. */
  let ticking = false;
  const onScroll = () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      const y = window.scrollY;
      const max = root.scrollHeight - window.innerHeight;
      header.classList.toggle("is-solid", y > 40);
      progress.style.transform = "scaleX(" + (max > 0 ? Math.min(y / max, 1) : 0) + ")";
      ticking = false;
    });
  };
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScroll, { passive: true });
  onScroll();

  /* Menu mobile */
  const toggle = document.querySelector(".menu-toggle");
  const nav = document.getElementById("site-nav");
  const setMenu = (open) => {
    nav.classList.toggle("is-open", open);
    toggle.setAttribute("aria-expanded", String(open));
    toggle.setAttribute("aria-label", open ? "Fermer le menu" : "Ouvrir le menu");
    document.body.classList.toggle("menu-open", open);
  };
  toggle.addEventListener("click", () => setMenu(toggle.getAttribute("aria-expanded") !== "true"));
  nav.addEventListener("click", (e) => { if (e.target.closest("a")) setMenu(false); });
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && nav.classList.contains("is-open")) {
      setMenu(false);
      toggle.focus();
    }
  });
  window.matchMedia("(min-width: 861px)").addEventListener("change", (e) => { if (e.matches) setMenu(false); });

  /* Dévoilement des images de chapitre */
  const clips = document.querySelectorAll(".reveal-clip");
  if (clips.length) {
    if ("IntersectionObserver" in window) {
      const io = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-in");
            io.unobserve(entry.target);
          }
        });
      }, { threshold: 0.2 });
      clips.forEach((el) => io.observe(el));
    } else {
      clips.forEach((el) => el.classList.add("is-in"));
    }
  }

  /* Liste des menaces : l'image de droite suit le survol et le focus clavier */
  const threats = Array.from(document.querySelectorAll(".threat"));
  const previews = Array.from(document.querySelectorAll(".threat-preview img"));
  if (threats.length && previews.length) {
    const activate = (index) => {
      threats.forEach((el, i) => el.classList.toggle("is-active", i === index));
      previews.forEach((el, i) => el.classList.toggle("is-active", i === index));
    };
    threats.forEach((el, i) => {
      el.addEventListener("mouseenter", () => activate(i));
      el.addEventListener("focus", () => activate(i));
    });
    activate(0);
  }

  /* Formulaire de contact */
  const form = document.getElementById("contact-form");
  if (form) {
    form.noValidate = true;
    const status = document.getElementById("form-status");
    const submit = form.querySelector("button[type=submit]");

    const rules = {
      nom: (v) => (v.length >= 2 ? "" : "Indiquez votre nom (2 caractères minimum)."),
      prenom: (v) => (v.length >= 2 ? "" : "Indiquez votre prénom (2 caractères minimum)."),
      email: (v) => (/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v) ? "" : "Saisissez une adresse e-mail valide, par exemple nom@exemple.com."),
      tele: (v) => (/^[29]\d{7}$/.test(v) ? "" : "Le numéro compte 8 chiffres et commence par 2 ou 9."),
      adresse: (v) => (v.length >= 5 ? "" : "Indiquez votre adresse."),
    };

    const check = (input) => {
      const message = rules[input.name](input.value.trim());
      const error = document.getElementById(input.id + "-error");
      input.setAttribute("aria-invalid", message ? "true" : "false");
      error.textContent = message;
      return !message;
    };

    const inputs = Array.from(form.querySelectorAll("input[name]"));
    inputs.forEach((input) => {
      input.addEventListener("blur", () => { if (input.value) check(input); });
      input.addEventListener("input", () => { if (input.getAttribute("aria-invalid") === "true") check(input); });
    });

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      status.textContent = "";
      status.removeAttribute("data-state");

      const invalid = inputs.filter((input) => !check(input));
      if (invalid.length) {
        invalid[0].focus();
        return;
      }

      submit.disabled = true;
      try {
        const response = await fetch(form.action, {
          method: "POST",
          body: new FormData(form),
          headers: { Accept: "application/json" },
        });
        const result = await response.json();
        status.dataset.state = result.ok ? "ok" : "error";
        status.textContent = result.message;
        if (result.ok) form.reset();
      } catch (err) {
        status.dataset.state = "error";
        status.textContent = "Le serveur ne répond pas. Réessayez dans quelques instants.";
      } finally {
        submit.disabled = false;
      }
    });
  }
  /* Scroll reveals: apply consistently across content sections, with a safe fallback. */
  const revealTargets = document.querySelectorAll(
    ".statement p, .threats__head, .threat, .split > *, .cta .wrap > *, " +
    ".chapter__body, .solution, .daily li, .columns > *, .site-footer__top > *, .jump a"
  );
  if (revealTargets.length) {
    revealTargets.forEach((el, index) => {
      el.classList.add("reveal-up");
      el.style.setProperty("--reveal-index", String(index % 6));
    });

    if ("IntersectionObserver" in window) {
      const revealObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        });
      }, { threshold: 0.12, rootMargin: "0px 0px -36px 0px" });

      revealTargets.forEach((el) => revealObserver.observe(el));
    } else {
      revealTargets.forEach((el) => el.classList.add("is-visible"));
    }
  }
})();
