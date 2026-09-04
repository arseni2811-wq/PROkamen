// main.js — общий модуль проекта (ES Modules)
import { getData } from "/js/storage.js";

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const normalize = (v) =>
  String(v || "")
    .toLowerCase()
    .trim();
const absoluteUrl = (path) => {
  if (!path) return path;
  const base =
    typeof location.origin === "string" && location.origin !== "null"
      ? location.origin.replace(/\/$/, "")
      : "";
  if (/^https?:/i.test(path)) return path;
  if (base) {
    const suffix = path.startsWith("/") ? path : `/${path}`;
    return `${base}${suffix}`;
  }
  return path;
};

/* ===================== УТИЛИТЫ ===================== */
async function loadJSON(url) {
  const res = await fetch(url, { credentials: "same-origin" });
  if (!res.ok) throw new Error(`Не удалось загрузить ${url}: ${res.status}`);
  return res.json();
}

export async function loadContent() {
  return getData("content");
}

export const telLink = (phone) =>
  `tel:${String(phone || "").replace(/[^\d+]/g, "")}`;
export const mailtoLink = (email) => `mailto:${email}`;

const materialLabel = (v) => {
  const map = {
    granite: "гранит",
    quartz: "кварцевый агломерат",
    quartzite: "кварцит",
    quartz_agglomerate: "кварцевый агломерат",
    marble: "мрамор",
    onyx: "оникс",
  };
  const key = String(v || "")
    .toLowerCase()
    .trim();
  return map[key] || key || "материал";
};

/* ===================== HEADER / FOOTER ===================== */
export async function renderHeaderFooter(activePath) {
  const { project, contacts, social } = await loadContent();

  const phones = Array.isArray(contacts.phones)
    ? contacts.phones
    : [contacts.phone];
  const mainPhone = phones[0] || "";
  const mapUrl =
    "https://yandex.ru/maps/org/2841722067?si=w2ndm2demh24drzjvd1df8zucw";

  if (!$(".skip-link")) {
    const skip = document.createElement("a");
    skip.href = "#main";
    skip.className = "skip-link";
    skip.textContent = "Перейти к содержимому";
    document.body.prepend(skip);
  }

  const header =
    $(".header") ||
    (() => {
      const h = document.createElement("header");
      h.className = "header";
      document.body.prepend(h);
      return h;
    })();

  header.innerHTML = `
  <div class="container header__inner">
    <div class="header__brand">
      <a class="logo" href="/" aria-label="На главную">
        <img src="${project.logo}" alt="${
          project.name
        } — камень для бизнеса и дома" />
      </a>
      <button class="nav-toggle" aria-label="Меню" aria-expanded="false" aria-controls="site-nav">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
          <rect x="3" y="6" width="18" height="2" rx="1" fill="currentColor"/>
          <rect x="3" y="11" width="18" height="2" rx="1" fill="currentColor"/>
          <rect x="3" y="16" width="18" height="2" rx="1" fill="currentColor"/>
        </svg>
      </button>
    </div>

    <nav class="nav" id="site-nav" role="navigation" aria-label="Главное меню">
      <ul class="nav__list">
        <li class="nav__item"><a href="/catalog/">Каталог</a></li>
        <li class="nav__item nav__products">
          <button class="nav__products-toggle" type="button" aria-expanded="false" aria-controls="products-menu">
            Изделия <span class="nav__chevron" aria-hidden="true"></span>
          </button>
          <div class="nav__submenu" id="products-menu">
            <p class="nav__group-title">Изделия</p>
            <ul class="nav__submenu-list">
              <li><a href="/stoleshnicy/">Столешницы</a></li>
              <li><a href="/stoleshnicy/dlya-kuhni/">Для кухни</a></li>
              <li><a href="/stoleshnicy/dlya-vannoy/">Для ванной</a></li>
              <li><a href="/stoleshnicy/iz-kvarca/">Из кварца</a></li>
              <li><a href="/podokonniki/">Подоконники</a></li>
            </ul>
            <p class="nav__group-title nav__group-title--secondary">Дополнительно</p>
            <ul class="nav__submenu-list">
              <li><a href="/services/">Услуги</a></li>
              <li><a href="/works/">Работы</a></li>
            </ul>
          </div>
        </li>
        <li class="nav__item"><a href="/about/">О компании</a></li>
        <li class="nav__item"><a href="/contacts/">Контакты</a></li>
      </ul>
      <div class="nav__actions">
        <a class="btn btn--primary" href="/contacts/#request">Получить расчёт</a>
        <a class="btn btn--outline" href="${telLink(mainPhone)}">Позвонить</a>
      </div>
    </nav>

    <div class="header__actions">
      <a class="header__phone" href="${telLink(mainPhone)}">${mainPhone}</a>
      <a class="btn btn--primary header__cta" href="/contacts/#request">Получить расчёт</a>
    </div>
  </div>`;

  const navToggle = header.querySelector(".nav-toggle");
  const nav = header.querySelector(".nav");
  const productsToggle = header.querySelector(".nav__products-toggle");
  const products = header.querySelector(".nav__products");
  if (navToggle && nav) {
    const closeProducts = () => {
      products?.classList.remove("nav__products--open");
      productsToggle?.setAttribute("aria-expanded", "false");
    };
    const closeNav = () => {
      nav.classList.remove("nav--open");
      navToggle.setAttribute("aria-expanded", "false");
      navToggle.setAttribute("aria-label", "Меню");
      navToggle.classList.remove("nav-toggle--active");
      closeProducts();
    };

    navToggle.addEventListener("click", () => {
      const isOpen = nav.classList.toggle("nav--open");
      navToggle.setAttribute("aria-expanded", String(isOpen));
      navToggle.setAttribute("aria-label", isOpen ? "Закрыть меню" : "Меню");
      navToggle.classList.toggle("nav-toggle--active", isOpen);
    });

    productsToggle?.addEventListener("click", () => {
      const isOpen = products?.classList.toggle("nav__products--open");
      productsToggle.setAttribute("aria-expanded", String(Boolean(isOpen)));
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        if (products?.classList.contains("nav__products--open")) {
          closeProducts();
          productsToggle?.focus();
        } else if (nav.classList.contains("nav--open")) {
          closeNav();
          navToggle.focus();
        }
      }
    });

    document.addEventListener("pointerdown", (e) => {
      if (products?.classList.contains("nav__products--open") && !products.contains(e.target)) {
        closeProducts();
      }
    });

    nav.addEventListener("click", (e) => {
      const a = e.target.closest("a");
      if (!a) return;
      closeProducts();
      if (getComputedStyle(navToggle).display !== "none") {
        closeNav();
      }
    });
  }

  // подсветка активного меню
  const currentPath = (activePath || location.pathname).replace(/[#?].*$/, "");
  $$(".nav a", header).forEach((a) => {
    const linkPath = new URL(a.getAttribute("href"), location.origin).pathname;
    const isActive = linkPath === currentPath;
    a.toggleAttribute("aria-current", isActive);
    a.classList.toggle("nav__link--active", isActive);
  });
  products?.classList.toggle(
    "nav__products--active",
    $$(".nav__submenu a", products).some((a) =>
      new URL(a.getAttribute("href"), location.origin).pathname === currentPath,
    ),
  );

  // FOOTER
  const footer =
    $(".footer") ||
    (() => {
      const f = document.createElement("footer");
      f.className = "footer";
      document.body.appendChild(f);
      return f;
    })();

  const year = new Date().getFullYear();
  footer.innerHTML = `
    <div class="container footer__inner">
      <div class="footer__brand">${project.name}</div>
      <p class="footer__addr">
        <a href="${mapUrl}" target="_blank" rel="noopener" class="contact contact--addr">
          ${project.address}
        </a>
      </p>
      <p class="footer__contacts">
        <a href="${telLink(mainPhone)}">${mainPhone}</a> ·
        <a href="${mailtoLink(contacts.email)}">${contacts.email}</a>
      </p>
      <nav class="social-icons" aria-label="Мы в соцсетях">
        <a href="${
          social.telegram
        }" target="_blank" rel="noopener" aria-label="Telegram">
          <img src="/assets/images/ui/icon-telegram.svg" alt="" aria-hidden="true">
        </a>
        <a href="${
          social.instagram
        }" target="_blank" rel="noopener" aria-label="Instagram">
          <img src="/assets/images/ui/icon-instagram.svg" alt="" aria-hidden="true">
        </a>
      </nav>
    </div>
    <div class="container footer__bottom">
      <small class="muted">© ${year} ${
        project.name
      }. Все права защищены.</small>
    </div>`;
}

/* ===================== ХЛЕБНЫЕ КРОШКИ ===================== */
export function renderBreadcrumbs(activePath) {
  const HOME = "/";
  const TITLES = {
    [HOME]: "Главная",
    "/catalog/": "Коллекция камня",
    "/services/": "Услуги",
    "/works/": "Работы",
    "/about/": "О компании",
    "/contacts/": "Контакты",
    "/pages/admin.html": "Администрирование",
  };

  const norm = (p) => {
    if (p === "/" || p === "/index.html") return HOME;
    // Приводим старые .html пути к ЧПУ
    const map = {
      "/pages/catalog.html": "/catalog/",
      "/pages/services.html": "/services/",
      "/pages/works.html": "/works/",
      "/pages/about.html": "/about/",
      "/pages/contacts.html": "/contacts/",
    };
    return map[p] || p;
  };
  const currentPath = norm(
    (activePath || location.pathname).replace(/[#?].*$/, ""),
  );
  if (currentPath === HOME) {
    $(".breadcrumbs")?.remove();
    document.head.querySelector('script[data-breadcrumbs="true"]')?.remove();
    return;
  }

  let nav = $(".breadcrumbs");
  if (!nav) {
    nav = document.createElement("nav");
    nav.className = "breadcrumbs";
    nav.setAttribute("aria-label", "Хлебные крошки");
    nav.innerHTML = `<div class="container"><ol class="breadcrumbs__list"></ol></div>`;
    const main = $("#main");
    (main?.parentNode || document.body).insertBefore(
      nav,
      main || document.body.firstChild,
    );
  }

  const ol = nav.querySelector(".breadcrumbs__list");
  ol.innerHTML = "";

  const currentTitle =
    TITLES[currentPath] ||
    document.title.replace(/\s+—.+$/, "").trim() ||
    "Страница";
  const trail =
    currentPath.startsWith("/works/") && currentPath !== "/works/"
      ? [
          { href: HOME, title: TITLES[HOME] },
          { href: "/works/", title: TITLES["/works/"] },
          { href: currentPath, title: currentTitle },
        ]
      : [
          { href: HOME, title: TITLES[HOME] },
          { href: currentPath, title: currentTitle },
        ];

  trail.forEach((c, i, arr) => {
    const li = document.createElement("li");
    if (i < arr.length - 1) {
      li.innerHTML = `<a href="${c.href}">${c.title}</a>`;
    } else {
      li.innerHTML = `<span aria-current="page">${c.title}</span>`;
    }
    ol.appendChild(li);
  });

  // Обновляем структурированные данные для хлебных крошек (SEO)
  document.head.querySelector('script[data-breadcrumbs="true"]')?.remove();

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: trail.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.title,
      item: absoluteUrl(item.href),
    })),
  };

  const script = document.createElement("script");
  script.type = "application/ld+json";
  script.dataset.breadcrumbs = "true";
  script.textContent = JSON.stringify(jsonLd);
  document.head.appendChild(script);
}

/* ===================== КАТАЛОГ ===================== */
export async function initCatalog() {
  const grid = $("#catalog-grid");
  const filter = $("#type-filter");
  if (!grid || !filter) return;

  const all = await getData("catalog");
  const chips = Array.from(filter.querySelectorAll(".chip"));
  const knownTypes = new Set(["all"]);
  chips
    .map((btn) => normalize(btn.dataset.type))
    .filter(Boolean)
    .forEach((t) => knownTypes.add(t));
  all
    .map((item) => normalize(item.type))
    .filter(Boolean)
    .forEach((t) => knownTypes.add(t));

  const templateEl = $("#tpl-catalog-card");
  const templateRoot = templateEl?.content?.firstElementChild || null;

  const createCard = (m) => {
    const type = normalize(m.type);
    const materialText = m.typeRu?.trim() || materialLabel(type);
    const size = (m.sizeMm ?? "").toString().trim() || "—";
    const image = m.image || "/assets/images/ui/ph-3x2.webp";
    const title = m.title || "";
    const description = m.desc || "";
    const fabricator = m.fabricator || "—";

    if (templateRoot) {
      const node = templateRoot.cloneNode(true);
      node.dataset.type = type;
      node
        .querySelectorAll(
          '[data-field="materialRu"], [data-field="materialText"]',
        )
        .forEach((el) => (el.textContent = materialText));
      node.querySelector('[data-field="title"]').textContent = title;
      node.querySelector('[data-field="desc"]').textContent = description;
      node.querySelector('[data-field="fabricator"]').textContent = fabricator;
      node.querySelector('[data-field="size"]').textContent = size;
      const img = node.querySelector("img");
      if (img) {
        img.src = image;
        img.alt = title ? `Образец: ${title}` : "Образец материала";
      }
      return node;
    }

    const wrapper = document.createElement("div");
    wrapper.innerHTML = `
      <article class="card" data-type="${type}">
        <div class="media">
          <img src="${image}" alt="${
            title ? `Образец: ${title}` : "Образец материала"
          }"
               loading="lazy" decoding="async">
        </div>
        <h3>${title}</h3>
        <p class="muted">${description}</p>
        <ul class="spec">
          <li><b>Материал:</b> ${materialText}</li>
          <li><b>Размер:</b> ${size} мм</li>
          <li><b>Производитель:</b> ${fabricator}</li>
        </ul>
      </article>`;
    return wrapper.firstElementChild;
  };

  const render = (list) => {
    if (!list.length) {
      grid.innerHTML = `<p class="muted grid-empty">Нет материалов для выбранного фильтра.</p>`;
      return;
    }

    const fragment = document.createDocumentFragment();
    list.forEach((item) => {
      const card = createCard(item);
      if (card) fragment.appendChild(card);
    });
    grid.replaceChildren(fragment);
  };

  const setActive = (type) => {
    chips.forEach((btn) => {
      const target = normalize(btn.dataset.type) || "all";
      const active = target === type;
      btn.classList.toggle("active", active);
      btn.setAttribute("aria-pressed", String(active));
    });
  };

  const applyFilter = (type) => {
    const key = knownTypes.has(type) ? type : "all";
    setActive(key);

    const list =
      key === "all" ? all : all.filter((item) => normalize(item.type) === key);
    render(list);

    const url = new URL(location.href);
    if (key === "all") url.searchParams.delete("type");
    else url.searchParams.set("type", key);
    history.replaceState(null, "", url);
  };

  const startParam = normalize(new URL(location.href).searchParams.get("type"));
  applyFilter(startParam);

  filter.addEventListener("click", (e) => {
    const btn = e.target.closest(".chip,[data-type]");
    if (!btn) return;
    applyFilter(normalize(btn.dataset.type) || "all");
  });
}

/* ===================== РАБОТЫ ===================== */
export async function initWorks() {
  const grid = $("#worksGrid");
  const filter = $("#works-type-filter");
  if (!grid || !filter) return;

  const all = await getData("works");
  const projectSlugs = await loadJSON("/assets/data/project-slugs.json");

  const chipButtons = Array.from(filter.querySelectorAll(".chip"));
  const allowedTypes = new Set(["all"]);
  chipButtons
    .map((btn) => normalize(btn.dataset.type))
    .filter(Boolean)
    .forEach((t) => allowedTypes.add(t));
  all
    .flatMap((item) =>
      Array.isArray(item.material) ? item.material : [item.material],
    )
    .map(normalize)
    .filter(Boolean)
    .forEach((t) => allowedTypes.add(t));

  const materialsOf = (m) => {
    if (Array.isArray(m)) return m.map(normalize).filter(Boolean);
    const one = normalize(m);
    return one ? [one] : [];
  };

  const tplCard = (w) => {
    const mats = materialsOf(w.material);
    const matRu =
      w.materialRu && w.materialRu.trim()
        ? w.materialRu
        : mats.map(materialLabel).join(", ");

    const images = Array.isArray(w.images)
      ? w.images
      : [w.image].filter(Boolean);
    const projectUrl = projectSlugs[w.id]
      ? `/works/${projectSlugs[w.id]}/`
      : "";
    const slides = (images.length ? images : ["/assets/images/ui/ph-3x2.webp"])
      .map(
        (src, i) => `
        <div class="slide ${i === 0 ? "active" : ""}">
          <img src="${src}" 
               alt="${w.title ? `Проект: ${w.title}` : "Пример работы"}" 
               loading="lazy" />
        </div>`,
      )
      .join("");

    return `
    <article class="work-card" data-material="${mats.join(",")}">
      <div class="carousel">
        ${slides}
        ${
          (images.length || 1) > 1
            ? `<button class="prev" aria-label="Предыдущий слайд">&#10094;</button>
               <button class="next" aria-label="Следующий слайд">&#10095;</button>`
            : ""
        }
      </div>
      <div class="work-card__body">
        <h3>${
          projectUrl
            ? `<a href="${projectUrl}">${w.title || ""}</a>`
            : w.title || ""
        }</h3>
        <ul>
          <li><strong>Материал:</strong> ${matRu || "—"}</li>
          <li><strong>Локация:</strong> ${w.location || "—"}</li>
        </ul>
        <p>${w.desc || ""}</p>
        ${projectUrl ? `<a class="work-card__link" href="${projectUrl}">Открыть проект</a>` : ""}
      </div>
    </article>`;
  };

  const initCarousel = (card) => {
    const slides = card.querySelectorAll(".slide");
    const prev = card.querySelector(".prev");
    const next = card.querySelector(".next");
    let index = 0;
    if (!slides.length) return;

    const show = (i) => {
      slides.forEach((s, j) => s.classList.toggle("active", j === i));
      index = i;
    };

    prev?.addEventListener("click", () =>
      show((index - 1 + slides.length) % slides.length),
    );
    next?.addEventListener("click", () => show((index + 1) % slides.length));
  };

  const draw = (type) => {
    const list =
      type === "all"
        ? all
        : all.filter((x) => materialsOf(x.material).includes(type));
    grid.innerHTML = list.length
      ? list.map(tplCard).join("")
      : `<p class="muted grid-empty">Нет проектов для выбранного фильтра.</p>`;
    grid.querySelectorAll(".work-card").forEach(initCarousel);
  };

  const setActive = (t) => {
    filter.querySelectorAll(".chip").forEach((b) => {
      const on = (b.dataset.type || "all") === t;
      b.classList.toggle("active", on);
      b.setAttribute("aria-pressed", on ? "true" : "false");
    });
  };

  const initialParam = normalize(
    new URL(location.href).searchParams.get("material"),
  );
  const initial = allowedTypes.has(initialParam) ? initialParam : "all";

  setActive(initial);
  draw(initial);

  filter.addEventListener("click", (e) => {
    const btn = e.target.closest(".chip");
    if (!btn) return;
    const type = normalize(btn.dataset.type) || "all";

    setActive(type);

    // Обновляем URL без перезагрузки
    const u = new URL(location.href);
    u.searchParams.set("material", type);
    history.replaceState(null, "", u);

    draw(type);
  });
}

/* ===================== РАНДОМНЫЕ РАБОТЫ НА ГЛАВНОЙ ===================== */
export async function renderRandomWorks() {
  const container =
    document.querySelector("#homeWorks") ||
    document.querySelector("#worksTeaser");
  if (!container) return;

  const all = await getData("works");
  if (!all.length) return;

  const random = [...all].sort(() => Math.random() - 0.5).slice(0, 3);
  const fallbackPlaceholder = "/assets/images/ui/ph-3x2.webp";

  const escapeHTML = (value) =>
    String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");

  const renderCard = (work) => {
    const primaryImage = Array.isArray(work.images)
      ? work.images[0]
      : work.image;
    const materialText =
      work.materialRu && work.materialRu.trim()
        ? work.materialRu
        : Array.isArray(work.material)
          ? work.material.map(materialLabel).join(", ")
          : materialLabel(work.material);

    return `
      <article class="work-card">
        <a class="work-card__media" href="${escapeHTML(
          primaryImage || "#",
        )}" target="_blank" rel="noopener">
          <img src="${escapeHTML(primaryImage || fallbackPlaceholder)}"
               alt="${escapeHTML(
                 work.title ? `Проект: ${work.title}` : "Пример работы",
               )}" loading="lazy" width="800" height="533">
        </a>
        <div class="work-card__body">
          <h3 class="work-card__title">${escapeHTML(work.title)}</h3>
          <ul class="work-card__meta">
            <li><strong>Материал:</strong> ${escapeHTML(materialText)}</li>
            <li><strong>Локация:</strong> ${escapeHTML(work.location)}</li>
          </ul>
          <p class="work-card__desc">${escapeHTML(work.desc)}</p>
        </div>
      </article>`;
  };

  container.innerHTML = random.map(renderCard).join("");
}

/* ===================== ПОДСТАНОВКА КОНТАКТОВ ===================== */
export async function populateContactsOnContactsPage() {
  const { project, contacts, social, locations } = await loadContent();
  const phones = Array.isArray(contacts.phones)
    ? contacts.phones
    : [contacts.phone];
  const mainPhone = phones[0] || "";

  const phoneList = $("#c-phones");
  if (phoneList) {
    phoneList.innerHTML = phones
      .map(
        (p) =>
          `<li><a href="${telLink(
            p,
          )}" class="contact contact--tel">${p}</a></li>`,
      )
      .join("");
  }

  const mail = $("#c-mail");
  if (mail && contacts.email) {
    mail.textContent = contacts.email;
    mail.href = mailtoLink(contacts.email);
  }

  // Адрес удален из блока контактов
  // const addr = $("#c-addr");
  // if (addr && locations && locations[0]) {
  //   addr.textContent = locations[0].address;
  //   addr.href = locations[0].link;
  // } else if (addr && project.address) {
  //   addr.textContent = project.address;
  //   addr.href = "#";
  // }

  // Рендер локаций
  const locationsContainer = $("#c-locations");
  if (locationsContainer && locations && Array.isArray(locations)) {
    locationsContainer.innerHTML = locations
      .map(
        (loc) => `
          <div class="location-card" style="margin-bottom: 16px; padding: 12px; background: #f9fafb; border-radius: 8px;">
            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
              <strong>${loc.type === "shop" ? "💎" : "🏭"} ${loc.title}</strong>
              <span style="font-size: 11px; font-weight: 700; text-transform: uppercase; background: #e5e7eb; padding: 2px 6px; border-radius: 4px; color: #666;">${loc.badge}</span>
            </div>
            <p style="margin: 0 0 6px 0; font-size: 14px;">${loc.address}</p>
            ${loc.time ? `<p style="margin: 0 0 8px 0; font-size: 12px; color: #666;">🕒 ${loc.time}</p>` : ""}
            <a href="${loc.link}" target="_blank" rel="noopener" style="display: inline-block; padding: 8px 12px; background: #d4af37; color: #fff; text-decoration: none; border-radius: 6px; font-size: 13px; font-weight: 600;">Открыть на карте</a>
          </div>
        `,
      )
      .join("");
  }

  if ($("#c-tg")) $("#c-tg").href = social.telegram || "#";
  if ($("#c-ig")) $("#c-ig").href = social.instagram || "#";

  const messengerTelegram = $("#messenger-telegram");
  if (messengerTelegram) {
    messengerTelegram.href = social.telegram || telLink(mainPhone);
  }

  const messengerInstagram = $("#messenger-instagram");
  if (messengerInstagram) {
    messengerInstagram.href = social.instagram || "#";
  }

  const digits = String(mainPhone || "").replace(/\D+/g, "");
  const phoneWithPlus = digits ? `+${digits}` : "";

  const messengerViber = $("#messenger-viber");
  if (messengerViber && !messengerViber.hasAttribute("data-static-messenger")) {
    messengerViber.href = phoneWithPlus
      ? `viber://chat?number=${encodeURIComponent(phoneWithPlus)}`
      : telLink(mainPhone);
  }

  const messengerWhatsApp = $("#messenger-whatsapp");
  if (
    messengerWhatsApp &&
    !messengerWhatsApp.hasAttribute("data-static-messenger")
  ) {
    messengerWhatsApp.href = digits
      ? `https://wa.me/${digits}`
      : telLink(mainPhone);
  }

  // Карта удалена для оптимизации производительности
  // initMapWithMarkers(locations);
}

/* ===================== ИНИЦИАЛИЗАЦИЯ КАРТЫ С МАРКЕРАМИ ===================== */
async function initMapWithMarkers(locations) {
  const mapContainer = $("#map");
  if (!mapContainer || !locations || locations.length === 0) return;

  // Загружаем Яндекс Карты API
  await loadYandexMapsAPI();

  // Если API загружен, инициализируем карту
  if (typeof ymaps !== "undefined") {
    ymaps.ready(() => {
      // Координаты для каждой локации из JSON
      const coords = locations
        .filter((loc) => loc.lat && loc.lng)
        .map((loc) => [loc.lat, loc.lng]);

      if (coords.length === 0) return;

      // Создаем карту с расчетом масштаба на обе точки
      const centerLat = (coords[0][0] + coords[coords.length - 1][0]) / 2;
      const centerLng = (coords[0][1] + coords[coords.length - 1][1]) / 2;

      const map = new ymaps.Map("map", {
        center: [centerLat, centerLng],
        zoom: 13,
        controls: ["zoomControl", "fullscreenControl"],
      });

      const clusterer = new ymaps.Clusterer({
        preset: "islands.orange",
        clusterDisableClickZoom: false,
      });

      const placemarks = locations
        .map((loc) => {
          if (!loc.lat || !loc.lng) return null;

          const label = loc.type === "shop" ? "💎" : "🏭";
          const marker = new ymaps.Placemark(
            [loc.lat, loc.lng],
            {
              hintContent: loc.title,
              balloonContent: `
              <strong>${label} ${loc.title}</strong><br/>
              ${loc.address}<br/>
              ${loc.time ? `<small>🕒 ${loc.time}</small><br/>` : ""}
              <a href="${loc.link}" target="_blank" style="color: #d4af37; text-decoration: none; font-weight: 600;">Открыть на Яндекс Картах</a>
            `,
            },
            {
              preset: loc.type === "shop" ? "islands.blue" : "islands.orange",
            },
          );
          return marker;
        })
        .filter(Boolean);

      clusterer.add(placemarks);
      map.geoObjects.add(clusterer);

      // Устанавливаем центр и масштаб для видимости всех маркеров
      map.setBounds(map.geoObjects.getBounds());
    });
  }
}

/* ===================== ЗАГРУЗКА ЯНДЕКС КАРТ API (БЕЗ КЛЮЧА) ===================== */
function loadYandexMapsAPI() {
  return new Promise((resolve) => {
    if (typeof ymaps !== "undefined") {
      resolve();
      return;
    }

    const script = document.createElement("script");
    // Яндекс Карты 2.1 работает без ключа (с водяным знаком)
    script.src = "https://api-maps.yandex.ru/2.1/?lang=ru_RU";
    script.async = true;
    script.defer = true;

    script.onload = () => resolve();
    script.onerror = () => resolve(); // Не прерываем работу при ошибке

    document.head.appendChild(script);
  });
}

/* ===================== ЯНДЕКС.КАРТА ===================== */
export async function initYandexMapLazy() {
  const mapContainer = $("#map");
  if (!mapContainer) return;

  const { map } = await loadContent();
  const { lat, lng, zoom, placemark } = map || {
    lat: 53.1384,
    lng: 29.2214,
    zoom: 12,
    placemark: "PRO Камень",
  };

  // Safari fallback: если IntersectionObserver нет — загружаем сразу
  const loadMap = () => {
    const s = document.createElement("script");
    s.src = "https://api-maps.yandex.ru/2.1/?lang=ru_RU";
    s.async = true;
    s.onload = () => {
      if (window.ymaps) {
        ymaps.ready(() => {
          const ymap = new ymaps.Map("map", {
            center: [lat, lng],
            zoom,
            controls: ["zoomControl", "fullscreenControl"],
          });
          const pm = new ymaps.Placemark(
            [lat, lng],
            { balloonContent: placemark },
            { preset: "islands#redIcon" },
          );
          ymap.geoObjects.add(pm);
        });
      }
    };
    document.head.appendChild(s);
  };

  if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        io.disconnect();
        loadMap();
      }
    });
    io.observe(mapContainer);
  } else {
    // fallback для Safari
    loadMap();
  }
}

/* ===================== АВТОЗАПУСК ===================== */
document.addEventListener("DOMContentLoaded", () => {
  renderHeaderFooter()
    .catch(console.error)
    .finally(() => renderBreadcrumbs());

  initCatalog().catch(() => {});
  initWorks().catch(() => {});
  renderRandomWorks().catch(() => {});
  populateContactsOnContactsPage().catch(() => {});
  populateContactsOnContactsPage().catch((err) =>
    console.error("Ошибка локаций:", err),
  );
});
