const vertex = `
attribute vec2 aPosition;
varying vec2 vUv;
void main() {
  vUv = vec2(aPosition.x * 0.5 + 0.5, 0.5 - aPosition.y * 0.5);
  gl_Position = vec4(aPosition, 0.0, 1.0);
}`;

const fragment = `
precision highp float;
varying vec2 vUv;
uniform sampler2D uCloud;
uniform sampler2D uNoise;
uniform vec3 uPointer;
uniform float uAspect;
uniform float uSway;
uniform float uPixel;
uniform float uTime;

float cloudBank(vec2 p, float start, float height, float size, float phase, float turn) {
  float x = start * uAspect + uSway * uPixel;
  float rise = 0.012 * sin(uTime * 0.20 + phase);
  // Rotate the tall source mask into a cloud bank without stretching it.
  vec2 local = (p - vec2(x, height + rise)) / size;
  mat2 orientation = mat2(0.5, 0.8660254 * turn, -0.8660254 * turn, 0.5);
  vec2 uv = orientation * local + 0.5;

  vec2 noiseUv = uv * 0.72 + vec2(sin(uTime * 0.15 + phase), cos(uTime * 0.12)) * 0.14;
  vec2 billow = vec2(texture2D(uNoise, noiseUv).r,
                     texture2D(uNoise, noiseUv + vec2(0.41, 0.67)).r) - 0.5;
  uv += billow * 0.095;

  vec2 edge = smoothstep(vec2(0.0), vec2(0.12), uv) *
              (1.0 - smoothstep(vec2(0.88), vec2(1.0), uv));
  return smoothstep(0.04, 0.99, texture2D(uCloud, uv).r) * edge.x * edge.y;
}

void main() {
  vec2 p = vec2(vUv.x * uAspect, vUv.y);
  vec2 offset = p - vec2(uPointer.x * uAspect, uPointer.y);
  float radius = 145.0 * uPixel;
  float influence = 1.0 - smoothstep(radius * 0.16, radius, length(offset));
  // Bend only the cloud texture inside the cursor's footprint.
  vec2 swirl = vec2(-offset.y, offset.x);
  p += (offset * -0.16 + swirl * 0.045) * influence * uPointer.z;
  float wide = smoothstep(0.50, 1.02, uAspect);
  float bankSize = sqrt(max(0.99, uAspect * 1.23)) * mix(0.82, 1.0, wide);
  float high = cloudBank(p, mix(0.37, 0.26, wide), 0.13, bankSize * 1.10, 0.8, 1.0);
  float low = cloudBank(p, mix(0.72, 0.88, wide), 0.98, bankSize * 1.13, 2.2, -1.0);
  float density = 1.0 - (1.0 - high * 0.49) * (1.0 - low * 0.56);
  gl_FragColor = vec4(0.75, 0.92, 1.0, density);
}`;

function programFor(gl) {
  const program = gl.createProgram();
  for (const [type, source] of [
    [gl.VERTEX_SHADER, vertex],
    [gl.FRAGMENT_SHADER, fragment],
  ]) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    gl.attachShader(program, shader);
    gl.deleteShader(shader);
  }
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS))
    throw new Error(gl.getProgramInfoLog(program));
  gl.useProgram(program);
  return program;
}

async function loadTexture(gl, url, unit, repeat) {
  let img;
  if (typeof Image === 'function') {
    img = new Image();
    img.src = url;
    await img.decode();
  } else {
    const response = await fetch(url);
    if (!response.ok) throw new Error('Cloud texture unavailable');
    img = await createImageBitmap(await response.blob(), { premultiplyAlpha: 'none' });
  }
  gl.activeTexture(gl.TEXTURE0 + unit);
  gl.bindTexture(gl.TEXTURE_2D, gl.createTexture());
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
  img.close?.();
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, repeat ? gl.REPEAT : gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, repeat ? gl.REPEAT : gl.CLAMP_TO_EDGE);
}

export async function createCloudRenderer(canvas) {
  const gl = canvas.getContext('webgl', {
    alpha: true,
    antialias: false,
    premultipliedAlpha: false,
  });
  if (!gl) throw new Error('WebGL unavailable');
  const program = programFor(gl);
  await Promise.all([
    loadTexture(gl, '/showcase/locker/clouds/bella-cloud.jpg', 0, false),
    loadTexture(gl, '/showcase/locker/clouds/bella-noise.png', 1, true),
  ]);
  if (gl.isContextLost()) throw new Error('Cloud context lost');

  gl.uniform1i(gl.getUniformLocation(program, 'uCloud'), 0);
  gl.uniform1i(gl.getUniformLocation(program, 'uNoise'), 1);
  const time = gl.getUniformLocation(program, 'uTime');
  const pointer = gl.getUniformLocation(program, 'uPointer');
  const aspect = gl.getUniformLocation(program, 'uAspect');
  const pixel = gl.getUniformLocation(program, 'uPixel');
  const sway = gl.getUniformLocation(program, 'uSway');
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const position = gl.getAttribLocation(program, 'aPosition');
  gl.enableVertexAttribArray(position);
  gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);

  let lastWidth = 0;
  let lastHeight = 0;
  return {
    paint({ width, height, seconds, offset, x, y, strength }) {
      if (width !== lastWidth || height !== lastHeight) {
        lastWidth = width;
        lastHeight = height;
        const scale = Math.min(0.8, 960 / Math.max(width, height));
        canvas.width = Math.max(1, Math.round(width * scale));
        canvas.height = Math.max(1, Math.round(height * scale));
        gl.viewport(0, 0, canvas.width, canvas.height);
        gl.uniform1f(aspect, width / height);
        gl.uniform1f(pixel, 1 / height);
      }
      gl.uniform1f(time, seconds);
      gl.uniform1f(sway, offset);
      gl.uniform3f(pointer, x, y, strength);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    },
  };
}
