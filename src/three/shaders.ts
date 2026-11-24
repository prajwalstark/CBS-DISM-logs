// Custom GLSL used by the diagnostic scenes.

const NOISE = /* glsl */ `
vec3 mod289(vec3 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 mod289(vec4 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 permute(vec4 x){return mod289(((x*34.0)+1.0)*x);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-0.85373472095314*r;}
float snoise(vec3 v){
  const vec2 C=vec2(1.0/6.0,1.0/3.0);const vec4 D=vec4(0.0,0.5,1.0,2.0);
  vec3 i=floor(v+dot(v,C.yyy));vec3 x0=v-i+dot(i,C.xxx);
  vec3 g=step(x0.yzx,x0.xyz);vec3 l=1.0-g;vec3 i1=min(g.xyz,l.zxy);vec3 i2=max(g.xyz,l.zxy);
  vec3 x1=x0-i1+C.xxx;vec3 x2=x0-i2+C.yyy;vec3 x3=x0-D.yyy;i=mod289(i);
  vec4 p=permute(permute(permute(i.z+vec4(0.0,i1.z,i2.z,1.0))+i.y+vec4(0.0,i1.y,i2.y,1.0))+i.x+vec4(0.0,i1.x,i2.x,1.0));
  float n_=0.142857142857;vec3 ns=n_*D.wyz-D.xzx;vec4 j=p-49.0*floor(p*ns.z*ns.z);
  vec4 x_=floor(j*ns.z);vec4 y_=floor(j-7.0*x_);vec4 x=x_*ns.x+ns.yyyy;vec4 y=y_*ns.x+ns.yyyy;vec4 h=1.0-abs(x)-abs(y);
  vec4 b0=vec4(x.xy,y.xy);vec4 b1=vec4(x.zw,y.zw);vec4 s0=floor(b0)*2.0+1.0;vec4 s1=floor(b1)*2.0+1.0;vec4 sh=-step(h,vec4(0.0));
  vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy;vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
  vec3 p0=vec3(a0.xy,h.x);vec3 p1=vec3(a0.zw,h.y);vec3 p2=vec3(a1.xy,h.z);vec3 p3=vec3(a1.zw,h.w);
  vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));p0*=norm.x;p1*=norm.y;p2*=norm.z;p3*=norm.w;
  vec4 m=max(0.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.0);m=m*m;
  return 42.0*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
}`;

/**
 * System core: noise-displaced sphere. Displacement amplitude ("uUnrest") and
 * colour come from overall health, so a sick system visibly churns.
 */
export const coreShader = {
  vertex: /* glsl */ `
    uniform float uTime; uniform float uUnrest;
    varying vec3 vNormal; varying vec3 vView; varying float vNoise;
    ${NOISE}
    void main(){
      float n = snoise(normal * 1.6 + vec3(uTime * 0.35));
      float n2 = snoise(normal * 4.0 - vec3(uTime * 0.6)) * 0.35;
      vNoise = n + n2;
      vec3 p = position + normal * (vNoise * (0.05 + uUnrest * 0.22));
      vec4 mv = modelViewMatrix * vec4(p, 1.0);
      vNormal = normalize(normalMatrix * normal);
      vView = normalize(-mv.xyz);
      gl_Position = projectionMatrix * mv;
    }`,
  fragment: /* glsl */ `
    uniform vec3 uColor; uniform vec3 uColor2; uniform float uTime; uniform float uIntensity;
    varying vec3 vNormal; varying vec3 vView; varying float vNoise;
    void main(){
      float fres = pow(1.0 - max(dot(vNormal, vView), 0.0), 2.2);
      float bands = smoothstep(0.35, 0.5, fract(vNoise * 3.0 + uTime * 0.15)) * 0.25;
      vec3 col = mix(uColor2 * 0.25, uColor, fres + bands);
      col += uColor * fres * uIntensity;
      gl_FragColor = vec4(col, 0.35 + fres * 0.65);
    }`,
};

/** Infinite-looking holographic floor grid with radial fade and scan pulse. */
export const gridShader = {
  vertex: /* glsl */ `
    varying vec2 vUv; varying vec3 vWorld;
    void main(){ vUv = uv; vec4 w = modelMatrix * vec4(position,1.0); vWorld = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
  fragment: /* glsl */ `
    uniform vec3 uColor; uniform float uTime; uniform float uPulse;
    varying vec3 vWorld;
    float line(float v, float w){ float d = abs(fract(v - 0.5) - 0.5) / fwidth(v); return 1.0 - min(d / w, 1.0); }
    void main(){
      vec2 p = vWorld.xz;
      float g = max(line(p.x, 1.0), line(p.y, 1.0)) * 0.35 + max(line(p.x / 5.0, 1.2), line(p.y / 5.0, 1.2)) * 0.6;
      float r = length(p);
      float fade = smoothstep(26.0, 4.0, r);
      float ring = smoothstep(0.6, 0.0, abs(r - mod(uTime * 4.0, 30.0))) * uPulse;
      vec3 col = uColor * (g + ring * 0.8);
      gl_FragColor = vec4(col, (g * 0.5 + ring * 0.4) * fade);
    }`,
};

/** Data stream along a tube: travelling dashes, speed/density from data volume. */
export const flowShader = {
  vertex: /* glsl */ `
    varying vec2 vUv;
    void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
  fragment: /* glsl */ `
    uniform vec3 uColor; uniform float uTime; uniform float uSpeed; uniform float uDensity; uniform float uOpacity;
    varying vec2 vUv;
    void main(){
      float t = fract(vUv.x * uDensity - uTime * uSpeed);
      float dash = smoothstep(0.0, 0.08, t) * smoothstep(0.35, 0.12, t);
      float edge = 1.0 - abs(vUv.y - 0.5) * 2.0;
      float base = 0.18;
      vec3 col = uColor * (base + dash * 2.2);
      gl_FragColor = vec4(col, (base + dash) * edge * uOpacity);
    }`,
};
