/* Marshal Fitness — moving exercise drawings (version 21).
   A small stick figure is drawn in SVG and moved between key poses.
   Side view: the figure looks to the right. Angles are in degrees.
   Used by exercises.js (product window and muscle map). */
(function () {
  "use strict";
  var DEG = Math.PI / 180;
  var L = { torso: 26, neck: 4, head: 5.5, ua: 13, fa: 12, th: 15, sh: 15, ft: 5 };
  var GROUND = 94;

  function sin(a) { return Math.sin(a * DEG); }
  function cos(a) { return Math.cos(a * DEG); }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function r1(v) { return Math.round(v * 10) / 10; }
  // a point "len" away from p; angle measured from straight DOWN, + turns to the front (+x)
  function down(p, len, ang) { return [p[0] + len * sin(ang), p[1] + len * cos(ang)]; }
  // a point "len" away from p; angle measured from straight UP, + leans to the front
  function upw(p, len, ang) { return [p[0] + len * sin(ang), p[1] - len * cos(ang)]; }

  // two-bone reach: middle joint between a and target b; bend picks the side (+1 / -1)
  function ik(a, b, l1, l2, bend) {
    var dx = b[0] - a[0], dy = b[1] - a[1];
    var d = Math.sqrt(dx * dx + dy * dy) || 0.001;
    var dmax = l1 + l2 - 0.01, dmin = Math.abs(l1 - l2) + 0.01;
    var dd = clamp(d, dmin, dmax);
    var base = Math.atan2(dy, dx);
    var A = Math.acos(clamp((l1 * l1 + dd * dd - l2 * l2) / (2 * l1 * dd), -1, 1));
    var ang = base + (bend || 1) * A;
    var m = [a[0] + l1 * Math.cos(ang), a[1] + l1 * Math.sin(ang)];
    var e = [a[0] + dx / d * dd, a[1] + dy / d * dd];
    return [m, e];
  }

  /* ---------- poses ---------- */
  var STAND = { x: 52, y: 64, t: 0, n: 0, a1: 0, e1: 0, a2: 0, e2: 0, l1: 0, k1: 0, l2: 0, k2: 0, fa1: 0, fa2: 0 };
  function S(o) { var p = {}, k; for (k in STAND) p[k] = STAND[k]; for (k in o) p[k] = o[k]; return p; }

  function lerp(a, b, u) {
    if (a === undefined) return b;
    if (b === undefined) return a;
    if (typeof a === "number") return a + (b - a) * u;
    if (a && a.length === 2) return [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u];
    return u < 0.5 ? a : b;
  }
  function mix(p, q, u) {
    var o = {}, k;
    for (k in p) o[k] = lerp(p[k], q[k], u);
    for (k in q) if (!(k in o)) o[k] = q[k];
    return o;
  }

  // joints of the side figure. floor = where the feet stand (toes never go below it)
  function joints(p, floor) {
    var hip = [p.x, p.y];
    var sh = upw(hip, L.torso, p.t);
    var head = upw(sh, L.neck + L.head, p.t + (p.n || 0));
    var J = { hip: hip, sh: sh, head: head, p: p };
    [1, 2].forEach(function (i) {
      var off = i === 2 ? [-1.6, -0.6] : [0, 0]; // the far side looks a little higher (seen from slightly above)
      var s = [sh[0] + off[0], sh[1] + off[1]];
      var h = p["h" + i] || p.h1, hr = p["hr" + i] || p.hr1, hh = p["hh" + i] || p.hh1;
      var el, ha;
      if (hr) h = [sh[0] + hr[0], sh[1] + hr[1]];
      if (hh) h = [hip[0] + hh[0], hip[1] + hh[1]];
      // as = arm seen from the side while it points out to the side: it looks shorter
      var as = p["as" + i] || p.as1 || 1;
      if (h) {
        var r = ik(s, [h[0] + off[0], h[1] + off[1]], L.ua * as, L.fa * as, p["hb" + i] || p.hb1 || 1);
        el = r[0]; ha = r[1];
      } else {
        el = down(s, L.ua, p["a" + i]);
        ha = down(el, L.fa, p["a" + i] + p["e" + i]);
      }
      J["s" + i] = s; J["el" + i] = el; J["ha" + i] = ha;
      var hp = [hip[0] + off[0], hip[1] + off[1]];
      var f = p["f" + i] || p.f1, kn, an, shin;
      if (f) {
        var q = ik(hp, [f[0] + off[0], f[1] + off[1]], L.th, L.sh, p["fb" + i] || p.fb1 || -1);
        kn = q[0]; an = q[1];
        shin = Math.atan2(an[0] - kn[0], an[1] - kn[1]) / DEG;
      } else {
        kn = down(hp, L.th, p["l" + i]);
        shin = p["l" + i] - p["k" + i];
        an = down(kn, L.sh, shin);
      }
      J["hp" + i] = hp; J["kn" + i] = kn; J["an" + i] = an;
      var tt = p["tt" + i] || p.tt1, to;
      if (tt) {
        // the foot points to a target (a pedal)
        var tx = tt[0] + off[0] - an[0], ty = tt[1] + off[1] - an[1], tl = Math.sqrt(tx * tx + ty * ty) || 1;
        to = [an[0] + L.ft * tx / tl, an[1] + L.ft * ty / tl];
      } else {
        to = down(an, L.ft, shin + 90 + (p["fa" + i] || 0));
      }
      // toes never go into the floor: the foot turns at the ankle and lies on the floor
      if (floor && to[1] > floor) {
        var dir = to[0] >= an[0] ? 1 : -1, dy = floor - an[1];
        if (dy <= 0.01) to = [an[0] + dir * L.ft, an[1]];
        else to = [an[0] + dir * Math.sqrt(Math.max(0, L.ft * L.ft - dy * dy)), floor];
      }
      J["to" + i] = to;
    });
    return J;
  }

  // joints of the front figure (everything given as points)
  function jointsFront(p) {
    var x = p.x, y = p.y;
    var neck = [x, y - L.torso];
    var J = { front: true, hip: [x, y], neck: neck, head: [x, neck[1] - L.neck - L.head], p: p };
    J.sL = [x - 7, neck[1] + 1]; J.sR = [x + 7, neck[1] + 1];
    J.hL = [x - 4.5, y]; J.hR = [x + 4.5, y];
    J.eL = p.eL || [x - 8, neck[1] + 14]; J.wL = p.wL || [x - 8.5, neck[1] + 26];
    J.eR = p.eR || [x + 8, neck[1] + 14]; J.wR = p.wR || [x + 8.5, neck[1] + 26];
    J.kL = p.kL || [x - 5, y + 15]; J.fL = p.fL || [x - 5.5, GROUND];
    J.kR = p.kR || [x + 5, y + 15]; J.fR = p.fR || [x + 5.5, GROUND];
    return J;
  }

  /* ---------- drawing helpers (SVG text) ---------- */
  function P(pt) { return r1(pt[0]) + "," + r1(pt[1]); }
  function line(a, b, cls, w) {
    return '<line class="' + cls + '" x1="' + r1(a[0]) + '" y1="' + r1(a[1]) + '" x2="' + r1(b[0]) + '" y2="' + r1(b[1]) + '"' +
      (w ? ' stroke-width="' + w + '"' : "") + "/>";
  }
  function poly(pts, cls, w) {
    return '<polyline class="' + cls + '" points="' + pts.map(P).join(" ") + '"' + (w ? ' stroke-width="' + w + '"' : "") + "/>";
  }
  function circ(c, r, cls) { return '<circle class="' + cls + '" cx="' + r1(c[0]) + '" cy="' + r1(c[1]) + '" r="' + r + '"/>'; }
  function rect(x, y, w, h, cls, rr) {
    return '<rect class="' + cls + '" x="' + r1(x) + '" y="' + r1(y) + '" width="' + r1(w) + '" height="' + r1(h) + '" rx="' + (rr || 1.5) + '"/>';
  }
  function ground(a, b) { return line([a === undefined ? 6 : a, GROUND + 1.6], [b === undefined ? 114 : b, GROUND + 1.6], "fx-g", 1.2); }
  function plate(c, r) { return circ(c, r, "fx-a fx-fill") + circ(c, Math.max(1.2, r * 0.22), "fx-hole"); }
  function dumbbell(c) { return line([c[0] - 4, c[1]], [c[0] + 4, c[1]], "fx-a", 2.2) + circ([c[0] - 4, c[1]], 2.6, "fx-a fx-fill") + circ([c[0] + 4, c[1]], 2.6, "fx-a fx-fill"); }
  function handle(c) { return line([c[0], c[1] - 3], [c[0], c[1] + 3], "fx-a", 3); }
  function mat() { return rect(10, GROUND, 100, 2.2, "fx-e fx-fill2", 1); }

  function body(J, opt) {
    var s = "";
    var far = opt.hide2 ? "" : (
      poly([J.s2, J.el2, J.ha2], "fx-b fx-far") +
      poly([J.hp2, J.kn2, J.an2, J.to2], "fx-b fx-far"));
    s += far;
    s += line(J.hip, J.sh, "fx-b", 4.6);
    s += circ(J.head, L.head, "fx-b fx-fill");
    s += poly([J.hp1, J.kn1, J.an1, J.to1], "fx-b");
    s += poly([J.s1, J.el1, J.ha1], "fx-b");
    return s;
  }
  function bodyFront(J) {
    var s = "";
    s += line(J.neck, [J.hip[0], J.hip[1] - 2], "fx-b", 5);
    s += line(J.sL, J.sR, "fx-b", 4.2);
    s += line(J.hL, J.hR, "fx-b", 4.2);
    s += circ(J.head, L.head, "fx-b fx-fill");
    s += poly([J.hL, J.kL, J.fL], "fx-b");
    s += poly([J.hR, J.kR, J.fR], "fx-b");
    s += poly([J.sL, J.eL, J.wL], "fx-b");
    s += poly([J.sR, J.eR, J.wR], "fx-b");
    return s;
  }

  /* ---------- scenes (equipment) ---------- */
  function seatSide(opts) {
    opts = opts || {};
    var s = ground(10, 90);
    s += rect(24, 74, 26, 4.5, "fx-e fx-fill2");          // seat
    s += line([37, 78.5], [37, GROUND], "fx-e", 2.4);       // post
    if (!opts.noBack) s += rect(opts.backX || 23, opts.backTop || 40, 5, 34, "fx-e fx-fill2", 2); // back pad
    return s;
  }
  function treadmill(k) {
    var s = rect(12, GROUND - 1, 86, 4, "fx-e fx-fill2", 2);
    s += line([96, GROUND - 1], [99, 48], "fx-e", 2.6);
    s += line([99, 50], [86, 52], "fx-e", 2.6);
    for (var i = 0; i < 6; i++) {
      var x = 14 + ((i * 15 - k * 30) % 90 + 90) % 90;
      if (x < 92) s += line([x, GROUND + 1.6], [x + 5, GROUND + 1.6], "fx-move", 1.2);
    }
    return s;
  }
  var CRANK = [62, 80], CRANK_R = 7;
  function pedal(k, side) {
    var a = k * 360 + (side === 2 ? 180 : 0);
    return [CRANK[0] + CRANK_R * Math.cos(a * DEG), CRANK[1] + CRANK_R * Math.sin(a * DEG)];
  }
  function bikeScene(J, k) {
    var c = CRANK;
    var s = ground(18, 108);
    s += line([48, GROUND - 2], [96, GROUND - 2], "fx-e", 2.6);   // base
    s += line([54, 60], [c[0], c[1]], "fx-e", 2.6);                // seat post
    s += line([c[0], c[1]], [56, GROUND - 2], "fx-e", 2.6);        // frame
    s += circ([86, 80], 9, "fx-e");                                 // flywheel
    s += line([92, GROUND - 2], [84, 44], "fx-e", 2.6);            // handlebar post
    s += line([84, 44], [78, 44], "fx-e", 3);                       // handlebar
    s += rect(46, 58, 14, 3.2, "fx-e fx-fill2");                    // saddle
    s += circ(c, 2, "fx-e fx-fill2");
    var p1 = pedal(k, 1), p2 = pedal(k, 2);
    return { back: s + line(c, p2, "fx-a", 2) + line([p2[0] - 2, p2[1]], [p2[0] + 2, p2[1]], "fx-a", 2),
      front: line(c, p1, "fx-a", 2.2) + line([p1[0] - 2, p1[1]], [p1[0] + 2, p1[1]], "fx-a", 2.2) };
  }

  /* ---------- animations ----------
     v: "s" side / "f" front; P: key poses; loop: "cycle" (walking, cycling) or "yoyo" (up and back);
     d: time for one round (ms); moves: "arms" / "legs" (for "one side" exercises);
     back / front: equipment drawn behind / in front of the figure. */
  var A = {};

  function walkPoses(t, y0, y1) {
    return [
      S({ x: 50, y: y0, t: t, l1: 22, k1: 6, l2: -18, k2: 12, a1: -22, e1: 28, a2: 20, e2: 32 }),
      S({ x: 50, y: y1, t: t, l1: 2, k1: 6, l2: 6, k2: 48, a1: 0, e1: 26, a2: 0, e2: 26 }),
      S({ x: 50, y: y0, t: t, l1: -18, k1: 12, l2: 22, k2: 6, a1: 20, e1: 32, a2: -22, e2: 28 }),
      S({ x: 50, y: y1, t: t, l1: 6, k1: 48, l2: 2, k2: 6, a1: 0, e1: 26, a2: 0, e2: 26 })
    ];
  }
  var BELT = 91.3; // feet stand on the treadmill belt
  A.walk = { loop: "cycle", d: 1150, moves: "legs", fl: BELT, feet: "stick", P: walkPoses(4, 63, 61.4), back: function (J, k) { return treadmill(k); } };
  A.walk_incline = { loop: "cycle", d: 1300, moves: "legs", fl: BELT, feet: "stick", rot: -7, P: walkPoses(9, 63, 61.4), back: function (J, k) { return treadmill(k); } };
  A.run = {
    loop: "cycle", d: 720, moves: "legs", fl: BELT, feet: "above",
    P: [
      S({ x: 50, y: 63.8, t: 12, l1: 32, k1: 22, l2: -28, k2: 70, a1: -38, e1: 95, a2: 38, e2: 85 }),
      S({ x: 50, y: 61.5, t: 12, l1: 2, k1: 30, l2: 18, k2: 105, a1: 0, e1: 90, a2: 0, e2: 90 }),
      S({ x: 50, y: 63.8, t: 12, l1: -28, k1: 70, l2: 32, k2: 22, a1: 38, e1: 85, a2: -38, e2: 95 }),
      S({ x: 50, y: 61.5, t: 12, l1: 18, k1: 105, l2: 2, k2: 30, a1: 0, e1: 90, a2: 0, e2: 90 })
    ],
    back: function (J, k) { return treadmill(k * 1.6); }
  };

  // the ball of the foot is on the pedal, the ankle a little behind and above it
  function bikePose(stand) {
    return function (k) {
      var p1 = pedal(k, 1), p2 = pedal(k, 2);
      var a1 = [p1[0] - 2.5, p1[1] - 2.5], a2 = [p2[0] - 2.5, p2[1] - 2.5];
      var sway = stand ? 1.5 * Math.sin(k * 360 * DEG) : 0;
      return S(stand ? { x: 59.5 + sway, y: 55.5, t: 34, f1: a1, f2: a2, tt1: p1, tt2: p2, h1: [79, 44], h2: [79, 44] }
        : { x: 53, y: 56.5, t: 26, f1: a1, f2: a2, tt1: p1, tt2: p2, h1: [79, 44], h2: [79, 44] });
    };
  }
  function bikeDraw(J, k) { return bikeScene(J, k); }
  A.bike = { loop: "cycle", d: 1200, moves: "legs", pose: bikePose(false), scene: bikeDraw };
  A.bike_stand = { loop: "cycle", d: 1300, moves: "legs", pose: bikePose(true), scene: bikeDraw };
  A.bike_fast = { loop: "cycle", d: 520, moves: "legs", pose: bikePose(false), scene: bikeDraw };

  function rowerBack(J) {
    var s = line([8, 90.5], [104, 90.5], "fx-e", 2.4) + circ([102, 80], 8.5, "fx-e fx-fill2");
    s += line([86, 92], [90, 79], "fx-e", 3);
    s += rect(J.hip[0] - 6, J.hip[1] + 1.5, 12, 3, "fx-e fx-fill2");
    s += line([96, 76], J.ha1, "fx-move", 1);
    return s;
  }
  A.rower = {
    loop: "cycle", d: 2600, moves: "legs",
    P: [
      S({ x: 68, y: 86, t: 20, f1: [87, 88], h1: [90, 74] }),
      S({ x: 60, y: 86, t: 6, f1: [87, 88], h1: [80, 70] }),
      S({ x: 58.5, y: 86, t: -22, f1: [87, 88], h1: [63, 64] }),
      S({ x: 62, y: 86, t: 14, f1: [87, 88], h1: [84, 73] })
    ],
    back: rowerBack, front: function (J) { return handle(J.ha1); }
  };
  A.rower_legs = {
    loop: "yoyo", d: 1900, moves: "legs",
    P: [S({ x: 68, y: 86, t: 18, f1: [87, 88], h1: [90, 72] }), S({ x: 58.5, y: 86, t: 12, f1: [87, 88], h1: [80, 69] })],
    back: rowerBack, front: function (J) { return handle(J.ha1); }
  };

  // barbell / plate helpers
  function barOnBack(J) { return [J.sh[0] - 1, J.sh[1] - 2]; }
  A.squat_bar = {
    loop: "yoyo", d: 2600, moves: "legs",
    P: [S({ x: 52, y: 64.5, t: 6, f1: [56, GROUND], hr1: [-3.5, -1.5], as1: 0.55, hb1: -1 }), S({ x: 40, y: 79, t: 42, f1: [56, GROUND], hr1: [-3.5, -1.5], as1: 0.55, hb1: -1 })],
    back: function (J) { return ground() + plate(barOnBack(J), 7); }
  };
  A.smith_squat = {
    loop: "yoyo", d: 2600, moves: "legs",
    P: A.squat_bar.P,
    back: function (J) { return ground() + line([57, 6], [57, GROUND], "fx-e", 2) + plate(barOnBack(J), 7); }
  };
  A.squat_hold = {
    loop: "yoyo", d: 2400, moves: "legs",
    P: [S({ x: 52, y: 64.5, t: 4, f1: [56, GROUND], hr1: [8, 9] }), S({ x: 42, y: 79, t: 24, f1: [56, GROUND], hr1: [8, 9] })],
    back: function () { return ground(); }, front: function (J) { return plate(J.ha1, 6.5); }
  };
  A.squat_hang = {
    loop: "yoyo", d: 2500, moves: "legs",
    P: [S({ x: 52, y: 50.5, t: 4, f1: [56, 80], a1: 70, e1: 10, a2: 70, e2: 10 }), S({ x: 44, y: 64, t: 24, f1: [56, 80], a1: 85, e1: 10, a2: 85, e2: 10 })],
    back: function () { return ground() + rect(42, 80, 30, GROUND - 80, "fx-e fx-fill2", 2); },
    front: function (J) { var c = [J.hip[0] + 4, J.hip[1] + 20]; return line([J.hip[0] + 2, J.hip[1] + 2], c, "fx-a", 1.2) + plate(c, 5.5); }
  };
  A.deadlift = {
    loop: "yoyo", d: 2800, moves: "legs",
    P: [S({ x: 40, y: 76, t: 44, f1: [55, GROUND], a1: 0, e1: 0, a2: 0, e2: 0 }), S({ x: 51, y: 64.3, t: -2, f1: [55, GROUND], a1: 5, e1: 0, a2: 5, e2: 0 })],
    back: function () { return ground(); }, front: function (J) { return plate(J.ha1, 9); }
  };
  A.ohp = {
    loop: "yoyo", d: 2400, moves: "arms",
    P: [S({ h1: [57, 38] }), S({ h1: [54, 13] })],
    back: function (J) { return ground() + plate(J.ha1, 6); }
  };
  A.press_db = {
    loop: "yoyo", d: 2400, moves: "arms",
    P: [S({ h1: [56, 36] }), S({ h1: [53, 13] })],
    back: function () { return ground(); }, front: function (J) { return dumbbell(J.ha1); }
  };
  A.front_raise = {
    loop: "yoyo", d: 2400, moves: "arms",
    P: [S({ a1: 8, a2: 8 }), S({ a1: 92, a2: 92 })],
    back: function () { return ground(); }, front: function (J) { return plate(J.ha1, 6.5); }
  };
  A.curl_db = {
    loop: "yoyo", d: 2100, moves: "arms",
    P: [S({ a1: 4, e1: 6, a2: 4, e2: 6 }), S({ a1: 12, e1: 140, a2: 12, e2: 140 })],
    back: function () { return ground(); }, front: function (J) { return dumbbell(J.ha1); }
  };
  A.curl_band = {
    loop: "yoyo", d: 2100, moves: "arms",
    P: A.curl_db.P,
    back: function (J) { return ground() + line([J.an1[0] + 2, GROUND], J.ha1, "fx-a", 1.1); },
    front: function (J) { return handle(J.ha1); }
  };
  A.lunge = {
    loop: "yoyo", d: 2500, moves: "legs",
    P: [S({ x: 51, y: 67, t: 2, f1: [64, GROUND], f2: [34, 90.5] }), S({ x: 51, y: 78, t: 2, f1: [64, GROUND], f2: [34, 90.5] })],
    back: function () { return ground(); }, front: function (J) { return dumbbell(J.ha1); }
  };
  function bench(y) { return ground() + rect(16, y, 62, 4, "fx-e fx-fill2", 2) + line([22, y + 4], [22, GROUND], "fx-e", 2.4) + line([72, y + 4], [72, GROUND], "fx-e", 2.4); }
  A.bench_press = {
    loop: "yoyo", d: 2400, moves: "arms",
    P: [S({ x: 58, y: 71, t: -90, f1: [70, GROUND], hr1: [3, -8], as1: 0.62 }), S({ x: 58, y: 71, t: -90, f1: [70, GROUND], hr1: [1, -24.95], as1: 1 })],
    back: function () { return bench(74); }, front: function (J) { return dumbbell(J.ha1); }
  };
  A.smith_bench = {
    loop: "yoyo", d: 2400, moves: "arms",
    P: A.bench_press.P,
    back: function () { return bench(74) + line([34, 6], [34, 72], "fx-e", 2); }, front: function (J) { return plate(J.ha1, 7); }
  };
  A.bench_row = {
    loop: "yoyo", d: 2300, moves: "arms",
    P: [S({ x: 36, y: 64, t: 70, f1: [43.5, 93.5], l2: 0, k2: 90, a1: 10, e1: 0, h2: [61, 77] }),
      S({ x: 36, y: 64, t: 70, f1: [43.5, 93.5], l2: 0, k2: 90, a1: -115, e1: 115, h2: [61, 77] })],
    back: function () { return ground() + rect(12, 78, 50, 4, "fx-e fx-fill2", 2) + line([18, 82], [18, GROUND], "fx-e", 2.4) + line([56, 82], [56, GROUND], "fx-e", 2.4); },
    front: function (J) { return dumbbell(J.ha1); }
  };
  A.step_up = {
    loop: "yoyo", d: 2800, moves: "legs",
    P: [S({ x: 50, y: 67, t: 10, f1: [66, 78], f2: [44, GROUND], a1: -10, e1: 20, a2: 10, e2: 20 }),
      S({ x: 56, y: 58, t: 8, f1: [66, 78], f2: [55, 87], a1: 10, e1: 20, a2: -10, e2: 20 }),
      S({ x: 61, y: 49, t: 2, f1: [66, 78], f2: [72, 78], a1: 0, e1: 15, a2: 0, e2: 15 })],
    back: function () { return ground() + rect(58, 78, 30, GROUND - 78, "fx-e fx-fill2", 2); }
  };
  A.plank = {
    loop: "yoyo", d: 2600, moves: "legs",
    P: [S({ x: 52, y: 85.5, t: 79, n: 8, l1: -77, l2: -77, h1: [91, 92] }), S({ x: 52, y: 84, t: 80, n: 8, l1: -78, l2: -78, h1: [91, 92] })],
    back: function () { return mat(); }
  };
  A.glute_bridge = {
    loop: "yoyo", d: 2400, moves: "legs",
    P: [S({ x: 56, y: 90, t: -90, n: 0, f1: [74, 93], a1: 90, a2: 90 }), S({ x: 55, y: 77, t: -117, n: 27, f1: [74, 93], a1: 90, a2: 90 })],
    back: function () { return mat(); }
  };
  A.crunch = {
    loop: "yoyo", d: 2100, moves: "arms",
    P: [S({ x: 56, y: 90, t: -90, n: 0, f1: [74, 93], hr1: [-8, -4] }), S({ x: 56, y: 90, t: -62, n: -10, f1: [74, 93], hr1: [-7, -6] })],
    back: function () { return mat(); }
  };
  A.ball_crunch = {
    loop: "yoyo", d: 2300, moves: "arms",
    P: [S({ x: 50, y: 75, t: -92, n: 0, f1: [66, GROUND], hr1: [-8, -3] }), S({ x: 50, y: 75, t: -60, n: -10, f1: [66, GROUND], hr1: [-7, -6] })],
    back: function () { return ground() + circ([37, 84], 10, "fx-e fx-fill2"); }
  };
  A.ball_wall_squat = {
    loop: "yoyo", d: 2600, moves: "legs",
    P: [S({ x: 39, y: 66, t: 0, f1: [50, GROUND], a1: 85, a2: 85 }), S({ x: 39, y: 82, t: 0, f1: [50, GROUND], a1: 88, a2: 88 })],
    back: function (J) { return ground() + line([24, 12], [24, GROUND], "fx-e", 2.6) + circ([31, J.hip[1] - 12], 7, "fx-e fx-fill2"); }
  };
  A.ball_bridge = {
    loop: "yoyo", d: 2500, moves: "legs",
    P: [S({ x: 46, y: 85, t: -52, n: 6, f1: [64, GROUND], hr1: [12, 3] }), S({ x: 50, y: 76.5, t: -68, n: 4, f1: [64, GROUND], hr1: [12, 3] })],
    back: function () { return ground() + circ([28, 82], 12, "fx-e fx-fill2"); }
  };
  A.band_row = {
    loop: "yoyo", d: 2200, moves: "arms",
    P: [S({ x: 46, y: 64.5, t: -2, f1: [50, GROUND], h1: [68, 47] }), S({ x: 46, y: 64.5, t: -2, f1: [50, GROUND], h1: [50, 52] })],
    back: function () { return ground() + line([104, 30], [104, GROUND], "fx-e", 2.6); },
    front: function (J) { return line([104, 46], J.ha1, "fx-a", 1.2) + handle(J.ha1); }
  };
  A.band_press = {
    loop: "yoyo", d: 2200, moves: "arms",
    P: [S({ x: 54, h1: [58, 45] }), S({ x: 54, h1: [78, 40] })],
    back: function () { return ground() + line([8, 30], [8, GROUND], "fx-e", 2.6); },
    front: function (J) { return line([8, 46], J.ha1, "fx-a", 1.2) + handle(J.ha1); }
  };
  function dipsBack() { return ground() + line([38, 50], [38, GROUND], "fx-e", 2.6) + line([38, 50], [60, 50], "fx-e", 3.4); }
  A.dips = {
    loop: "yoyo", d: 2300, moves: "arms",
    P: [S({ x: 48, y: 53, t: 6, h1: [50, 50], l1: 8, k1: 85, l2: 8, k2: 85 }), S({ x: 46, y: 66, t: 14, h1: [50, 50], l1: 8, k1: 85, l2: 8, k2: 85 })],
    back: dipsBack
  };
  A.dips_w = {
    loop: "yoyo", d: 2300, moves: "arms", P: A.dips.P, back: dipsBack,
    front: function (J) { var c = [J.hip[0] + 4, J.hip[1] + 15]; return line([J.hip[0] + 2, J.hip[1] + 2], c, "fx-a", 1.2) + plate(c, 5); }
  };
  function barBack() { return ground() + line([36, 10], [74, 10], "fx-e", 3) + line([74, 10], [74, GROUND], "fx-e", 2.6); }
  A.pullup = {
    loop: "yoyo", d: 2400, moves: "arms",
    P: [S({ x: 52, y: 62, t: 0, h1: [52, 11], l1: 8, k1: 20, l2: 8, k2: 20 }), S({ x: 52, y: 48, t: -6, h1: [52, 11], l1: 12, k1: 30, l2: 12, k2: 30 })],
    back: barBack
  };
  A.pullup_w = {
    loop: "yoyo", d: 2400, moves: "arms", P: A.pullup.P, back: barBack,
    front: function (J) { var c = [J.hip[0] + 4, J.hip[1] + 16]; return line([J.hip[0] + 2, J.hip[1] + 2], c, "fx-a", 1.2) + plate(c, 5); }
  };
  A.pullup_assisted = {
    loop: "yoyo", d: 2400, moves: "arms",
    P: [S({ x: 52, y: 62, t: 0, h1: [52, 11], l1: 0, k1: 90, l2: 0, k2: 90 }), S({ x: 52, y: 48, t: -6, h1: [52, 11], l1: 0, k1: 90, l2: 0, k2: 90 })],
    back: function (J) { return barBack() + rect(30, J.kn1[1] + 1.6, 30, 3.6, "fx-a fx-fill", 1.5) + line([60, J.kn1[1] + 3.4], [74, 80], "fx-e", 1.6); }
  };
  A.cable_kickback = {
    loop: "yoyo", d: 2300, moves: "legs",
    P: [S({ x: 66, y: 64, t: 24, f1: [67, GROUND], f2: [69, GROUND], h1: [98, 52] }), S({ x: 66, y: 64, t: 26, f1: [44, 80], f2: [69, GROUND], h1: [98, 52] })],
    back: function () { return ground() + rect(100, 8, 12, GROUND - 8, "fx-e fx-fill2", 2) + circ([100, 88], 2.4, "fx-e"); },
    front: function (J) { return line([100, 88], J.an1, "fx-a", 1.1) + circ(J.an1, 1.8, "fx-a fx-fill"); }
  };
  A.leg_raise_front = {
    loop: "yoyo", d: 2300, moves: "legs",
    P: [S({ x: 30, y: 64.5, l1: 4, f2: [32, GROUND], h1: [17.5, 58] }), S({ x: 30, y: 64.5, l1: 55, f2: [32, GROUND], h1: [17.5, 58] })],
    back: function () { return ground() + rect(4, 8, 12, GROUND - 8, "fx-e fx-fill2", 2) + circ([16, 88], 2.4, "fx-e"); },
    front: function (J) { return line([16, 88], J.an1, "fx-a", 1.1) + circ(J.an1, 1.8, "fx-a fx-fill"); }
  };

  /* seated machines (side view) */
  function seated(o) { var b = { x: 37, y: 72, t: 0, f1: [57, GROUND] }; for (var k in o) b[k] = o[k]; return S(b); }
  function lever(J, pivot) { return line(pivot, J.ha1, "fx-e", 2) + handle(J.ha1); }
  A.seated_press = {
    loop: "yoyo", d: 2300, moves: "arms",
    P: [seated({ h1: [47, 46] }), seated({ h1: [61, 46] })],
    back: function () { return seatSide(); }, front: function (J) { return lever(J, [58, 12]); }
  };
  A.seated_press_incline = {
    loop: "yoyo", d: 2300, moves: "arms",
    P: [seated({ t: -20, h1: [37, 40] }), seated({ t: -20, h1: [41.5, 27.5] })],
    back: function () { return ground(10, 90) + rect(24, 74, 26, 4.5, "fx-e fx-fill2") + line([37, 78.5], [37, GROUND], "fx-e", 2.4) + poly([[33, 74], [24, 48]], "fx-e", 5); },
    front: function (J) { return lever(J, [62, 20]); }
  };
  A.seated_press_decline = {
    loop: "yoyo", d: 2300, moves: "arms",
    P: [seated({ h1: [46, 50] }), seated({ h1: [58, 56] })],
    back: function () { return seatSide(); }, front: function (J) { return lever(J, [56, 14]); }
  };
  A.seated_press_up = {
    loop: "yoyo", d: 2300, moves: "arms",
    P: [seated({ h1: [41, 44] }), seated({ h1: [39, 22] })],
    back: function () { return seatSide(); }, front: function (J) { return lever(J, [62, 30]); }
  };
  A.pulldown = {
    loop: "yoyo", d: 2400, moves: "arms",
    P: [seated({ t: -8, h1: [36, 22] }), seated({ t: -8, h1: [41, 41] })],
    back: function () { return seatSide({ noBack: true }) + rect(44, 63, 10, 3.4, "fx-e fx-fill2") + line([40, 2], [40, 8], "fx-e", 2); },
    front: function (J) { return line([40, 6], J.ha1, "fx-move", 1) + line([J.ha1[0] - 7, J.ha1[1]], [J.ha1[0] + 7, J.ha1[1]], "fx-a", 3); }
  };
  A.seated_row = {
    loop: "yoyo", d: 2400, moves: "arms",
    P: [seated({ t: -4, f1: [57, 86], h1: [60, 50] }), seated({ t: -4, f1: [57, 86], h1: [43, 54] })],
    back: function () { return seatSide({ noBack: true }) + rect(56, 80, 4, 12, "fx-e fx-fill2") + line([84, 30], [84, GROUND], "fx-e", 2.6); },
    front: function (J) { return line([84, 50], J.ha1, "fx-move", 1) + handle(J.ha1); }
  };
  A.seated_dip = {
    loop: "yoyo", d: 2300, moves: "arms",
    P: [seated({ h1: [43, 60] }), seated({ h1: [38, 70] })],
    back: function () { return seatSide(); },
    front: function (J) { return line([J.ha1[0] - 4, J.ha1[1]], [J.ha1[0] + 5, J.ha1[1]], "fx-a", 3); }
  };
  A.preacher_curl = {
    loop: "yoyo", d: 2200, moves: "arms",
    P: [seated({ t: 6, a1: 56, e1: 10, a2: 56, e2: 10 }), seated({ t: 6, a1: 56, e1: 128, a2: 56, e2: 128 })],
    back: function () { return seatSide({ noBack: true }) + line([43, 50], [60, 62], "fx-e", 4) + line([58, 62], [58, GROUND], "fx-e", 2.4); },
    front: function (J) { return handle(J.ha1); }
  };
  A.triceps_ext = {
    loop: "yoyo", d: 2200, moves: "arms",
    P: [seated({ a1: 62, e1: 110, a2: 62, e2: 110 }), seated({ a1: 62, e1: 8, a2: 62, e2: 8 })],
    back: function () { return seatSide({ noBack: true }) + line([42, 54], [56, 54], "fx-e", 4); },
    front: function (J) { return handle(J.ha1); }
  };
  A.leg_extension = {
    loop: "yoyo", d: 2300, moves: "legs",
    P: [seated({ y: 70, f1: undefined, l1: 88, k1: 88, l2: 88, k2: 88, h1: [41, 68] }), seated({ y: 70, f1: undefined, l1: 88, k1: 8, l2: 88, k2: 8, h1: [41, 68] })],
    back: function () { return seatSide({ backTop: 38 }); },
    front: function (J) { return circ([J.an1[0] + 2.4, J.an1[1] - 0.5], 2.6, "fx-a fx-fill"); }
  };
  A.seated_leg_curl = {
    loop: "yoyo", d: 2300, moves: "legs",
    P: [seated({ y: 70, f1: undefined, l1: 88, k1: 8, l2: 88, k2: 8, h1: [41, 68] }), seated({ y: 70, f1: undefined, l1: 88, k1: 96, l2: 88, k2: 96, h1: [41, 68] })],
    back: function () { return seatSide({ backTop: 38 }); },
    front: function (J) { return rect(J.kn1[0] - 5, J.kn1[1] - 6, 10, 3, "fx-e fx-fill2") + circ([J.an1[0] - 1, J.an1[1] + 2.4], 2.6, "fx-a fx-fill"); }
  };
  A.prone_curl = {
    loop: "yoyo", d: 2300, moves: "legs",
    P: [S({ x: 50, y: 66, t: 95, n: -5, l1: -90, k1: 0, l2: -90, k2: 0, h1: [80, 80] }), S({ x: 50, y: 66, t: 95, n: -5, l1: -90, k1: 110, l2: -90, k2: 110, h1: [80, 80] })],
    back: function () { return ground() + rect(20, 70, 66, 4, "fx-e fx-fill2", 2) + line([26, 74], [26, GROUND], "fx-e", 2.4) + line([80, 74], [80, GROUND], "fx-e", 2.4); },
    front: function (J) { return circ([J.an1[0] + 1, J.an1[1] - 2.4], 2.6, "fx-a fx-fill"); }
  };
  function sledPlate(J) { var f = J.an1, d = [0.707, 0.707]; return line([f[0] - 8 * d[0], f[1] - 8 * d[1]], [f[0] + 8 * d[0], f[1] + 8 * d[1]], "fx-a", 3.2); }
  A.leg_press = {
    loop: "yoyo", d: 2600, moves: "legs",
    P: [S({ x: 38, y: 78, t: -50, n: 12, f1: [51, 66], tt1: [47.5, 62.5], h1: [33, 80] }), S({ x: 38, y: 78, t: -50, n: 12, f1: [60, 58], tt1: [56.5, 54.5], h1: [33, 80] })],
    back: function () { return ground() + line([46, 88], [100, 34], "fx-e", 2.6) + poly([[40, 84], [12, 60]], "fx-e", 5) + rect(30, 82, 16, 4, "fx-e fx-fill2"); },
    front: sledPlate
  };
  A.hack_squat = {
    loop: "yoyo", d: 2600, moves: "legs",
    P: [S({ x: 46, y: 63, t: -14, f1: [58, 91], hr1: [3, -2] }), S({ x: 36, y: 79, t: -14, f1: [58, 91], hr1: [3, -2] })],
    back: function () { return ground() + line([22, GROUND], [44, 18], "fx-e", 2.6) + line([50, 92], [70, 88], "fx-e", 3); },
    front: function (J) { return circ([J.sh[0] + 2, J.sh[1] - 2.6], 2.6, "fx-a fx-fill"); }
  };
  A.squat_machine = A.hack_squat;
  A.seated_calf = {
    loop: "yoyo", d: 1900, moves: "legs",
    P: [seated({ y: 74, f1: undefined, l1: 90, k1: 90, l2: 90, k2: 90, fa1: 0, fa2: 0, h1: [50, 66] }), seated({ y: 74, f1: undefined, l1: 80, k1: 80, l2: 80, k2: 80, fa1: -30, fa2: -30, h1: [50, 66] })],
    back: function () { return seatSide({ noBack: true }) + rect(53, 89, 12, GROUND - 89, "fx-e fx-fill2", 1); },
    front: function (J) { return rect(J.kn1[0] - 6, J.kn1[1] - 5.5, 12, 3.2, "fx-a fx-fill", 1.4); }
  };
  A.glute_machine = {
    loop: "yoyo", d: 2300, moves: "legs",
    P: [S({ x: 50, y: 64, t: 48, f1: [54, 82], f2: [51, GROUND], h1: [76, 58] }), S({ x: 50, y: 64, t: 48, f1: [27, 66], f2: [51, GROUND], h1: [76, 58] })],
    back: function () { return ground() + rect(64, 38, 8, 18, "fx-e fx-fill2", 2) + line([72, 46], [84, GROUND], "fx-e", 2.6); },
    front: function (J) { return line([J.to1[0], J.to1[1] - 5], [J.to1[0] + 1, J.to1[1] + 5], "fx-a", 3); }
  };
  A.ab_machine = {
    loop: "yoyo", d: 2300, moves: "arms",
    P: [seated({ t: -4, hr1: [3, 4] }), seated({ t: 34, n: 10, hr1: [3, 4] })],
    back: function () { return seatSide(); }, front: function (J) { return circ([J.sh[0] + 3.5, J.sh[1] + 2], 2.6, "fx-a fx-fill"); }
  };
  A.back_extension = {
    loop: "yoyo", d: 2400, moves: "arms",
    P: [seated({ t: 40, hr1: [5, 5] }), seated({ t: -12, hr1: [5, 5] })],
    back: function () { return seatSide({ noBack: true }); },
    front: function (J) { return circ([J.sh[0] - 3.5, J.sh[1] + 1], 2.8, "fx-a fx-fill"); }
  };

  /* front view */
  function F(o) {
    var p = { x: 60, y: 64 }, k;
    for (k in o) p[k] = o[k];
    return p;
  }
  var SEAT_DY = 9; // the seated front figure sits this much lower than a standing one
  function seatFront() { return ground(20, 100) + rect(44, 75, 32, 5, "fx-e fx-fill2") + line([60, 80], [60, GROUND], "fx-e", 2.4); }
  var SEATED_LEGS = { kL: [52, 77], fL: [51, GROUND], kR: [68, 77], fR: [69, GROUND] };
  function FS(o) {
    var b = F(SEATED_LEGS), k;
    b.y = 64 + SEAT_DY;
    for (k in o) b[k] = (/^[ew][LR]$/.test(k) && o[k]) ? [o[k][0], o[k][1] + SEAT_DY] : o[k];
    return b;
  }
  A.pec_fly = {
    v: "f", loop: "yoyo", d: 2300, moves: "arms",
    P: [FS({ eL: [41, 39], wL: [41, 26], eR: [79, 39], wR: [79, 26] }), FS({ eL: [54, 42], wL: [55, 29], eR: [66, 42], wR: [65, 29] })],
    back: function () { return seatFront() + line([30, 10], [30, GROUND], "fx-e", 2.4) + line([90, 10], [90, GROUND], "fx-e", 2.4); },
    front: function (J) { return line(J.eL, J.wL, "fx-a", 3) + line(J.eR, J.wR, "fx-a", 3); }
  };
  A.rear_fly = {
    v: "f", loop: "yoyo", d: 2300, moves: "arms",
    P: [FS({ eL: [55, 46], wL: [58, 50], eR: [65, 46], wR: [62, 50] }), FS({ eL: [42, 40], wL: [30, 42], eR: [78, 40], wR: [90, 42] })],
    back: function () { return seatFront(); },
    front: function (J) { return handle(J.wL) + handle(J.wR); }
  };
  A.cable_fly = {
    v: "f", loop: "yoyo", d: 2300, moves: "arms",
    P: [F({ eL: [43, 36], wL: [31, 30], eR: [77, 36], wR: [89, 30], fL: [53, GROUND], fR: [67, GROUND] }), F({ eL: [52, 48], wL: [58, 58], eR: [68, 48], wR: [62, 58], fL: [53, GROUND], fR: [67, GROUND] })],
    back: function () { return ground(10, 110) + rect(6, 10, 10, GROUND - 10, "fx-e fx-fill2", 2) + rect(104, 10, 10, GROUND - 10, "fx-e fx-fill2", 2); },
    front: function (J) { return line([16, 16], J.wL, "fx-a", 1.1) + line([104, 16], J.wR, "fx-a", 1.1) + handle(J.wL) + handle(J.wR); }
  };
  A.lateral_raise = {
    v: "f", loop: "yoyo", d: 2200, moves: "arms",
    P: [FS({ eL: [51, 51], wL: [52, 56], eR: [69, 51], wR: [68, 56] }), FS({ eL: [40, 39], wL: [40, 44], eR: [80, 39], wR: [80, 44] })],
    back: function () { return seatFront(); },
    front: function (J) { return circ(J.eL, 2.6, "fx-a fx-fill") + circ(J.eR, 2.6, "fx-a fx-fill"); }
  };
  function hipArms() { return { eL: [48, 52], wL: [46, 62], eR: [72, 52], wR: [74, 62] }; }
  A.hip_adduction = {
    v: "f", loop: "yoyo", d: 2300, moves: "legs",
    P: [FS(Object.assign(hipArms(), { kL: [43, 77], fL: [44, GROUND - 2], kR: [77, 77], fR: [76, GROUND - 2] })),
      FS(Object.assign(hipArms(), { kL: [56, 77], fL: [56, GROUND - 2], kR: [64, 77], fR: [64, GROUND - 2] }))],
    back: function () { return seatFront(); },
    front: function (J) { return rect(J.kL[0] + 1, J.kL[1] - 4, 3, 8, "fx-a fx-fill", 1) + rect(J.kR[0] - 4, J.kR[1] - 4, 3, 8, "fx-a fx-fill", 1); }
  };
  A.hip_abduction = {
    v: "f", loop: "yoyo", d: 2300, moves: "legs",
    P: [A.hip_adduction.P[1], A.hip_adduction.P[0]],
    back: function () { return seatFront(); },
    front: function (J) { return rect(J.kL[0] - 4, J.kL[1] - 4, 3, 8, "fx-a fx-fill", 1) + rect(J.kR[0] + 1, J.kR[1] - 4, 3, 8, "fx-a fx-fill", 1); }
  };
  A.abduction_standing = {
    v: "f", loop: "yoyo", d: 2300, moves: "legs",
    P: [F({ kL: [55, 79], fL: [55, GROUND], kR: [65, 79], fR: [65, GROUND], eR: [82, 46], wR: [98, 50], eL: [50, 52], wL: [55, 63] }),
      F({ kL: [48, 77], fL: [41, 90], kR: [65, 79], fR: [65, GROUND], eR: [82, 46], wR: [98, 50], eL: [50, 52], wL: [55, 63] })],
    back: function () { return ground(10, 112) + rect(100, 10, 12, GROUND - 10, "fx-e fx-fill2", 2) + circ([100, 90], 2.2, "fx-e"); },
    front: function (J) { return line([100, 90], J.fL, "fx-a", 1.1) + circ(J.fL, 1.8, "fx-a fx-fill"); }
  };

  /* ---------- timing ---------- */
  function ease(u) { return u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2; }
  // where are we on the path (0 = first pose, 1 = last pose)?
  function pathPos(an, k, vr) {
    if (an.loop === "cycle") return k;
    var up = 0.45, hold = 0.1;
    if (vr === "slow") { up = 0.26; hold = 0.04; }
    if (vr === "pause") { up = 0.33; hold = 0.34; }
    if (k < up) return ease(k / up);
    if (k < up + hold) return 1;
    return 1 - ease((k - up - hold) / (1 - up - hold));
  }
  function poseAt(an, u) {
    var P = an.P, n = P.length;
    if (an.loop === "cycle") {
      var x = u * n, i = Math.floor(x) % n, f = x - Math.floor(x);
      return mix(P[i], P[(i + 1) % n], ease(f));
    }
    if (n === 1) return P[0];
    var y = u * (n - 1), j = Math.min(n - 2, Math.floor(y));
    return mix(P[j], P[j + 1], y - j);
  }

  // one picture of an animation at time ms; vr = "" / "one" / "slow" / "pause"
  function frame(id, vr, ms) {
    var an = A[id];
    if (!an) return "";
    var dur = an.d * (vr === "slow" ? 1.6 : vr === "pause" ? 1.3 : 1);
    var k = ((ms % dur) + dur) % dur / dur;
    var u = pathPos(an, k, vr);
    var pose = an.pose ? an.pose(an.loop === "cycle" ? k : u) : poseAt(an, u);
    if (vr === "one" && !an.pose) {
      // one side at a time: the far arm (or leg) stays still
      var p0 = an.P[0], keys = an.moves === "legs" ? ["l2", "k2", "f2", "fa2", "kL", "fL"] : ["a2", "e2", "h2", "hr2", "eL", "wL"];
      keys.forEach(function (key) { if (p0[key] !== undefined) pose[key] = p0[key]; });
      if (an.moves !== "legs" && !p0.h2 && p0.h1 && an.v !== "f") pose.h2 = p0.h1;
      if (an.moves === "legs" && !p0.f2 && p0.f1 && an.v !== "f") pose.f2 = p0.f1;
    }
    var floor = an.fl === undefined ? GROUND : an.fl;
    var J = an.v === "f" ? jointsFront(pose) : joints(pose, floor);
    if (an.feet && an.v !== "f") {
      // walking: the lower foot is always on the belt; running: a foot never goes into the belt
      var low = Math.max(J.an1[1], J.an2[1] + 0.6);
      if (an.feet === "stick" || low > floor) { pose.y += floor - low; J = joints(pose, floor); }
    }
    var scene = an.scene ? an.scene(J, k) : null;
    var s = scene ? scene.back : (an.back ? an.back(J, k) : "");
    s += an.v === "f" ? bodyFront(J) : body(J, an);
    s += scene ? scene.front : (an.front ? an.front(J, k) : "");
    if (an.rot) s = '<g transform="rotate(' + an.rot + ' 56 94)">' + s + "</g>";
    return s;
  }

  function svg(id, vr, ms, label) {
    return '<svg class="fx" viewBox="0 0 120 100" role="img"' + (label ? ' aria-label="' + label.replace(/"/g, "") + '"' : ' aria-hidden="true"') +
      ' focusable="false">' + frame(id, vr, ms || 0) + "</svg>";
  }

  /* ---------- play: every visible drawing moves (about 30 pictures a second) ---------- */
  var live = [];
  var raf = 0, last = 0;
  var still = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  function tick(now) {
    raf = 0;
    if (now - last >= 33) {
      last = now;
      live = live.filter(function (it) { return document.contains(it.node); });
      live.forEach(function (it) {
        if (!it.on) return;
        it.node.innerHTML = frame(it.id, it.vr, now - it.t0);
      });
    }
    if (live.some(function (it) { return it.on; })) raf = window.requestAnimationFrame(tick);
  }
  var io = window.IntersectionObserver ? new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      live.forEach(function (it) { if (it.node === e.target) it.on = e.isIntersecting; });
    });
    if (!raf && !still) raf = window.requestAnimationFrame(tick);
  }) : null;

  // node = an <svg class="fx">; shows the animation and keeps it moving while visible
  function play(node, id, vr) {
    live = live.filter(function (it) { if (it.node === node) { if (io) io.unobserve(node); return false; } return true; });
    var it = { node: node, id: id, vr: vr || "", t0: performance.now(), on: !io };
    // reduced motion: one clear picture (the hardest point of the move)
    node.innerHTML = frame(id, vr, still ? (A[id] && A[id].loop === "cycle" ? 0 : A[id].d * 0.45) : 0);
    if (still) return;
    live.push(it);
    if (io) io.observe(node);
    else if (!raf) raf = window.requestAnimationFrame(tick);
  }
  function stopAll(container) {
    live = live.filter(function (it) {
      if (container && !container.contains(it.node)) return true;
      if (io) io.unobserve(it.node);
      return false;
    });
  }

  window.MF_FIG = { svg: svg, frame: frame, play: play, stop: stopAll, has: function (id) { return !!A[id]; },
    list: function () { return Object.keys(A); }, dur: function (id) { return A[id] ? A[id].d : 0; } };
})();
