/* Marshal Fitness — photo search helper (runs in the background, so the page
   never freezes). Loads the small picture model once and turns pictures into
   fingerprints. The photo never leaves the phone. */
/* global importScripts, MNET */
importScripts("mnet.js");
var net = null;
var loading = null;

function load() {
  if (net) return Promise.resolve(net);
  if (!loading) {
    loading = Promise.all([
      fetch("mnet.json").then(function (r) { if (!r.ok) throw new Error("model"); return r.json(); }),
      fetch("mnet.bin").then(function (r) { if (!r.ok) throw new Error("model"); return r.arrayBuffer(); })
    ]).then(function (res) {
      net = MNET.createNet(res[0], res[1]);
      return net;
    });
    loading.catch(function () { loading = null; });
  }
  return loading;
}

self.onmessage = function (e) {
  var m = e.data || {};
  if (m.cmd === "load") {
    load().then(function () { self.postMessage({ id: m.id, ok: true }); },
      function (err) { self.postMessage({ id: m.id, error: String(err && err.message || err) }); });
  } else if (m.cmd === "embed") {
    load().then(function (n) {
      var vecs = m.images.map(function (buf) { return n.embedRGBA(new Uint8ClampedArray(buf)); });
      self.postMessage({ id: m.id, ok: true, vecs: vecs }, vecs.map(function (v) { return v.buffer; }));
    }).catch(function (err) { self.postMessage({ id: m.id, error: String(err && err.message || err) }); });
  }
};
