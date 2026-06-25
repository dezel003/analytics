/* devonte.design — first-party, cookieless tracker. ~2KB. */
(function () {
  'use strict';
  if (navigator.doNotTrack === '1') return; // respect DNT

  // Derive the collector origin from this script's own <src> so the same
  // snippet works cross-origin (e.g. loaded on devonte.design, posting to the
  // analytics deployment). Falls back to same-origin if it can't be resolved.
  var ORIGIN = (function () {
    try {
      var s = document.currentScript || (function () {
        var all = document.getElementsByTagName('script');
        for (var i = all.length - 1; i >= 0; i--) {
          if (all[i].src && all[i].src.indexOf('track.js') !== -1) return all[i];
        }
        return null;
      })();
      if (s && s.src) return new URL(s.src).origin;
    } catch (e) {}
    return location.origin;
  })();

  var ENDPOINT = ORIGIN + '/api/collect';
  var HEARTBEAT_MS = 15000;

  var loadedAt = Date.now();
  var lastPath = location.pathname + location.search;
  var heartbeatTimer = null;

  function send(type, extra) {
    var payload = {
      type: type,
      path: location.pathname + location.search,
      referrer: document.referrer || '',
      screen_w: window.screen ? screen.width : null,
      screen_h: window.screen ? screen.height : null,
    };
    if (extra) for (var k in extra) payload[k] = extra[k];
    var data = JSON.stringify(payload);

    // sendBeacon survives page unload; fetch is the fallback.
    if (type === 'exit' && navigator.sendBeacon) {
      navigator.sendBeacon(ENDPOINT, new Blob([data], { type: 'application/json' }));
    } else {
      try {
        fetch(ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: data,
          keepalive: true,
        });
      } catch (e) {}
    }
  }

  function duration() {
    return Date.now() - loadedAt;
  }

  function startHeartbeat() {
    stopHeartbeat();
    heartbeatTimer = setInterval(function () {
      if (document.visibilityState === 'visible') {
        send('heartbeat', { duration_ms: duration() });
      }
    }, HEARTBEAT_MS);
  }
  function stopHeartbeat() {
    if (heartbeatTimer) clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }

  function pageview() {
    loadedAt = Date.now();
    lastPath = location.pathname + location.search;
    send('pageview');
    startHeartbeat();
  }

  // SPA route changes: wrap history methods + listen to popstate.
  function onRouteChange() {
    var current = location.pathname + location.search;
    if (current === lastPath) return;
    send('exit', { duration_ms: duration() }); // close out previous page
    pageview();
  }
  ['pushState', 'replaceState'].forEach(function (m) {
    var orig = history[m];
    history[m] = function () {
      var r = orig.apply(this, arguments);
      onRouteChange();
      return r;
    };
  });
  window.addEventListener('popstate', onRouteChange);

  // Flush on tab hide / unload.
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'hidden') {
      send('exit', { duration_ms: duration() });
    }
  });
  window.addEventListener('pagehide', function () {
    send('exit', { duration_ms: duration() });
  });

  pageview(); // initial load
})();
