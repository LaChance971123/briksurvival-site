/* Decorative orthographic globe. No reports, markers, location or network access. */
(function () {
  'use strict';
  const svg = document.querySelector('[data-briefing-globe]');
  if (!svg) return;
  const land = svg.querySelector('[data-globe-land]');
  const grid = svg.querySelector('[data-globe-meridians]');
  const staticGrid = svg.querySelector('.globe-grid');
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const radians = Math.PI / 180;
  // Simplified coast contours are an illustration, never geographic coverage data.
  const coasts = [
    [[-168,65],[-150,71],[-130,70],[-110,73],[-82,70],[-62,58],[-54,52],[-66,46],[-75,35],[-81,25],[-90,29],[-97,22],[-87,16],[-83,9],[-78,8],[-87,20],[-105,24],[-114,32],[-124,42],[-130,54],[-145,60],[-168,65]],
    [[-81,12],[-68,10],[-60,5],[-51,4],[-35,-7],[-39,-20],[-49,-29],[-55,-38],[-67,-55],[-74,-48],[-73,-33],[-80,-8],[-81,12]],
    [[-52,60],[-43,60],[-24,76],[-40,83],[-59,77],[-64,67],[-52,60]],
    [[-10,36],[-9,43],[-1,49],[8,54],[5,60],[18,71],[29,69],[36,62],[60,70],[90,76],[130,70],[160,65],[179,62],[168,53],[149,48],[140,36],[129,32],[121,24],[108,20],[106,9],[100,1],[97,13],[90,22],[80,8],[72,21],[62,25],[52,15],[43,13],[36,30],[29,40],[21,36],[16,42],[8,44],[3,41],[-10,36]],
    [[-17,15],[-17,25],[-7,35],[10,37],[25,32],[33,30],[43,12],[51,11],[42,-3],[35,-18],[28,-33],[18,-35],[12,-18],[9,3],[-1,5],[-10,5],[-17,15]],
    [[113,-22],[122,-15],[132,-12],[140,-17],[146,-14],[153,-25],[150,-37],[137,-36],[131,-31],[116,-35],[113,-22]],
    [[44,-13],[50,-15],[48,-25],[44,-25],[44,-13]],
    [[130,31],[136,35],[141,41],[145,44]],
    [[95,5],[105,-6],[114,-7],[119,-3],[110,7],[105,1]],
    [[166,-35],[178,-39],[172,-45],[166,-47]],
    [[-8,50],[-5,59],[1,58],[1,51],[-8,50]]
  ];
  const samples = points => {
    const result = [];
    for (let i = 1; i < points.length; i++) {
      const a = points[i-1], b = points[i];
      const steps = Math.ceil(Math.max(Math.abs(b[0]-a[0]),Math.abs(b[1]-a[1])) / 4);
      for (let j = 0; j < steps; j++) result.push([a[0]+(b[0]-a[0])*j/steps,a[1]+(b[1]-a[1])*j/steps]);
    }
    return [...result,points.at(-1)];
  };
  const contours = coasts.map(samples), graticule = [];
  for (let lat = -60; lat <= 60; lat += 30) graticule.push(samples([[-180,lat],[180,lat]]));
  for (let lon = -180; lon < 180; lon += 30) graticule.push(samples([[lon,-90],[lon,90]]));
  let rotation = -25 * radians, frame = null, lastTime = null, lastPaint = 0, visible = false;
  function projected([lon,lat]) {
    const x = Math.cos(lat*radians)*Math.sin(lon*radians+rotation);
    const y = Math.sin(lat*radians);
    return { x:120+100*x, y:120-100*y, z:Math.cos(lat*radians)*Math.cos(lon*radians+rotation) };
  }
  function path(lines) {
    return lines.map(points => {
      let drawing = false, result = '', previous = null;
      for (const point of points) {
        const p = projected(point);
        // End visible contours at the horizon without joining through the back.
        if (previous && (p.z >= 0) !== (previous.z >= 0)) {
          const t = previous.z/(previous.z-p.z);
          const x = previous.x+(p.x-previous.x)*t, y = previous.y+(p.y-previous.y)*t;
          result += (drawing?'L':'M')+x.toFixed(1)+','+y.toFixed(1);
          drawing = p.z >= 0;
        }
        if (p.z >= 0) { result += (drawing?'L':'M')+p.x.toFixed(1)+','+p.y.toFixed(1); drawing = true; }
        else drawing = false;
        previous = p;
      }
      return result;
    }).join('');
  }
  function paint() {
    land.setAttribute('d',path(contours));
    grid.setAttribute('d',path(graticule));
    staticGrid?.setAttribute('visibility','hidden');
  }
  function tick(time) {
    frame = null;
    if (lastTime !== null) rotation += Math.min(time-lastTime,100)*Math.PI*2/90000;
    lastTime = time;
    if (time-lastPaint >= 1000/24) { paint(); lastPaint = time; }
    frame = window.requestAnimationFrame(tick);
  }
  function sync() {
    const running = visible && !document.hidden && !motion.matches;
    svg.setAttribute('data-globe-motion',running?'running':'paused');
    if (running && frame === null) frame = window.requestAnimationFrame(tick);
    else if (!running && frame !== null) { window.cancelAnimationFrame(frame); frame = null; }
    if (!running) lastTime = null;
  }
  paint();
  // Older browsers keep the static illustration rather than an unbounded loop.
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(entries => { visible = entries[0].isIntersecting; sync(); });
    observer.observe(svg);
  }
  motion.addEventListener?.('change',sync);
  document.addEventListener('visibilitychange',sync);
  window.addEventListener('pagehide',() => { visible = false; sync(); });
  window.addEventListener('pageshow',() => {
    const bounds = svg.getBoundingClientRect();
    visible = bounds.bottom > 0 && bounds.top < window.innerHeight;
    sync();
  });
  sync();
}());
