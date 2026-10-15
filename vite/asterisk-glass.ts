import type { Plugin } from "vite";

const SHAPE_FNS = `
float capSDF(vec2 p, float halfLen, float rad) {
	p.x = abs(p.x);
	return length(vec2(max(p.x - halfLen, 0.0), p.y)) - rad;
}

float rectSDF(vec2 p, vec2 halfExt) {
	vec2 q = abs(p) - halfExt;
	return length(max(q, vec2(0.0))) + min(max(q.x, q.y), 0.0);
}

// MetFix mark, matching the menu icon's open state.
// box is half the badge. Bar length 0.727 and thickness 0.091 are
// fractions of the full badge, so they are doubled here.
float shapeSDF(vec2 p, vec2 b, float rad) {
	if (u_shape < 0.5) return rrSDF(p, b, rad);
	float box = min(b.x, b.y);
	float halfThick = box * 0.091;
	float halfBar = box * 0.727;
	vec2 ext = vec2(halfBar, halfThick);
	float d = rectSDF(p, ext);
	float s = 0.70710678;
	vec2 pr = vec2(s * (p.x - p.y), s * (p.x + p.y));
	d = min(d, rectSDF(pr, ext));
	d = min(d, rectSDF(vec2(pr.y, -pr.x), ext));
	// Short downward stem. Its top sits on the center of the cross.
	d = min(d, rectSDF(p - vec2(0.0, box * 0.363), vec2(halfThick, box * 0.364)));
	// Detached top prong: a vertical pill, not joined to the cross.
	vec2 pill = p - vec2(0.0, box * -0.454);
	d = min(d, capSDF(vec2(pill.y, pill.x), box * 0.091, halfThick));
	return d;
}
`;

/**
 * Teaches @ybouane/liquidglass a second SDF: glass elements with `data-config='{"shape":1}'`
 * render as the MetFix asterisk instead of a rounded rect. The package must stay out of
 * `optimizeDeps` so this transform also runs in dev.
 */
export function asteriskGlass(): Plugin {
  return {
    name: "asterisk-glass",
    enforce: "pre",
    transform(code, id) {
      if (!id.includes("@ybouane/liquidglass") || !id.includes("index.js")) return;
      if (!code.includes("float rrSDF") || code.includes("uniform float u_shape")) return;
      let next = code.replaceAll("rrSDF(", "shapeSDF(");
      next = next.replace("float shapeSDF(vec2 p, vec2 b, float r)", "float rrSDF(vec2 p, vec2 b, float r)");
      next = next.replace("uniform float u_bevelMode;", "uniform float u_bevelMode;\nuniform float u_shape;");
      next = next.replace(
        "return min(max(q.x, q.y), 0.0) + length(max(q, vec2(0.0))) - r;\n}",
        "return min(max(q.x, q.y), 0.0) + length(max(q, vec2(0.0))) - r;\n}\n" + SHAPE_FNS,
      );
      next = next.replace('"u_bevelMode"\n    ]);', '"u_bevelMode",\n      "u_shape"\n    ]);');
      next = next.replace(
        "gl.uniform1f(this.glassU.u_bevelMode, config.bevelMode);",
        "gl.uniform1f(this.glassU.u_bevelMode, config.bevelMode);\n    gl.uniform1f(this.glassU.u_shape, config.shape || 0);",
      );
      return next;
    },
  };
}
