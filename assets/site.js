// BurnArc site: gauges drawn like the app's FocusGauge, the hero cycle,
// the run-out demo (same maths as UsageWindow.averageBurn/projectedRunOut)
// and the theme switch.
(function () {
  "use strict";
  var NS = "http://www.w3.org/2000/svg";
  var reduce = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;

  // --- Formatting, as in UsageFormat.duration ---------------------------
  function duration(hours, compact) {
    var minutes = Math.max(Math.round(hours * 60), 0);
    var d = Math.floor(minutes / 1440), h = Math.floor((minutes % 1440) / 60), m = minutes % 60;
    var sep = compact ? "" : " ";
    if (d > 0) return h > 0 ? d + "d" + sep + h + "h" : d + "d";
    if (h > 0) {
      if (compact) return m > 0 ? h + "h" + String(m).padStart(2, "0") : h + "h";
      return m > 0 ? h + "h " + m + "m" : h + "h";
    }
    return m + "m";
  }

  // --- Gauge: two half arcs, 128x74, line 10, inner inset 16 -------------
  var CX = 64, CY = 69, LW = 10;
  function arcPath(r, f) {
    f = Math.min(Math.max(f, 0), 1);
    var a = Math.PI * f;
    var x = CX - r * Math.cos(a), y = CY - r * Math.sin(a);
    return "M" + (CX - r) + " " + CY + "A" + r + " " + r + " 0 0 1 " + x.toFixed(2) + " " + y.toFixed(2);
  }
  function tickPath(r, p) {
    var a = Math.PI * p, c = Math.cos(a), s = Math.sin(a), h = LW * 0.9;
    return "M" + (CX - (r - h) * c).toFixed(2) + " " + (CY - (r - h) * s).toFixed(2) +
      "L" + (CX - (r + h) * c).toFixed(2) + " " + (CY - (r + h) * s).toFixed(2);
  }
  function el(name, attrs) {
    var e = document.createElementNS(NS, name);
    for (var k in attrs) e.setAttribute(k, attrs[k]);
    return e;
  }
  function buildGauge(host) {
    var svg = el("svg", { viewBox: "0 0 128 74", "aria-hidden": "true", focusable: "false" });
    var parts = {};
    [["o", 59], ["i", 43]].forEach(function (ring) {
      var key = ring[0], r = ring[1];
      var g = el("g", { fill: "none", "stroke-linecap": "round" });
      g.appendChild(el("path", { d: arcPath(r, 1), stroke: "var(--track)", "stroke-width": LW }));
      var fill = el("path", { d: arcPath(r, 0.0001), "stroke-width": LW });
      var tick = el("path", { d: tickPath(r, 0.5), stroke: "var(--text)", "stroke-width": 2 });
      g.appendChild(fill); g.appendChild(tick);
      svg.appendChild(g);
      parts[key] = { r: r, fill: fill, tick: tick, group: g };
    });
    host.insertBefore(svg, host.firstChild);
    host._gauge = parts;
    return parts;
  }
  // state: { o: {f, color, pace}, i: {f, color, pace} | null }
  function setGauge(host, state) {
    var parts = host._gauge || buildGauge(host);
    ["o", "i"].forEach(function (k) {
      var s = state[k], p = parts[k];
      p.group.style.display = s ? "" : "none";
      if (!s) return;
      p.fill.setAttribute("d", arcPath(p.r, Math.max(s.f, 0.0001)));
      p.fill.setAttribute("stroke", s.color);
      p.fill.style.opacity = s.f > 0 ? 1 : 0;
      p.tick.style.display = s.pace == null ? "none" : "";
      if (s.pace != null) p.tick.setAttribute("d", tickPath(p.r, s.pace));
    });
  }
  function num(v) { return v === "" || v == null ? null : parseFloat(v); }
  document.querySelectorAll(".gauge[data-o]").forEach(function (host) {
    var d = host.dataset;
    setGauge(host, {
      o: { f: num(d.o), color: d.oc || "var(--accent)", pace: num(d.op) },
      i: d.i ? { f: num(d.i), color: d.ic || "var(--weekly)", pace: num(d.ip) } : null
    });
  });

  // --- Menu-bar tray icon: 24x16, centre (11,13), radii 9 and 4.5 -------
  function trayArc(r, f) {
    f = Math.min(Math.max(f, 0.001), 1);
    var a = Math.PI * f;
    return "M" + (11 - r) + " 13A" + r + " " + r + " 0 0 1 " + (11 - r * Math.cos(a)).toFixed(2) + " " + (13 - r * Math.sin(a)).toFixed(2);
  }
  function setTray(svg, outer, inner, danger) {
    var color = danger ? "#FF8A6B" : "currentColor";
    svg.innerHTML =
      '<g fill="none" stroke-width="2.5" stroke-linecap="round">' +
      '<path d="' + trayArc(9, 1) + '" stroke="currentColor" opacity=".3"/>' +
      '<path d="' + trayArc(9, outer) + '" stroke="' + color + '"/>' +
      '<path d="' + trayArc(4.5, 1) + '" stroke="currentColor" opacity=".3"/>' +
      '<path d="' + trayArc(4.5, inner) + '" stroke="currentColor"/></g>';
  }
  document.querySelectorAll("svg.tray[data-o]").forEach(function (svg) {
    setTray(svg, num(svg.dataset.o), num(svg.dataset.i), svg.dataset.danger === "1");
  });

  // --- Hero: on pace -> runs out -> out, back in 12m ----------------------
  var hero = document.querySelector(".hero-gauge");
  if (hero) {
    var num$ = hero.querySelector(".g-num b"), sub$ = hero.querySelector(".g-sub");
    var cap$ = document.querySelector(".hero-caption");
    var bar$ = document.querySelector("[data-hero-title]");
    var tray$ = document.querySelector("[data-hero-tray]");
    var states = [
      { used: 42, pace: 0.52, week: 18, caption: "resets in 2h 24m", title: "42% · 2h24", danger: false },
      { used: 78, pace: 0.52, week: 21, caption: "runs out in 44m", title: "78% · out 44m", danger: true },
      { used: 100, pace: 0.96, week: 24, caption: "out · back in 12m", title: "100% · back 12m", danger: true }
    ];
    var i = 0;
    var show = function () {
      var s = states[i];
      var color = s.danger ? "var(--danger)" : "var(--accent)";
      setGauge(hero, {
        o: { f: s.used / 100, color: color, pace: s.pace },
        i: { f: s.week / 100, color: "var(--weekly)", pace: 0.35 }
      });
      num$.textContent = s.used + "%";
      num$.style.color = s.danger ? "var(--danger)" : "var(--text)";
      sub$.textContent = "Week " + s.week + "%";
      cap$.textContent = s.caption;
      cap$.style.color = s.danger ? "var(--danger)" : "var(--text-2)";
      if (bar$) bar$.textContent = s.title;
      if (tray$) setTray(tray$, s.used / 100, s.week / 100, s.danger);
    };
    show();
    if (!reduce) setInterval(function () { i = (i + 1) % states.length; show(); }, 3200);
  }

  // --- Run-out demo -------------------------------------------------------
  var demo = document.getElementById("demo-form");
  if (demo) {
    var used = demo.querySelector("#used"), elapsed = demo.querySelector("#elapsed");
    var kind = demo.querySelectorAll("input[name=window]");
    var gauge = document.querySelector(".demo-gauge");
    var out = function (id) { return document.getElementById(id); };
    var update = function () {
      var weekly = demo.querySelector("input[name=window]:checked").value === "weekly";
      var dur = weekly ? 168 : 5;
      elapsed.max = dur; elapsed.step = weekly ? 1 : 0.1;
      if (parseFloat(elapsed.value) > dur) elapsed.value = dur;
      var percent = Math.round(parseFloat(used.value));
      var e = Math.max(parseFloat(elapsed.value), weekly ? 1 : 0.1);
      var remaining = dur - e;
      out("used-out").textContent = percent + "%";
      out("elapsed-out").textContent = duration(e) + " of " + (weekly ? "7d" : "5h");
      var burn = percent > 0 && percent < 100 ? percent / e : null;
      var onPace = (e / dur) * 100;
      var delta = Math.round(onPace - percent);
      out("burn").textContent = burn == null ? "—" : burn.toFixed(1) + "%/h";
      out("pace").textContent = delta === 0 ? "on pace" : Math.abs(delta) + (delta > 0 ? " pts behind" : " pts ahead");
      out("reset").textContent = duration(remaining);
      var verdict, danger = false;
      if (percent >= 100) { verdict = "out · back in " + duration(remaining); danger = true; }
      else if (burn == null) { verdict = "Clock starts with your first message"; }
      else {
        var runOut = (100 - percent) / burn;
        if (runOut < remaining) { verdict = "runs out in " + duration(runOut); danger = true; }
        else verdict = "lasts until it resets in " + duration(remaining);
      }
      var v = out("verdict");
      v.textContent = verdict;
      v.style.color = danger ? "var(--danger)" : "var(--success)";
      var color = danger ? "var(--danger)" : weekly ? "var(--weekly)" : "var(--accent)";
      setGauge(gauge, { o: { f: percent / 100, color: color, pace: e / dur }, i: null });
      gauge.querySelector(".g-num b").textContent = percent + "%";
      gauge.querySelector(".g-sub").textContent = weekly ? "weekly" : "5-hour";
    };
    used.addEventListener("input", update);
    elapsed.addEventListener("input", update);
    kind.forEach(function (k) { k.addEventListener("change", function () {
      elapsed.value = k.value === "weekly" ? 72 : 3; update();
    }); });
    update();
  }

  // --- Theme (the app's Default / Mono / Vivid) ----------------------------
  var root = document.documentElement;
  var apply = function (t) {
    if (t === "default") root.removeAttribute("data-theme"); else root.setAttribute("data-theme", t);
    document.querySelectorAll(".themes button").forEach(function (b) {
      b.setAttribute("aria-pressed", String(b.dataset.theme === t));
    });
  };
  var saved = "default";
  try { saved = localStorage.getItem("burnarc.theme") || "default"; } catch (e) {}
  apply(saved);
  document.querySelectorAll(".themes button").forEach(function (b) {
    b.addEventListener("click", function () {
      apply(b.dataset.theme);
      try { localStorage.setItem("burnarc.theme", b.dataset.theme); } catch (e) {}
    });
  });

  // --- Reveal on scroll ----------------------------------------------------
  var items = document.querySelectorAll(".reveal");
  if (reduce || !("IntersectionObserver" in window)) {
    items.forEach(function (n) { n.classList.add("in"); });
  } else {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { if (en.isIntersecting) { en.target.classList.add("in"); io.unobserve(en.target); } });
    }, { rootMargin: "0px 0px -8% 0px" });
    items.forEach(function (n) { io.observe(n); });
  }
})();
