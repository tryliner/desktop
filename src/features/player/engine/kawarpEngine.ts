/**
 * Kawarp WebGL fluid animated background engine.
 *
 * Implements multi-pass Kawase blur and domain warping with zero glitches:
 * - Direct FBO dimension tracking to prevent viewport/quadrant scaling bugs
 * - Instant blur on first frame without black buffer crossfade
 * - Robust CORS and blob/imageBitmap loading
 */

const BLUR_SIZE = 160;

const VERTEX_SHADER = `
  attribute vec2 a_position;
  attribute vec2 a_texCoord;
  varying vec2 v_texCoord;
  void main() {
    gl_Position = vec4(a_position, 0.0, 1.0);
    v_texCoord = a_texCoord;
  }
`;

const KAWASE_BLUR_SHADER = `
  precision highp float;
  uniform sampler2D u_texture;
  uniform vec2 u_resolution;
  uniform float u_offset;
  varying vec2 v_texCoord;

  void main() {
    highp vec2 texelSize = 1.0 / u_resolution;
    highp vec4 color = vec4(0.0);

    color += texture2D(u_texture, v_texCoord + vec2(-u_offset, -u_offset) * texelSize);
    color += texture2D(u_texture, v_texCoord + vec2(u_offset, -u_offset) * texelSize);
    color += texture2D(u_texture, v_texCoord + vec2(-u_offset, u_offset) * texelSize);
    color += texture2D(u_texture, v_texCoord + vec2(u_offset, u_offset) * texelSize);

    gl_FragColor = color * 0.25;
  }
`;

const BLEND_SHADER = `
  precision highp float;
  uniform sampler2D u_texture1;
  uniform sampler2D u_texture2;
  uniform float u_blend;
  varying vec2 v_texCoord;

  void main() {
    vec4 color1 = texture2D(u_texture1, v_texCoord);
    vec4 color2 = texture2D(u_texture2, v_texCoord);
    gl_FragColor = mix(color1, color2, u_blend);
  }
`;

const TINT_SHADER = `
  precision highp float;
  uniform sampler2D u_texture;
  uniform vec3 u_tintColor;
  uniform float u_tintIntensity;
  varying vec2 v_texCoord;

  void main() {
    vec4 color = texture2D(u_texture, v_texCoord);
    float luma = dot(color.rgb, vec3(0.299, 0.587, 0.114));
    float darkMask = 1.0 - smoothstep(0.0, 0.5, luma);
    color.rgb = mix(color.rgb, u_tintColor, darkMask * u_tintIntensity);
    gl_FragColor = color;
  }
`;

const DOMAIN_WARP_SHADER = `
  precision highp float;
  uniform sampler2D u_texture;
  uniform float u_time;
  uniform float u_intensity;
  varying vec2 v_texCoord;

  vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec2 mod289(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec3 permute(vec3 x) { return mod289(((x*34.0)+1.0)*x); }

  float snoise(vec2 v) {
    const vec4 C = vec4(0.211324865405187, 0.366025403784439,
                        -0.577350269189626, 0.024390243902439);
    vec2 i  = floor(v + dot(v, C.yy));
    vec2 x0 = v - i + dot(i, C.xx);
    vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
    vec4 x12 = x0.xyxy + C.xxzz;
    x12.xy -= i1;
    i = mod289(i);
    vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
    vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
    m = m*m; m = m*m;
    vec3 x = 2.0 * fract(p * C.www) - 1.0;
    vec3 h = abs(x) - 0.5;
    vec3 ox = floor(x + 0.5);
    vec3 a0 = x - ox;
    m *= 1.79284291400159 - 0.85373472095314 * (a0*a0 + h*h);
    vec3 g;
    g.x = a0.x * x0.x + h.x * x0.y;
    g.yz = a0.yz * x12.xz + h.yz * x12.yw;
    return 130.0 * dot(m, g);
  }

  void main() {
    vec2 uv = v_texCoord;
    float t = u_time * 0.08;

    // Multi-octave organic fluid domain warp
    vec2 q = vec2(
      snoise(uv * 0.5 + vec2(t * 0.6, t * 0.4)),
      snoise(uv * 0.5 + vec2(-t * 0.5, t * 0.7) + vec2(43.12, 17.89))
    );

    vec2 r = vec2(
      snoise(uv * 1.1 + q * 0.7 + vec2(t * 0.9, -t * 0.7)),
      snoise(uv * 1.1 + q * 0.7 + vec2(-t * 0.6, t * 1.0) + vec2(92.41, 61.27))
    );

    vec2 warp = (q * 0.6 + r * 0.4);
    vec2 warpedUV = uv + warp * (u_intensity * 0.28);
    warpedUV = clamp(warpedUV, 0.0, 1.0);

    gl_FragColor = texture2D(u_texture, warpedUV);
  }
`;

const OUTPUT_SHADER = `
  precision highp float;
  uniform sampler2D u_texture;
  uniform float u_saturation;
  uniform float u_dithering;
  uniform float u_time;
  uniform float u_scale;
  uniform vec2 u_resolution;
  varying vec2 v_texCoord;

  highp float hash(highp vec3 p) {
    p = fract(p * 0.1031);
    p += dot(p, p.zyx + 31.32);
    return fract((p.x + p.y) * p.z);
  }

  void main() {
    vec2 uv = (v_texCoord - 0.5) / u_scale + 0.5;
    uv = clamp(uv, 0.0, 1.0);

    vec4 color = texture2D(u_texture, uv);

    vec2 center = v_texCoord - 0.5;
    float vignette = 1.0 - dot(center, center) * 0.3;
    color.rgb *= vignette;

    float gray = dot(color.rgb, vec3(0.299, 0.587, 0.114));
    color.rgb = mix(vec3(gray), color.rgb, u_saturation);

    highp vec2 pixelPos = floor(v_texCoord * u_resolution);
    highp float noise = hash(vec3(pixelPos, floor(u_time * 60.0)));
    color.rgb += (noise - 0.5) * u_dithering;

    gl_FragColor = color;
  }
`;

interface FboInfo {
  framebuffer: WebGLFramebuffer;
  texture: WebGLTexture;
  width: number;
  height: number;
}

export interface KawarpOptions {
  warpIntensity?: number;
  blurPasses?: number;
  animationSpeed?: number;
  transitionDuration?: number;
  saturation?: number;
  tintColor?: [number, number, number];
  tintIntensity?: number;
  dithering?: number;
  scale?: number;
}

export class KawarpEngine {
  private gl: WebGLRenderingContext;
  private halfFloatExt: any = null;
  private halfFloatLinearExt: any = null;

  private blurProgram: WebGLProgram;
  private blendProgram: WebGLProgram;
  private tintProgram: WebGLProgram;
  private warpProgram: WebGLProgram;
  private outputProgram: WebGLProgram;

  private positionBuffer: WebGLBuffer;
  private texCoordBuffer: WebGLBuffer;
  private sourceTexture: WebGLTexture;

  private blurFBO1: FboInfo;
  private blurFBO2: FboInfo;
  private currentAlbumFBO: FboInfo;
  private nextAlbumFBO: FboInfo;
  private warpFBO: FboInfo;

  private animationId: number | null = null;
  private lastFrameTime = 0;
  private accumulatedTime = 0;
  private isPlaying = false;

  private isTransitioning = false;
  private transitionStartTime = 0;
  private transitionDuration = 1000;

  private warpIntensity = 1.1;
  private blurPasses = 8;
  private animationSpeed = 1.0;
  private saturation = 1.4;
  private tintColor: [number, number, number] = [0.157, 0.157, 0.235];
  private tintIntensity = 0.15;
  private dithering = 0.012;
  private scale = 1.2;
  private hasImage = false;

  private attribs: { position: number; texCoord: number };
  private uniforms: any;

  constructor(private readonly canvas: HTMLCanvasElement, options: KawarpOptions = {}) {
    const gl = canvas.getContext('webgl', {
      alpha: false,
      antialias: false,
      depth: false,
      stencil: false,
      preserveDrawingBuffer: false,
      powerPreference: 'high-performance',
    });
    if (!gl) throw new Error('WebGL not supported');
    this.gl = gl;

    this.halfFloatExt = gl.getExtension('OES_texture_half_float');
    this.halfFloatLinearExt = gl.getExtension('OES_texture_half_float_linear');

    if (options.warpIntensity !== undefined) this.warpIntensity = options.warpIntensity;
    if (options.blurPasses !== undefined) this.blurPasses = options.blurPasses;
    if (options.animationSpeed !== undefined) this.animationSpeed = options.animationSpeed;
    if (options.transitionDuration !== undefined) this.transitionDuration = options.transitionDuration;
    if (options.saturation !== undefined) this.saturation = options.saturation;
    if (options.tintColor !== undefined) this.tintColor = options.tintColor;
    if (options.tintIntensity !== undefined) this.tintIntensity = options.tintIntensity;
    if (options.dithering !== undefined) this.dithering = options.dithering;
    if (options.scale !== undefined) this.scale = options.scale;

    this.blurProgram = this.createProgram(VERTEX_SHADER, KAWASE_BLUR_SHADER);
    this.blendProgram = this.createProgram(VERTEX_SHADER, BLEND_SHADER);
    this.tintProgram = this.createProgram(VERTEX_SHADER, TINT_SHADER);
    this.warpProgram = this.createProgram(VERTEX_SHADER, DOMAIN_WARP_SHADER);
    this.outputProgram = this.createProgram(VERTEX_SHADER, OUTPUT_SHADER);

    this.attribs = {
      position: gl.getAttribLocation(this.blurProgram, 'a_position'),
      texCoord: gl.getAttribLocation(this.blurProgram, 'a_texCoord'),
    };

    this.uniforms = {
      blur: {
        resolution: gl.getUniformLocation(this.blurProgram, 'u_resolution'),
        texture: gl.getUniformLocation(this.blurProgram, 'u_texture'),
        offset: gl.getUniformLocation(this.blurProgram, 'u_offset'),
      },
      blend: {
        texture1: gl.getUniformLocation(this.blendProgram, 'u_texture1'),
        texture2: gl.getUniformLocation(this.blendProgram, 'u_texture2'),
        blend: gl.getUniformLocation(this.blendProgram, 'u_blend'),
      },
      warp: {
        texture: gl.getUniformLocation(this.warpProgram, 'u_texture'),
        time: gl.getUniformLocation(this.warpProgram, 'u_time'),
        intensity: gl.getUniformLocation(this.warpProgram, 'u_intensity'),
      },
      tint: {
        texture: gl.getUniformLocation(this.tintProgram, 'u_texture'),
        tintColor: gl.getUniformLocation(this.tintProgram, 'u_tintColor'),
        tintIntensity: gl.getUniformLocation(this.tintProgram, 'u_tintIntensity'),
      },
      output: {
        texture: gl.getUniformLocation(this.outputProgram, 'u_texture'),
        saturation: gl.getUniformLocation(this.outputProgram, 'u_saturation'),
        dithering: gl.getUniformLocation(this.outputProgram, 'u_dithering'),
        time: gl.getUniformLocation(this.outputProgram, 'u_time'),
        scale: gl.getUniformLocation(this.outputProgram, 'u_scale'),
        resolution: gl.getUniformLocation(this.outputProgram, 'u_resolution'),
      },
    };

    this.positionBuffer = this.createBuffer(new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]));
    this.texCoordBuffer = this.createBuffer(new Float32Array([0, 0, 1, 0, 0, 1, 0, 1, 1, 0, 1, 1]));

    this.sourceTexture = this.createTexture();
    this.blurFBO1 = this.createFramebuffer(BLUR_SIZE, BLUR_SIZE, true);
    this.blurFBO2 = this.createFramebuffer(BLUR_SIZE, BLUR_SIZE, true);
    this.currentAlbumFBO = this.createFramebuffer(BLUR_SIZE, BLUR_SIZE, true);
    this.nextAlbumFBO = this.createFramebuffer(BLUR_SIZE, BLUR_SIZE, true);

    const initW = Math.max(1, canvas.width || 640);
    const initH = Math.max(1, canvas.height || 360);
    this.warpFBO = this.createFramebuffer(initW, initH, true);
  }

  public resize() {
    const width = Math.max(1, this.canvas.width);
    const height = Math.max(1, this.canvas.height);
    if (this.warpFBO.width !== width || this.warpFBO.height !== height) {
      this.deleteFramebuffer(this.warpFBO);
      this.warpFBO = this.createFramebuffer(width, height, true);
    }
  }

  public async loadImage(src: string, preDecoded?: HTMLImageElement): Promise<void> {
    if (!src) return;

    let bitmap: ImageBitmap | HTMLImageElement | null =
      preDecoded && preDecoded.complete && preDecoded.naturalWidth > 0 ? preDecoded : null;

    if (!bitmap) {
      try {
        const res = await fetch(src, { mode: 'cors' });
        if (res.ok) {
          const blob = await res.blob();
          bitmap = await createImageBitmap(blob);
        }
      } catch {
      }
    }

    if (!bitmap) {
      bitmap = await new Promise<HTMLImageElement>((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error(`Failed to load image: ${src}`));
        img.src = src;
      });
    }

    const gl = this.gl;
    gl.bindTexture(gl.TEXTURE_2D, this.sourceTexture);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 0);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, bitmap);
    if ('close' in bitmap && typeof (bitmap as ImageBitmap).close === 'function') {
      (bitmap as ImageBitmap).close();
    }

    this.processNewImage();
  }

  private processNewImage() {
    if (!this.hasImage) {
      // First image ever loaded: blur immediately into nextAlbumFBO AND currentAlbumFBO
      this.blurSourceInto(this.nextAlbumFBO);
      this.blurSourceInto(this.currentAlbumFBO);
      this.hasImage = true;
      this.isTransitioning = false;
      return;
    }

    // Subsequent images: swap FBOs and smoothly crossfade over transitionDuration
    const temp = this.currentAlbumFBO;
    this.currentAlbumFBO = this.nextAlbumFBO;
    this.nextAlbumFBO = temp;

    this.blurSourceInto(this.nextAlbumFBO);
    this.isTransitioning = true;
    this.transitionStartTime = performance.now();
  }

  private blurSourceInto(targetFBO: FboInfo) {
    const gl = this.gl;

    // 1. Tint source texture -> blurFBO1
    gl.useProgram(this.tintProgram);
    this.setupAttributes();
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.blurFBO1.framebuffer);
    gl.viewport(0, 0, BLUR_SIZE, BLUR_SIZE);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.sourceTexture);
    gl.uniform1i(this.uniforms.tint.texture, 0);
    gl.uniform3fv(this.uniforms.tint.tintColor, this.tintColor);
    gl.uniform1f(this.uniforms.tint.tintIntensity, this.tintIntensity);
    gl.drawArrays(gl.TRIANGLES, 0, 6);

    // 2. Kawase blur passes
    gl.useProgram(this.blurProgram);
    this.setupAttributes();
    gl.uniform2f(this.uniforms.blur.resolution, BLUR_SIZE, BLUR_SIZE);
    gl.uniform1i(this.uniforms.blur.texture, 0);

    let readFBO = this.blurFBO1;
    let writeFBO = this.blurFBO2;

    for (let i = 0; i < this.blurPasses; i++) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, writeFBO.framebuffer);
      gl.viewport(0, 0, BLUR_SIZE, BLUR_SIZE);
      gl.bindTexture(gl.TEXTURE_2D, readFBO.texture);
      gl.uniform1f(this.uniforms.blur.offset, i + 0.5);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
      const temp = readFBO;
      readFBO = writeFBO;
      writeFBO = temp;
    }

    // 3. Copy final blur to target FBO
    gl.bindFramebuffer(gl.FRAMEBUFFER, targetFBO.framebuffer);
    gl.viewport(0, 0, BLUR_SIZE, BLUR_SIZE);
    gl.bindTexture(gl.TEXTURE_2D, readFBO.texture);
    gl.uniform1f(this.uniforms.blur.offset, 0.0);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }

  public start() {
    if (this.isPlaying) return;
    this.isPlaying = true;
    this.lastFrameTime = performance.now();
    this.animationId = requestAnimationFrame(this.renderLoop);
  }

  public stop() {
    this.isPlaying = false;
    if (this.animationId !== null) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
  }

  private renderLoop = (timestamp: number) => {
    if (!this.isPlaying) return;
    const dt = (timestamp - this.lastFrameTime) / 1000;
    this.lastFrameTime = timestamp;
    this.accumulatedTime += dt * this.animationSpeed;
    this.render(this.accumulatedTime, timestamp);
    this.animationId = requestAnimationFrame(this.renderLoop);
  };

  private render(time: number, timestamp: number = performance.now()) {
    if (!this.hasImage) return;

    const gl = this.gl;
    const width = Math.max(1, this.canvas.width);
    const height = Math.max(1, this.canvas.height);

    // ensure warpFBO matches canvas resolution on every frame without glitching
    if (this.warpFBO.width !== width || this.warpFBO.height !== height) {
      this.deleteFramebuffer(this.warpFBO);
      this.warpFBO = this.createFramebuffer(width, height, true);
    }

    let blendFactor = 1.0;
    if (this.isTransitioning) {
      const elapsed = timestamp - this.transitionStartTime;
      blendFactor = Math.min(1.0, elapsed / this.transitionDuration);
      if (blendFactor >= 1.0) {
        this.isTransitioning = false;
      }
    }

    let currentTexture: WebGLTexture;

    if (this.isTransitioning && blendFactor < 1.0) {
      // Smooth crossfade between previous and next album FBOs
      gl.useProgram(this.blendProgram);
      this.setupAttributes();
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.blurFBO1.framebuffer);
      gl.viewport(0, 0, BLUR_SIZE, BLUR_SIZE);

      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, this.currentAlbumFBO.texture);
      gl.uniform1i(this.uniforms.blend.texture1, 0);

      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, this.nextAlbumFBO.texture);
      gl.uniform1i(this.uniforms.blend.texture2, 1);

      // Smooth cosine easing
      const easedBlend = 0.5 - 0.5 * Math.cos(blendFactor * Math.PI);
      gl.uniform1f(this.uniforms.blend.blend, easedBlend);
      gl.drawArrays(gl.TRIANGLES, 0, 6);

      currentTexture = this.blurFBO1.texture;
    } else {
      currentTexture = this.nextAlbumFBO.texture;
    }

    // Warp upscales to warpFBO
    gl.useProgram(this.warpProgram);
    this.setupAttributes();
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.warpFBO.framebuffer);
    gl.viewport(0, 0, width, height);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, currentTexture);
    gl.uniform1i(this.uniforms.warp.texture, 0);
    gl.uniform1f(this.uniforms.warp.time, time);
    gl.uniform1f(this.uniforms.warp.intensity, this.warpIntensity);
    gl.drawArrays(gl.TRIANGLES, 0, 6);

    // Final output to canvas
    gl.useProgram(this.outputProgram);
    this.setupAttributes();
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, width, height);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.warpFBO.texture);
    gl.uniform1i(this.uniforms.output.texture, 0);
    gl.uniform1f(this.uniforms.output.saturation, this.saturation);
    gl.uniform1f(this.uniforms.output.dithering, this.dithering);
    gl.uniform1f(this.uniforms.output.time, time);
    gl.uniform1f(this.uniforms.output.scale, this.scale);
    gl.uniform2f(this.uniforms.output.resolution, width, height);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }

  private setupAttributes() {
    const gl = this.gl;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
    gl.enableVertexAttribArray(this.attribs.position);
    gl.vertexAttribPointer(this.attribs.position, 2, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.texCoordBuffer);
    gl.enableVertexAttribArray(this.attribs.texCoord);
    gl.vertexAttribPointer(this.attribs.texCoord, 2, gl.FLOAT, false, 0, 0);
  }

  private createShader(type: number, source: string): WebGLShader {
    const gl = this.gl;
    const shader = gl.createShader(type);
    if (!shader) throw new Error('Failed to create shader');
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const error = gl.getShaderInfoLog(shader);
      gl.deleteShader(shader);
      throw new Error(`Shader compile error: ${error}`);
    }
    return shader;
  }

  private createProgram(vertexSource: string, fragmentSource: string): WebGLProgram {
    const gl = this.gl;
    const vs = this.createShader(gl.VERTEX_SHADER, vertexSource);
    const fs = this.createShader(gl.FRAGMENT_SHADER, fragmentSource);
    const program = gl.createProgram();
    if (!program) throw new Error('Failed to create program');
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      const error = gl.getProgramInfoLog(program);
      gl.deleteProgram(program);
      throw new Error(`Program link error: ${error}`);
    }
    gl.deleteShader(vs);
    gl.deleteShader(fs);
    return program;
  }

  private createBuffer(data: Float32Array): WebGLBuffer {
    const gl = this.gl;
    const buffer = gl.createBuffer();
    if (!buffer) throw new Error('Failed to create buffer');
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
    return buffer;
  }

  private createTexture(): WebGLTexture {
    const gl = this.gl;
    const texture = gl.createTexture();
    if (!texture) throw new Error('Failed to create texture');
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    return texture;
  }

  private createFramebuffer(width: number, height: number, useHighPrecision: boolean = false): FboInfo {
    const gl = this.gl;
    const texture = this.createTexture();
    const canUseHalfFloat = useHighPrecision && this.halfFloatExt && this.halfFloatLinearExt;
    const type = canUseHalfFloat ? this.halfFloatExt.HALF_FLOAT_OES : gl.UNSIGNED_BYTE;

    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, type, null);
    const framebuffer = gl.createFramebuffer();
    if (!framebuffer) throw new Error('Failed to create framebuffer');
    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);

    return { framebuffer, texture, width, height };
  }

  private deleteFramebuffer(fbo: FboInfo) {
    this.gl.deleteFramebuffer(fbo.framebuffer);
    this.gl.deleteTexture(fbo.texture);
  }

  public dispose() {
    this.stop();
    const gl = this.gl;
    gl.deleteProgram(this.blurProgram);
    gl.deleteProgram(this.blendProgram);
    gl.deleteProgram(this.tintProgram);
    gl.deleteProgram(this.warpProgram);
    gl.deleteProgram(this.outputProgram);
    gl.deleteBuffer(this.positionBuffer);
    gl.deleteBuffer(this.texCoordBuffer);
    gl.deleteTexture(this.sourceTexture);
    this.deleteFramebuffer(this.blurFBO1);
    this.deleteFramebuffer(this.blurFBO2);
    this.deleteFramebuffer(this.currentAlbumFBO);
    this.deleteFramebuffer(this.nextAlbumFBO);
    this.deleteFramebuffer(this.warpFBO);
  }
}
