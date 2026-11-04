/* Pocket Bake — map baking engine (runs in a Web Worker).
 *
 * Projects a high-poly mesh onto a low-poly mesh's UVs and extracts:
 *   • Normal map (tangent space, OpenGL or DirectX green)
 *   • Ambient Occlusion
 *   • Curvature
 *
 * Pure geometry — no three.js. Everything below is also exported for Node so
 * the math can be unit-tested headlessly (see bake/test). — mikibutler.ca/bake
 */
(function (global) {
  'use strict';

  /* ------------------------------------------------------------------ *
   *  OBJ parsing
   * ------------------------------------------------------------------ */
  // Returns raw arrays: vP (positions), vT (uvs), vN (normals) and faces as
  // triangulated corner triples [[pi,ti,ni], ...] (0-based; ti/ni may be -1).
  function parseOBJ(text) {
    const vP = [], vT = [], vN = [], faces = [];
    const lines = text.split('\n');
    for (let li = 0; li < lines.length; li++) {
      const line = lines[li];
      // fast first-char dispatch
      const c0 = line.charCodeAt(0);
      if (c0 === 118) { // 'v'
        const c1 = line.charCodeAt(1);
        const parts = line.split(/\s+/);
        if (c1 === 32 || c1 === 9) { vP.push(+parts[1], +parts[2], +parts[3]); }
        else if (c1 === 116) { vT.push(+parts[1], +parts[2]); }            // vt
        else if (c1 === 110) { vN.push(+parts[1], +parts[2], +parts[3]); } // vn
      } else if (c0 === 102) { // 'f'
        const parts = line.trim().split(/\s+/);
        const corners = [];
        for (let i = 1; i < parts.length; i++) {
          const t = parts[i];
          if (!t) continue;
          const s = t.split('/');
          let pi = parseInt(s[0], 10);
          let ti = s.length > 1 && s[1] !== '' ? parseInt(s[1], 10) : 0;
          let ni = s.length > 2 && s[2] !== '' ? parseInt(s[2], 10) : 0;
          const np = vP.length / 3, nt = vT.length / 2, nn = vN.length / 3;
          pi = pi < 0 ? np + pi : pi - 1;
          ti = ti === 0 ? -1 : (ti < 0 ? nt + ti : ti - 1);
          ni = ni === 0 ? -1 : (ni < 0 ? nn + ni : ni - 1);
          corners.push([pi, ti, ni]);
        }
        // fan-triangulate
        for (let i = 2; i < corners.length; i++) faces.push([corners[0], corners[i - 1], corners[i]]);
      }
    }
    return { vP, vT, vN, faces };
  }

  function bbox(posArr, n) {
    let mnx = Infinity, mny = Infinity, mnz = Infinity, mxx = -Infinity, mxy = -Infinity, mxz = -Infinity;
    for (let i = 0, p = 0; i < n; i++, p += 3) {
      const x = posArr[p], y = posArr[p + 1], z = posArr[p + 2];
      if (x < mnx) mnx = x; if (y < mny) mny = y; if (z < mnz) mnz = z;
      if (x > mxx) mxx = x; if (y > mxy) mxy = y; if (z > mxz) mxz = z;
    }
    return { mnx, mny, mnz, mxx, mxy, mxz, dx: mxx - mnx, dy: mxy - mny, dz: mxz - mnz,
             diag: Math.hypot(mxx - mnx, mxy - mny, mxz - mnz) };
  }

  /* ------------------------------------------------------------------ *
   *  High-poly: indexed verts + smooth normals + per-vertex curvature
   * ------------------------------------------------------------------ */
  function buildHigh(obj) {
    const V = obj.vP.length / 3;
    const pos = Float32Array.from(obj.vP);
    const F = obj.faces.length;
    const tris = new Int32Array(F * 3);
    for (let f = 0; f < F; f++) {
      const fc = obj.faces[f];
      tris[f * 3] = fc[0][0]; tris[f * 3 + 1] = fc[1][0]; tris[f * 3 + 2] = fc[2][0];
    }
    // area-weighted vertex normals
    const nrm = new Float32Array(V * 3);
    for (let f = 0; f < F; f++) {
      const a = tris[f * 3] * 3, b = tris[f * 3 + 1] * 3, c = tris[f * 3 + 2] * 3;
      const ux = pos[b] - pos[a], uy = pos[b + 1] - pos[a + 1], uz = pos[b + 2] - pos[a + 2];
      const vx = pos[c] - pos[a], vy = pos[c + 1] - pos[a + 1], vz = pos[c + 2] - pos[a + 2];
      const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx; // area-weighted
      nrm[a] += nx; nrm[a + 1] += ny; nrm[a + 2] += nz;
      nrm[tris[f * 3 + 1] * 3] += nx; nrm[tris[f * 3 + 1] * 3 + 1] += ny; nrm[tris[f * 3 + 1] * 3 + 2] += nz;
      nrm[tris[f * 3 + 2] * 3] += nx; nrm[tris[f * 3 + 2] * 3 + 1] += ny; nrm[tris[f * 3 + 2] * 3 + 2] += nz;
    }
    for (let v = 0, p = 0; v < V; v++, p += 3) {
      const l = Math.hypot(nrm[p], nrm[p + 1], nrm[p + 2]) || 1;
      nrm[p] /= l; nrm[p + 1] /= l; nrm[p + 2] /= l;
    }
    // Prefer the authored normals (vn) where present — respects the artist's
    // intended orientation even if winding is irregular; keep geometric as the
    // fallback for any vertex the file didn't cover.
    if (obj.vN.length) {
      const fn = new Float32Array(V * 3), got = new Uint8Array(V);
      for (let f = 0; f < F; f++) {
        const fc = obj.faces[f];
        for (let k = 0; k < 3; k++) {
          const ni = fc[k][2]; if (ni < 0) continue;
          const vi = fc[k][0] * 3;
          fn[vi] += obj.vN[ni * 3]; fn[vi + 1] += obj.vN[ni * 3 + 1]; fn[vi + 2] += obj.vN[ni * 3 + 2];
          got[fc[k][0]] = 1;
        }
      }
      for (let v = 0, p = 0; v < V; v++, p += 3) {
        if (!got[v]) continue;
        const l = Math.hypot(fn[p], fn[p + 1], fn[p + 2]) || 1;
        nrm[p] = fn[p] / l; nrm[p + 1] = fn[p + 1] / l; nrm[p + 2] = fn[p + 2] / l;
      }
    }
    // per-vertex curvature: mean of dot(normalize(edge), n_v) over neighbours.
    // Convex surfaces -> neighbours sit behind the normal -> negative, so negate
    // to make convex positive / concave negative.
    const curv = new Float32Array(V);
    const deg = new Float32Array(V);
    const addEdge = (i, j) => {
      const pi = i * 3, pj = j * 3;
      let ex = pos[pj] - pos[pi], ey = pos[pj + 1] - pos[pi + 1], ez = pos[pj + 2] - pos[pi + 2];
      const l = Math.hypot(ex, ey, ez) || 1; ex /= l; ey /= l; ez /= l;
      curv[i] += ex * nrm[pi] + ey * nrm[pi + 1] + ez * nrm[pi + 2];
      deg[i]++;
    };
    for (let f = 0; f < F; f++) {
      const a = tris[f * 3], b = tris[f * 3 + 1], c = tris[f * 3 + 2];
      addEdge(a, b); addEdge(b, a); addEdge(b, c); addEdge(c, b); addEdge(c, a); addEdge(a, c);
    }
    for (let v = 0; v < V; v++) curv[v] = deg[v] ? -curv[v] / deg[v] : 0;
    return { pos, nrm, curv, tris, V, F, bbox: bbox(pos, V) };
  }

  /* ------------------------------------------------------------------ *
   *  Low-poly: per-corner position / uv / normal + per-tri tangent frame
   * ------------------------------------------------------------------ */
  function buildLow(obj) {
    const F = obj.faces.length;
    const V = obj.vP.length / 3;
    const hasUV = obj.vT.length > 0;
    // smooth normals if the file has none
    let smooth = null;
    if (obj.vN.length === 0) {
      smooth = new Float32Array(V * 3);
      for (let f = 0; f < F; f++) {
        const fc = obj.faces[f], a = fc[0][0] * 3, b = fc[1][0] * 3, c = fc[2][0] * 3;
        const ux = obj.vP[b] - obj.vP[a], uy = obj.vP[b + 1] - obj.vP[a + 1], uz = obj.vP[b + 2] - obj.vP[a + 2];
        const vx = obj.vP[c] - obj.vP[a], vy = obj.vP[c + 1] - obj.vP[a + 1], vz = obj.vP[c + 2] - obj.vP[a + 2];
        const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
        for (let k = 0; k < 3; k++) { const vi = fc[k][0] * 3; smooth[vi] += nx; smooth[vi + 1] += ny; smooth[vi + 2] += nz; }
      }
      for (let v = 0, p = 0; v < V; v++, p += 3) { const l = Math.hypot(smooth[p], smooth[p + 1], smooth[p + 2]) || 1; smooth[p] /= l; smooth[p + 1] /= l; smooth[p + 2] /= l; }
    }
    const P = new Float32Array(F * 9);   // 3 corners * xyz
    const UV = new Float32Array(F * 6);  // 3 corners * uv
    const Nc = new Float32Array(F * 9);  // 3 corners * normal
    const Tt = new Float32Array(F * 3);  // per-tri tangent
    const Ts = new Float32Array(F);      // per-tri handedness sign
    for (let f = 0; f < F; f++) {
      const fc = obj.faces[f];
      for (let k = 0; k < 3; k++) {
        const pi = fc[k][0] * 3, ti = fc[k][1], ni = fc[k][2];
        P[f * 9 + k * 3] = obj.vP[pi]; P[f * 9 + k * 3 + 1] = obj.vP[pi + 1]; P[f * 9 + k * 3 + 2] = obj.vP[pi + 2];
        UV[f * 6 + k * 2] = ti >= 0 ? obj.vT[ti * 2] : 0;
        UV[f * 6 + k * 2 + 1] = ti >= 0 ? obj.vT[ti * 2 + 1] : 0;
        if (ni >= 0 && obj.vN.length) { Nc[f * 9 + k * 3] = obj.vN[ni * 3]; Nc[f * 9 + k * 3 + 1] = obj.vN[ni * 3 + 1]; Nc[f * 9 + k * 3 + 2] = obj.vN[ni * 3 + 2]; }
        else if (smooth) { Nc[f * 9 + k * 3] = smooth[fc[k][0] * 3]; Nc[f * 9 + k * 3 + 1] = smooth[fc[k][0] * 3 + 1]; Nc[f * 9 + k * 3 + 2] = smooth[fc[k][0] * 3 + 2]; }
      }
      // tangent from uv gradient (constant over the triangle)
      const ax = P[f * 9], ay = P[f * 9 + 1], az = P[f * 9 + 2];
      const e1x = P[f * 9 + 3] - ax, e1y = P[f * 9 + 4] - ay, e1z = P[f * 9 + 5] - az;
      const e2x = P[f * 9 + 6] - ax, e2y = P[f * 9 + 7] - ay, e2z = P[f * 9 + 8] - az;
      const du1 = UV[f * 6 + 2] - UV[f * 6], dv1 = UV[f * 6 + 3] - UV[f * 6 + 1];
      const du2 = UV[f * 6 + 4] - UV[f * 6], dv2 = UV[f * 6 + 5] - UV[f * 6 + 1];
      const det = du1 * dv2 - du2 * dv1;
      const r = det ? 1 / det : 0;
      let tx = (dv2 * e1x - dv1 * e2x) * r, ty = (dv2 * e1y - dv1 * e2y) * r, tz = (dv2 * e1z - dv1 * e2z) * r;
      const tl = Math.hypot(tx, ty, tz) || 1; tx /= tl; ty /= tl; tz /= tl;
      Tt[f * 3] = tx; Tt[f * 3 + 1] = ty; Tt[f * 3 + 2] = tz;
      Ts[f] = det < 0 ? -1 : 1;
    }
    return { P, UV, Nc, Tt, Ts, F, hasUV, bbox: bbox(obj.vP, V) };
  }

  /* ------------------------------------------------------------------ *
   *  BVH over a triangle soup (median split on centroids)
   * ------------------------------------------------------------------ */
  function buildBVH(pos, tris) {
    const F = tris.length / 3;
    const cen = new Float32Array(F * 3);
    const tmin = new Float32Array(F * 3), tmax = new Float32Array(F * 3);
    for (let f = 0; f < F; f++) {
      const a = tris[f * 3] * 3, b = tris[f * 3 + 1] * 3, c = tris[f * 3 + 2] * 3;
      for (let k = 0; k < 3; k++) {
        const v0 = pos[a + k], v1 = pos[b + k], v2 = pos[c + k];
        tmin[f * 3 + k] = Math.min(v0, v1, v2);
        tmax[f * 3 + k] = Math.max(v0, v1, v2);
        cen[f * 3 + k] = (v0 + v1 + v2) / 3;
      }
    }
    const order = new Int32Array(F);
    for (let i = 0; i < F; i++) order[i] = i;
    const nodes = []; // {min[3],max[3], start,count, left,right}
    const LEAF = 4;
    function build(start, count) {
      const ni = nodes.length;
      const node = { min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity], start, count, left: -1, right: -1 };
      nodes.push(node);
      for (let i = start; i < start + count; i++) {
        const f = order[i];
        for (let k = 0; k < 3; k++) {
          if (tmin[f * 3 + k] < node.min[k]) node.min[k] = tmin[f * 3 + k];
          if (tmax[f * 3 + k] > node.max[k]) node.max[k] = tmax[f * 3 + k];
        }
      }
      if (count <= LEAF) return ni;
      // split on longest centroid axis at median
      let ax = 0; const ex = node.max[0] - node.min[0], ey = node.max[1] - node.min[1], ez = node.max[2] - node.min[2];
      if (ey > ex && ey >= ez) ax = 1; else if (ez > ex && ez > ey) ax = 2;
      const sub = Array.prototype.slice.call(order.subarray(start, start + count));
      sub.sort((f1, f2) => cen[f1 * 3 + ax] - cen[f2 * 3 + ax]);
      for (let i = 0; i < count; i++) order[start + i] = sub[i];
      const mid = count >> 1;
      if (mid === 0 || mid === count) return ni; // degenerate -> leaf
      node.count = -1; // internal
      node.left = build(start, mid);
      node.right = build(start + mid, count - mid);
      return ni;
    }
    if (F > 0) build(0, F);
    return { nodes, order, pos, tris };
  }

  // Closest hit: returns {t, f, u, v} or null. ray o + d*t, t in [0,tmax].
  function rayClosest(bvh, ox, oy, oz, dx, dy, dz, tmax) {
    const { nodes, order, pos, tris } = bvh;
    if (!nodes.length) return null;
    const idx = 1 / dx, idy = 1 / dy, idz = 1 / dz;
    const stack = rayClosest._st || (rayClosest._st = new Int32Array(128));
    let sp = 0; stack[sp++] = 0;
    let bestT = tmax, bf = -1, bu = 0, bv = 0;
    while (sp > 0) {
      const ni = stack[--sp];
      const nd = nodes[ni];
      // slab test
      let t1 = (nd.min[0] - ox) * idx, t2 = (nd.max[0] - ox) * idx;
      let tnear = Math.min(t1, t2), tfar = Math.max(t1, t2);
      t1 = (nd.min[1] - oy) * idy; t2 = (nd.max[1] - oy) * idy;
      tnear = Math.max(tnear, Math.min(t1, t2)); tfar = Math.min(tfar, Math.max(t1, t2));
      t1 = (nd.min[2] - oz) * idz; t2 = (nd.max[2] - oz) * idz;
      tnear = Math.max(tnear, Math.min(t1, t2)); tfar = Math.min(tfar, Math.max(t1, t2));
      if (tfar < Math.max(tnear, 0) || tnear > bestT) continue;
      if (nd.count >= 0) {
        for (let i = nd.start; i < nd.start + nd.count; i++) {
          const f = order[i];
          const a = tris[f * 3] * 3, b = tris[f * 3 + 1] * 3, c = tris[f * 3 + 2] * 3;
          const e1x = pos[b] - pos[a], e1y = pos[b + 1] - pos[a + 1], e1z = pos[b + 2] - pos[a + 2];
          const e2x = pos[c] - pos[a], e2y = pos[c + 1] - pos[a + 1], e2z = pos[c + 2] - pos[a + 2];
          const px = dy * e2z - dz * e2y, py = dz * e2x - dx * e2z, pz = dx * e2y - dy * e2x;
          const det = e1x * px + e1y * py + e1z * pz;
          if (det > -1e-12 && det < 1e-12) continue;
          const inv = 1 / det;
          const sx = ox - pos[a], sy = oy - pos[a + 1], sz = oz - pos[a + 2];
          const u = (sx * px + sy * py + sz * pz) * inv;
          if (u < -1e-6 || u > 1 + 1e-6) continue;
          const qx = sy * e1z - sz * e1y, qy = sz * e1x - sx * e1z, qz = sx * e1y - sy * e1x;
          const v = (dx * qx + dy * qy + dz * qz) * inv;
          if (v < -1e-6 || u + v > 1 + 1e-6) continue;
          const t = (e2x * qx + e2y * qy + e2z * qz) * inv;
          if (t > 1e-7 && t < bestT) { bestT = t; bf = f; bu = u; bv = v; }
        }
      } else {
        if (sp < 126) { stack[sp++] = nd.left; stack[sp++] = nd.right; }
      }
    }
    return bf < 0 ? null : { t: bestT, f: bf, u: bu, v: bv };
  }

  // Any hit within tmax (for occlusion). Returns true if occluded.
  function rayOccluded(bvh, ox, oy, oz, dx, dy, dz, tmax) {
    const { nodes, order, pos, tris } = bvh;
    if (!nodes.length) return false;
    const idx = 1 / dx, idy = 1 / dy, idz = 1 / dz;
    const stack = rayOccluded._st || (rayOccluded._st = new Int32Array(128));
    let sp = 0; stack[sp++] = 0;
    while (sp > 0) {
      const nd = nodes[stack[--sp]];
      let t1 = (nd.min[0] - ox) * idx, t2 = (nd.max[0] - ox) * idx;
      let tnear = Math.min(t1, t2), tfar = Math.max(t1, t2);
      t1 = (nd.min[1] - oy) * idy; t2 = (nd.max[1] - oy) * idy;
      tnear = Math.max(tnear, Math.min(t1, t2)); tfar = Math.min(tfar, Math.max(t1, t2));
      t1 = (nd.min[2] - oz) * idz; t2 = (nd.max[2] - oz) * idz;
      tnear = Math.max(tnear, Math.min(t1, t2)); tfar = Math.min(tfar, Math.max(t1, t2));
      if (tfar < Math.max(tnear, 0) || tnear > tmax) continue;
      if (nd.count >= 0) {
        for (let i = nd.start; i < nd.start + nd.count; i++) {
          const f = order[i];
          const a = tris[f * 3] * 3, b = tris[f * 3 + 1] * 3, c = tris[f * 3 + 2] * 3;
          const e1x = pos[b] - pos[a], e1y = pos[b + 1] - pos[a + 1], e1z = pos[b + 2] - pos[a + 2];
          const e2x = pos[c] - pos[a], e2y = pos[c + 1] - pos[a + 1], e2z = pos[c + 2] - pos[a + 2];
          const px = dy * e2z - dz * e2y, py = dz * e2x - dx * e2z, pz = dx * e2y - dy * e2x;
          const det = e1x * px + e1y * py + e1z * pz;
          if (det > -1e-12 && det < 1e-12) continue;
          const inv = 1 / det;
          const sx = ox - pos[a], sy = oy - pos[a + 1], sz = oz - pos[a + 2];
          const u = (sx * px + sy * py + sz * pz) * inv;
          if (u < -1e-6 || u > 1 + 1e-6) continue;
          const qx = sy * e1z - sz * e1y, qy = sz * e1x - sx * e1z, qz = sx * e1y - sy * e1x;
          const v = (dx * qx + dy * qy + dz * qz) * inv;
          if (v < -1e-6 || u + v > 1 + 1e-6) continue;
          const t = (e2x * qx + e2y * qy + e2z * qz) * inv;
          if (t > 1e-6 && t < tmax) return true;
        }
      } else { if (sp < 126) { stack[sp++] = nd.left; stack[sp++] = nd.right; } }
    }
    return false;
  }

  // deterministic cosine-weighted hemisphere samples around +Z
  function hemisphere(k) {
    const dirs = new Float32Array(k * 3);
    const GA = Math.PI * (3 - Math.sqrt(5));
    for (let i = 0; i < k; i++) {
      const xi1 = (i + 0.5) / k;        // stratified radius
      const phi = i * GA;               // golden-angle spiral azimuth
      const r = Math.sqrt(xi1), z = Math.sqrt(1 - xi1);
      dirs[i * 3] = r * Math.cos(phi); dirs[i * 3 + 1] = r * Math.sin(phi); dirs[i * 3 + 2] = z;
    }
    return dirs;
  }

  /* ------------------------------------------------------------------ *
   *  The bake
   * ------------------------------------------------------------------ */
  function bake(lowText, highText, opts, onProgress) {
    opts = opts || {};
    const res = opts.res || 1024;
    const ss = opts.ss || 1;
    const W = res * ss, H = res * ss;
    const maps = opts.maps || { normal: true, ao: true, curv: true };
    const flipGreen = !!opts.flipGreen; // DirectX
    const aoSamples = opts.aoSamples || 24;
    const prog = onProgress || function () {};

    prog('parse', 0.02);
    const low = buildLow(parseOBJ(lowText));
    if (!low.hasUV) throw new Error('The low-poly mesh has no UVs. Unwrap it first — the bake needs UVs to lay the maps out.');
    const high = buildHigh(parseOBJ(highText));
    if (high.F === 0) throw new Error('The high-poly mesh has no triangles.');

    prog('bvh', 0.08);
    const bvh = buildBVH(high.pos, high.tris);

    const diag = high.bbox.diag || low.bbox.diag || 1;
    const rayScale = opts.rayScale == null ? 1 : opts.rayScale;
    const cage = diag * 0.03 * rayScale;          // front == rear search distance
    const aoDist = diag * 0.3 * (opts.aoScale == null ? 1 : opts.aoScale);
    const eps = diag * 2e-4;

    // G-buffer at supersampled resolution
    const N = W * H;
    const gP = new Float32Array(N * 3), gN = new Float32Array(N * 3),
          gT = new Float32Array(N * 3), gB = new Float32Array(N * 3);
    const mask = new Uint8Array(N);

    // ---- rasterize low-poly UV triangles into the G-buffer ----
    for (let f = 0; f < low.F; f++) {
      const u0 = low.UV[f * 6], v0 = low.UV[f * 6 + 1];
      const u1 = low.UV[f * 6 + 2], v1 = low.UV[f * 6 + 3];
      const u2 = low.UV[f * 6 + 4], v2 = low.UV[f * 6 + 5];
      // to pixel space (flip V for image top-left origin)
      const x0 = u0 * W, y0 = (1 - v0) * H, x1 = u1 * W, y1 = (1 - v1) * H, x2 = u2 * W, y2 = (1 - v2) * H;
      const area = (x1 - x0) * (y2 - y0) - (y1 - y0) * (x2 - x0);
      if (Math.abs(area) < 1e-9) continue;
      const invArea = 1 / area;
      let minx = Math.max(0, Math.floor(Math.min(x0, x1, x2)));
      let maxx = Math.min(W - 1, Math.ceil(Math.max(x0, x1, x2)));
      let miny = Math.max(0, Math.floor(Math.min(y0, y1, y2)));
      let maxy = Math.min(H - 1, Math.ceil(Math.max(y0, y1, y2)));
      // per-tri tangent / normal frame refs
      const tfx = low.Tt[f * 3], tfy = low.Tt[f * 3 + 1], tfz = low.Tt[f * 3 + 2], sgn = low.Ts[f];
      for (let y = miny; y <= maxy; y++) {
        const py = y + 0.5;
        for (let x = minx; x <= maxx; x++) {
          const px = x + 0.5;
          let w0 = ((x1 - px) * (y2 - py) - (y1 - py) * (x2 - px)) * invArea;
          let w1 = ((x2 - px) * (y0 - py) - (y2 - py) * (x0 - px)) * invArea;
          let w2 = 1 - w0 - w1;
          if (w0 < -1e-5 || w1 < -1e-5 || w2 < -1e-5) continue;
          const o = (y * W + x);
          if (mask[o]) continue; // first write wins
          // interpolate position + normal
          const Px = w0 * low.P[f * 9] + w1 * low.P[f * 9 + 3] + w2 * low.P[f * 9 + 6];
          const Py = w0 * low.P[f * 9 + 1] + w1 * low.P[f * 9 + 4] + w2 * low.P[f * 9 + 7];
          const Pz = w0 * low.P[f * 9 + 2] + w1 * low.P[f * 9 + 5] + w2 * low.P[f * 9 + 8];
          let Nx = w0 * low.Nc[f * 9] + w1 * low.Nc[f * 9 + 3] + w2 * low.Nc[f * 9 + 6];
          let Ny = w0 * low.Nc[f * 9 + 1] + w1 * low.Nc[f * 9 + 4] + w2 * low.Nc[f * 9 + 7];
          let Nz = w0 * low.Nc[f * 9 + 2] + w1 * low.Nc[f * 9 + 5] + w2 * low.Nc[f * 9 + 8];
          let nl = Math.hypot(Nx, Ny, Nz) || 1; Nx /= nl; Ny /= nl; Nz /= nl;
          // tangent orthonormalised against the interpolated normal
          let Tx = tfx - Nx * (Nx * tfx + Ny * tfy + Nz * tfz);
          let Ty = tfy - Ny * (Nx * tfx + Ny * tfy + Nz * tfz);
          let Tz = tfz - Nz * (Nx * tfx + Ny * tfy + Nz * tfz);
          let tl = Math.hypot(Tx, Ty, Tz) || 1; Tx /= tl; Ty /= tl; Tz /= tl;
          // bitangent
          let Bx = (Ny * Tz - Nz * Ty) * sgn, By = (Nz * Tx - Nx * Tz) * sgn, Bz = (Nx * Ty - Ny * Tx) * sgn;
          gP[o * 3] = Px; gP[o * 3 + 1] = Py; gP[o * 3 + 2] = Pz;
          gN[o * 3] = Nx; gN[o * 3 + 1] = Ny; gN[o * 3 + 2] = Nz;
          gT[o * 3] = Tx; gT[o * 3 + 1] = Ty; gT[o * 3 + 2] = Tz;
          gB[o * 3] = Bx; gB[o * 3 + 1] = By; gB[o * 3 + 2] = Bz;
          mask[o] = 1;
        }
      }
    }

    // outputs at supersampled res (RGB float 0..1)
    const oNrm = maps.normal ? new Float32Array(N * 3) : null;
    const oAO = maps.ao ? new Float32Array(N) : null;
    const oCurv = maps.curv ? new Float32Array(N) : null;
    const hemi = maps.ao ? hemisphere(aoSamples) : null;

    // ---- per-texel projection ----
    let done = 0;
    for (let o = 0; o < N; o++) {
      if (!mask[o]) continue;
      const Px = gP[o * 3], Py = gP[o * 3 + 1], Pz = gP[o * 3 + 2];
      const Nx = gN[o * 3], Ny = gN[o * 3 + 1], Nz = gN[o * 3 + 2];
      // cast from the cage down the inverted normal
      const ox = Px + Nx * cage, oy = Py + Ny * cage, oz = Pz + Nz * cage;
      const hit = rayClosest(bvh, ox, oy, oz, -Nx, -Ny, -Nz, cage * 2);
      if (hit) {
        const f = hit.f, u = hit.u, v = hit.v, w = 1 - u - v;
        const a = high.tris[f * 3], b = high.tris[f * 3 + 1], c = high.tris[f * 3 + 2];
        // interpolated high normal
        let Hx = w * high.nrm[a * 3] + u * high.nrm[b * 3] + v * high.nrm[c * 3];
        let Hy = w * high.nrm[a * 3 + 1] + u * high.nrm[b * 3 + 1] + v * high.nrm[c * 3 + 1];
        let Hz = w * high.nrm[a * 3 + 2] + u * high.nrm[b * 3 + 2] + v * high.nrm[c * 3 + 2];
        const hl = Math.hypot(Hx, Hy, Hz) || 1; Hx /= hl; Hy /= hl; Hz /= hl;
        if (oNrm) {
          const Tx = gT[o * 3], Ty = gT[o * 3 + 1], Tz = gT[o * 3 + 2];
          const Bx = gB[o * 3], By = gB[o * 3 + 1], Bz = gB[o * 3 + 2];
          let tnx = Hx * Tx + Hy * Ty + Hz * Tz;
          let tny = Hx * Bx + Hy * By + Hz * Bz;
          let tnz = Hx * Nx + Hy * Ny + Hz * Nz;
          const ln = Math.hypot(tnx, tny, tnz) || 1; tnx /= ln; tny /= ln; tnz /= ln;
          if (flipGreen) tny = -tny;
          oNrm[o * 3] = tnx * 0.5 + 0.5; oNrm[o * 3 + 1] = tny * 0.5 + 0.5; oNrm[o * 3 + 2] = tnz * 0.5 + 0.5;
        }
        if (oCurv) {
          const cu = w * high.curv[a] + u * high.curv[b] + v * high.curv[c];
          oCurv[o] = Math.max(0, Math.min(1, 0.5 + cu * (opts.curvScale || 6)));
        }
        if (oAO) {
          // hit point in world
          const hx = ox - Nx * hit.t, hy = oy - Ny * hit.t, hz = oz - Nz * hit.t;
          // TBN around the high normal
          let ux, uy, uz;
          if (Math.abs(Hx) > 0.9) { ux = 0; uy = 1; uz = 0; } else { ux = 1; uy = 0; uz = 0; }
          let tx = uy * Hz - uz * Hy, ty = uz * Hx - ux * Hz, tz = ux * Hy - uy * Hx;
          let tln = Math.hypot(tx, ty, tz) || 1; tx /= tln; ty /= tln; tz /= tln;
          const bx = Hy * tz - Hz * ty, by = Hz * tx - Hx * tz, bz = Hx * ty - Hy * tx;
          let occ = 0;
          for (let s = 0; s < aoSamples; s++) {
            const sx = hemi[s * 3], sy = hemi[s * 3 + 1], sz = hemi[s * 3 + 2];
            const dx = tx * sx + bx * sy + Hx * sz;
            const dy = ty * sx + by * sy + Hy * sz;
            const dz = tz * sx + bz * sy + Hz * sz;
            if (rayOccluded(bvh, hx + Hx * eps, hy + Hy * eps, hz + Hz * eps, dx, dy, dz, aoDist)) occ++;
          }
          oAO[o] = 1 - occ / aoSamples;
        }
      } else {
        if (oNrm) { oNrm[o * 3] = 0.5; oNrm[o * 3 + 1] = 0.5; oNrm[o * 3 + 2] = 1; }
        if (oAO) oAO[o] = 1;
        if (oCurv) oCurv[o] = 0.5;
      }
      if ((++done & 8191) === 0) prog('bake', 0.1 + 0.85 * done / N);
    }

    // ---- downsample (supersample box filter) + pack to RGBA + dilate ----
    function pack(src, chans, isNormal) {
      const out = new Uint8ClampedArray(res * res * 4);
      const dmask = new Uint8Array(res * res);
      for (let y = 0; y < res; y++) for (let x = 0; x < res; x++) {
        let r = 0, g = 0, b = 0, cnt = 0;
        for (let sy = 0; sy < ss; sy++) for (let sx = 0; sx < ss; sx++) {
          const so = (y * ss + sy) * W + (x * ss + sx);
          if (!mask[so]) continue;
          cnt++;
          if (chans === 3) { r += src[so * 3]; g += src[so * 3 + 1]; b += src[so * 3 + 2]; }
          else { r += src[so]; }
        }
        const o = (y * res + x) * 4;
        if (cnt) {
          dmask[y * res + x] = 1;
          if (chans === 3) {
            let rr = r / cnt, gg = g / cnt, bb = b / cnt;
            if (isNormal) { // renormalise averaged normals
              let nx = rr * 2 - 1, ny = gg * 2 - 1, nz = bb * 2 - 1;
              const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
              rr = nx * 0.5 + 0.5; gg = ny * 0.5 + 0.5; bb = nz * 0.5 + 0.5;
            }
            out[o] = rr * 255; out[o + 1] = gg * 255; out[o + 2] = bb * 255; out[o + 3] = 255;
          } else { const vv = (r / cnt) * 255; out[o] = vv; out[o + 1] = vv; out[o + 2] = vv; out[o + 3] = 255; }
        } else {
          // background fill (flat for normals, white for ao, mid for curv)
          if (isNormal) { out[o] = 128; out[o + 1] = 128; out[o + 2] = 255; }
          else if (chans === 1 && src === oAO) { out[o] = 255; out[o + 1] = 255; out[o + 2] = 255; }
          else { out[o] = 128; out[o + 1] = 128; out[o + 2] = 128; }
          out[o + 3] = 255;
        }
      }
      dilate(out, dmask, res, opts.dilate == null ? 4 : opts.dilate);
      return out;
    }
    // edge padding: grow valid pixels into the background to hide seams
    function dilate(buf, dm, size, passes) {
      const cur = dm.slice();
      for (let p = 0; p < passes; p++) {
        const next = cur.slice();
        for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
          if (cur[y * size + x]) continue;
          // nearest filled 4-neighbour
          let sx = -1, sy = -1;
          if (x > 0 && cur[y * size + x - 1]) { sx = x - 1; sy = y; }
          else if (x < size - 1 && cur[y * size + x + 1]) { sx = x + 1; sy = y; }
          else if (y > 0 && cur[(y - 1) * size + x]) { sx = x; sy = y - 1; }
          else if (y < size - 1 && cur[(y + 1) * size + x]) { sx = x; sy = y + 1; }
          if (sx >= 0) {
            const d = (y * size + x) * 4, s = (sy * size + sx) * 4;
            buf[d] = buf[s]; buf[d + 1] = buf[s + 1]; buf[d + 2] = buf[s + 2]; buf[d + 3] = 255;
            next[y * size + x] = 1;
          }
        }
        cur.set(next);
      }
    }

    prog('pack', 0.96);
    const result = { res };
    if (oNrm) result.normal = pack(oNrm, 3, true);
    if (oAO) result.ao = pack(oAO, 1, false);
    if (oCurv) result.curv = pack(oCurv, 1, false);
    prog('done', 1);
    return result;
  }

  /* ------------------------------------------------------------------ *
   *  Worker wiring (skipped under Node)
   * ------------------------------------------------------------------ */
  if (typeof global.postMessage === 'function' && typeof global.importScripts === 'function') {
    global.onmessage = function (e) {
      const msg = e.data;
      if (msg.type !== 'bake') return;
      try {
        const out = bake(msg.low, msg.high, msg.opts, function (phase, pct) {
          global.postMessage({ type: 'progress', phase, pct });
        });
        const transfer = [];
        if (out.normal) transfer.push(out.normal.buffer);
        if (out.ao) transfer.push(out.ao.buffer);
        if (out.curv) transfer.push(out.curv.buffer);
        global.postMessage({ type: 'done', res: out.res, normal: out.normal, ao: out.ao, curv: out.curv }, transfer);
      } catch (err) {
        global.postMessage({ type: 'error', message: (err && err.message) || String(err) });
      }
    };
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { parseOBJ, buildHigh, buildLow, buildBVH, rayClosest, rayOccluded, hemisphere, bake };
  }
})(typeof self !== 'undefined' ? self : this);
