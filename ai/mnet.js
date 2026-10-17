/* Marshal Fitness — tiny picture model (MobileNetV2, int8) for photo search.
   Turns a 224×224 picture into 1280 numbers that describe what is in it.
   Runs fully on the visitor's phone; the photo is never sent anywhere.
   Works in a Web Worker and in Node (for testing). */
(function (root) {
  "use strict";

  function createNet(meta, buffer) {
    var layers = meta.layers.map(function (l) {
      if (l.op !== "conv") return l;
      var cout = l.cout, per = l.cin * l.k * l.k;
      var q = new Int8Array(buffer, l.w, cout * per);
      var s = new Float32Array(buffer, l.s, cout);
      var w = new Float32Array(cout * per);
      for (var o = 0; o < cout; o++) {
        var sc = s[o], base = o * per;
        for (var i = 0; i < per; i++) w[base + i] = q[base + i] * sc;
      }
      var b = new Float32Array(buffer.slice(l.b, l.b + cout * 4));
      return { op: "conv", inp: l.in, out: l.out, cout: cout, cin: l.cin, k: l.k, stride: l.stride,
               pad: l.pad, group: l.group, relu: l.relu, w: w, b: b };
    });

    // pointwise 1×1 convolution: out[co] = b + Σ w[co][ci] · in[ci]
    function conv1x1(x, C, H, W, L) {
      var HW = H * W, CO = L.cout, out = new Float32Array(CO * HW), w = L.w, b = L.b;
      var co = 0;
      // 4 output channels at a time: each input value is read once for 4 sums
      for (; co + 3 < CO; co += 4) {
        var o0 = co * HW, o1 = o0 + HW, o2 = o1 + HW, o3 = o2 + HW;
        var b0 = b[co], b1 = b[co + 1], b2 = b[co + 2], b3 = b[co + 3];
        for (var j = 0; j < HW; j++) { out[o0 + j] = b0; out[o1 + j] = b1; out[o2 + j] = b2; out[o3 + j] = b3; }
        var wa = co * C, wbb = wa + C, wc = wbb + C, wd = wc + C;
        for (var ci = 0; ci < C; ci++) {
          var v0 = w[wa + ci], v1 = w[wbb + ci], v2 = w[wc + ci], v3 = w[wd + ci];
          var ib = ci * HW;
          for (var k = 0; k < HW; k++) {
            var xv = x[ib + k];
            out[o0 + k] += v0 * xv;
            out[o1 + k] += v1 * xv;
            out[o2 + k] += v2 * xv;
            out[o3 + k] += v3 * xv;
          }
        }
      }
      for (; co < CO; co++) {
        var ob = co * HW, bias = b[co];
        for (var j1 = 0; j1 < HW; j1++) out[ob + j1] = bias;
        var wb = co * C;
        for (var c2 = 0; c2 < C; c2++) {
          var wv = w[wb + c2], ib2 = c2 * HW;
          for (var j2 = 0; j2 < HW; j2++) out[ob + j2] += wv * x[ib2 + j2];
        }
      }
      if (L.relu) for (var j3 = 0; j3 < out.length; j3++) if (out[j3] < 0) out[j3] = 0;
      return { d: out, C: CO, H: H, W: W };
    }

    // depthwise 3×3 (one filter per channel), stride 1 or 2, padding 1
    function convDw(x, C, H, W, L) {
      var s = L.stride, p = L.pad, k = L.k;
      var Ho = Math.floor((H + 2 * p - k) / s) + 1, Wo = Math.floor((W + 2 * p - k) / s) + 1;
      var out = new Float32Array(C * Ho * Wo), w = L.w, b = L.b;
      for (var c = 0; c < C; c++) {
        var ib = c * H * W, ob = c * Ho * Wo, wb = c * 9, bias = b[c];
        var w0 = w[wb], w1 = w[wb + 1], w2 = w[wb + 2], w3 = w[wb + 3], w4 = w[wb + 4],
            w5 = w[wb + 5], w6 = w[wb + 6], w7 = w[wb + 7], w8 = w[wb + 8];
        for (var oy = 0; oy < Ho; oy++) {
          var iy = oy * s - p;
          for (var ox = 0; ox < Wo; ox++) {
            var ix = ox * s - p, sum = bias;
            var r0 = iy >= 0 && iy < H, r1 = iy + 1 >= 0 && iy + 1 < H, r2 = iy + 2 >= 0 && iy + 2 < H;
            var c0 = ix >= 0 && ix < W, c1 = ix + 1 >= 0 && ix + 1 < W, c2 = ix + 2 >= 0 && ix + 2 < W;
            var a = ib + iy * W + ix;
            if (r0) {
              if (c0) sum += w0 * x[a];
              if (c1) sum += w1 * x[a + 1];
              if (c2) sum += w2 * x[a + 2];
            }
            a += W;
            if (r1) {
              if (c0) sum += w3 * x[a];
              if (c1) sum += w4 * x[a + 1];
              if (c2) sum += w5 * x[a + 2];
            }
            a += W;
            if (r2) {
              if (c0) sum += w6 * x[a];
              if (c1) sum += w7 * x[a + 1];
              if (c2) sum += w8 * x[a + 2];
            }
            out[ob + oy * Wo + ox] = L.relu && sum < 0 ? 0 : sum;
          }
        }
      }
      return { d: out, C: C, H: Ho, W: Wo };
    }

    // normal k×k convolution (only the first layer: 3 → 32 channels)
    function convFull(x, C, H, W, L) {
      var s = L.stride, p = L.pad, k = L.k, CO = L.cout;
      var Ho = Math.floor((H + 2 * p - k) / s) + 1, Wo = Math.floor((W + 2 * p - k) / s) + 1;
      var out = new Float32Array(CO * Ho * Wo), w = L.w, b = L.b;
      for (var co = 0; co < CO; co++) {
        var ob = co * Ho * Wo;
        for (var oy = 0; oy < Ho; oy++) {
          for (var ox = 0; ox < Wo; ox++) {
            var sum = b[co];
            for (var ci = 0; ci < C; ci++) {
              for (var ky = 0; ky < k; ky++) {
                var iy = oy * s - p + ky;
                if (iy < 0 || iy >= H) continue;
                for (var kx = 0; kx < k; kx++) {
                  var ix = ox * s - p + kx;
                  if (ix < 0 || ix >= W) continue;
                  sum += w[((co * C + ci) * k + ky) * k + kx] * x[(ci * H + iy) * W + ix];
                }
              }
            }
            out[ob + oy * Wo + ox] = L.relu && sum < 0 ? 0 : sum;
          }
        }
      }
      return { d: out, C: CO, H: Ho, W: Wo };
    }

    function run(chw) {
      var env = {};
      env[meta.input] = { d: chw, C: 3, H: meta.size, W: meta.size };
      var uses = {};
      layers.forEach(function (l) {
        [l.inp, l.a, l.b, l.in].forEach(function (n) { if (typeof n === "string") uses[n] = (uses[n] || 0) + 1; });
      });
      function take(n) {
        var t = env[n];
        if (--uses[n] <= 0) delete env[n]; // free memory early
        return t;
      }
      for (var i = 0; i < layers.length; i++) {
        var l = layers[i];
        if (l.op === "conv") {
          var x = take(l.inp);
          var r = l.group > 1 ? convDw(x.d, x.C, x.H, x.W, l)
            : (l.k === 1 && l.stride === 1 && l.pad === 0 ? conv1x1(x.d, x.C, x.H, x.W, l) : convFull(x.d, x.C, x.H, x.W, l));
          env[l.out] = r;
        } else if (l.op === "add") {
          var a = take(l.a), bb = take(l.b), sum = new Float32Array(a.d.length);
          for (var j = 0; j < sum.length; j++) sum[j] = a.d[j] + bb.d[j];
          env[l.out] = { d: sum, C: a.C, H: a.H, W: a.W };
        } else if (l.op === "gap") {
          var g = take(l.in), HW = g.H * g.W, f = new Float32Array(g.C);
          for (var c = 0; c < g.C; c++) {
            var acc = 0;
            for (var j2 = 0; j2 < HW; j2++) acc += g.d[c * HW + j2];
            f[c] = acc / HW;
          }
          env[l.out] = { d: f, C: g.C, H: 1, W: 1 };
        }
      }
      return env[meta.output].d;
    }

    // RGBA pixels (size × size) -> normalised CHW floats
    function fromRGBA(rgba) {
      var n = meta.size * meta.size, x = new Float32Array(3 * n);
      for (var c = 0; c < 3; c++) {
        var m = meta.mean[c], sd = meta.std[c];
        for (var i = 0; i < n; i++) x[c * n + i] = (rgba[i * 4 + c] / 255 - m) / sd;
      }
      return x;
    }

    function unit(v) {
      var s = 0;
      for (var i = 0; i < v.length; i++) s += v[i] * v[i];
      s = Math.sqrt(s) || 1;
      var o = new Float32Array(v.length);
      for (var j = 0; j < v.length; j++) o[j] = v[j] / s;
      return o;
    }

    return {
      run: run,
      embedRGBA: function (rgba) { return unit(run(fromRGBA(rgba))); },
      size: meta.size
    };
  }

  root.MNET = { createNet: createNet };
  if (typeof module !== "undefined" && module.exports) module.exports = root.MNET;
})(typeof self !== "undefined" ? self : this);
