import test from 'node:test';
import assert from 'node:assert/strict';
import {handleORS}from'../lib/tmb/server';
const coordinates=[[6.7981,45.8908],[6.7781,45.8902]];
const request=(body:unknown,ip='test',origin='http://localhost')=>new Request('http://localhost/api/route',{method:'POST',headers:{'Content-Type':'application/json','cf-connecting-ip':ip,origin},body:JSON.stringify(body)});
test('server validates coordinates, region, origin and bounded body',async()=>{process.env.ORS_API_KEY='test-only-placeholder';for(const body of [{coordinates:[['x',45],[6,46]]},{coordinates:[[0,0],[1,1]]},{coordinates:[]},{coordinates,extra:true}])assert.equal((await handleORS(request(body),'route')).status,400);assert.equal((await handleORS(request({coordinates},'origin','https://other.example'),'route')).status,403);assert.equal((await handleORS(request('x'.repeat(160001),'large'),'route')).status,413);});
test('server handles upstream quota, unavailable routing and valid elevation',async()=>{process.env.ORS_API_KEY='test-only-placeholder';const original=globalThis.fetch;try{globalThis.fetch=async()=>new Response('{}',{status:429,headers:{'Retry-After':'90'}});const quota=await handleORS(request({coordinates},'quota'),'route');assert.equal(quota.status,429);assert.equal(quota.headers.get('retry-after'),'90');globalThis.fetch=async()=>new Response('{}',{status:404});assert.equal((await handleORS(request({coordinates},'missing'),'route')).status,422);globalThis.fetch=async()=>Response.json({geometry:{coordinates:[[6.7981,45.8908,1000],[6.7781,45.8902,1200]]}});const response=await handleORS(request({coordinates},'elevation'),'elevation');assert.equal(response.status,200);const json=await response.json() as {points:{ele:number}[]};assert.equal(json.points[1].ele,1200);}finally{globalThis.fetch=original;}});
test('public API has a per-IP request limit without consuming upstream quota in tests',async()=>{process.env.ORS_API_KEY='test-only-placeholder';for(let i=0;i<30;i++)assert.equal((await handleORS(request({coordinates:[]},'rate-test'),'route')).status,400);assert.equal((await handleORS(request({coordinates:[]},'rate-test'),'route')).status,429);});

test('routing and elevation use the supported HeiGIT APIs with the server credential', async () => {
  process.env.ORS_API_KEY = 'test-only-placeholder';
  const original = globalThis.fetch;
  const oldRouteUrl = process.env.ORS_DIRECTIONS_URL;
  const oldElevationUrl = process.env.ORS_ELEVATION_URL;
  delete process.env.ORS_DIRECTIONS_URL;
  delete process.env.ORS_ELEVATION_URL;
  const calls: { url: string; authorization: string | null }[] = [];
  try {
    globalThis.fetch = async (url, options) => {
      calls.push({ url: String(url), authorization: new Headers(options?.headers).get('authorization') });
      return String(url).includes('/directions/')
        ? Response.json({ features: [{ geometry: { coordinates: [[6.7981,45.8908,1000],[6.7781,45.8902,1200]] } }] })
        : Response.json({ geometry: { coordinates: [[6.7981,45.8908,1000],[6.7781,45.8902,1200]] } });
    };
    for (const kind of ['route', 'elevation'] as const) {
      const response = await handleORS(request({ coordinates }, `endpoint-${kind}`), kind);
      assert.equal(response.status, 200);
      const data = await response.json() as { points: { ele: number }[] };
      assert.equal(data.points[1].ele, 1200);
      assert.ok(!JSON.stringify(data).includes('test-only-placeholder'));
    }
    assert.deepEqual(calls, [
      { url: 'https://api.heigit.org/openrouteservice/v2/directions/foot-hiking/geojson', authorization: 'test-only-placeholder' },
      { url: 'https://api.heigit.org/openelevationservice/v0/line', authorization: 'test-only-placeholder' },
    ]);
  } finally {
    globalThis.fetch = original;
    if (oldRouteUrl === undefined) delete process.env.ORS_DIRECTIONS_URL; else process.env.ORS_DIRECTIONS_URL = oldRouteUrl;
    if (oldElevationUrl === undefined) delete process.env.ORS_ELEVATION_URL; else process.env.ORS_ELEVATION_URL = oldElevationUrl;
  }
});

test('an unreachable provider is distinct from a genuine timeout', async () => {
  process.env.ORS_API_KEY = 'test-only-placeholder';
  const original = globalThis.fetch;
  try {
    globalThis.fetch = async () => { throw new TypeError('fetch failed'); };
    assert.equal((await handleORS(request({ coordinates }, 'network-failure'), 'route')).status, 502);
    globalThis.fetch = async () => { throw new DOMException('timeout', 'TimeoutError'); };
    assert.equal((await handleORS(request({ coordinates }, 'timeout'), 'route')).status, 504);
  } finally { globalThis.fetch = original; }
});

test('invalid provider JSON is an upstream error, not invalid user input', async () => {
  process.env.ORS_API_KEY = 'test-only-placeholder';
  const original = globalThis.fetch;
  try {
    globalThis.fetch = async () => new Response('<html>Maintenance</html>', { status: 200 });
    assert.equal((await handleORS(request({ coordinates }, 'bad-provider-json'), 'route')).status, 502);
  } finally { globalThis.fetch = original; }
});

test('a valid hiking route taking 44 seconds is not cancelled at the former 25-second deadline', async (t) => {
  process.env.ORS_API_KEY = 'test-only-placeholder';
  t.mock.timers.enable({ apis: ['setTimeout'] });
  // Make AbortSignal's deadline use the test clock as well as the delayed response.
  t.mock.method(AbortSignal, 'timeout', (milliseconds: number) => {
    const controller = new AbortController();
    setTimeout(() => controller.abort(new DOMException('Deadline', 'TimeoutError')), milliseconds);
    return controller.signal;
  });
  let ready!: () => void;
  const started = new Promise<void>(resolve => { ready = resolve; });
  t.mock.method(globalThis, 'fetch', (_url: unknown, options: RequestInit) => new Promise<Response>((resolve, reject) => {
    options.signal?.addEventListener('abort', () => reject(options.signal?.reason), { once: true });
    setTimeout(() => resolve(Response.json({ features: [{ geometry: { coordinates: [[6.7981,45.8908,1000],[6.7781,45.8902,1200]] } }] })), 44000);
    ready();
  }));
  const pending = handleORS(request({ coordinates }, 'slow-valid-route'), 'route');
  await started;
  t.mock.timers.tick(44000);
  const response = await pending;
  assert.equal(response.status, 200);
  const data = await response.json() as { points: { ele: number }[] };
  assert.equal(data.points[1].ele, 1200);
});
