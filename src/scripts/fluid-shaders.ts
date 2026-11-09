export const fluidVertexShader = `
	uniform float uTime;
	varying vec3 vNormal;
	varying vec3 vViewPosition;
	varying vec3 vLocalPosition;
	varying vec2 vUv;

	void main() {
		float broadFlow = sin(uv.x * 31.0 - uTime * 2.0 + sin(uv.y * 6.0));
		float fineFlow = sin(uv.x * 94.0 - uTime * 3.2 + uv.y * 7.0);
		float surfaceFlicker = sin(uv.x * 180.0 - uTime * 4.1 + uv.y * 13.0);
		float displacement = broadFlow * 0.026 + fineFlow * 0.013 + surfaceFlicker * 0.005;
		vec3 displaced = position + normal * displacement;
		vec4 viewPosition = modelViewMatrix * vec4(displaced, 1.0);
		vNormal = normalize(normalMatrix * normal);
		vViewPosition = -viewPosition.xyz;
		vLocalPosition = position;
		vUv = uv;
		gl_Position = projectionMatrix * viewPosition;
	}
`;

export const fluidFragmentShader = `
	uniform float uTime;
	varying vec3 vNormal;
	varying vec3 vViewPosition;
	varying vec3 vLocalPosition;
	varying vec2 vUv;

	float hash(vec3 p) {
		p = fract(p * 0.3183099 + vec3(0.1, 0.2, 0.3));
		p *= 17.0;
		return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
	}

	float noise(vec3 p) {
		vec3 cell = floor(p);
		vec3 fraction = fract(p);
		fraction = fraction * fraction * (3.0 - 2.0 * fraction);
		return mix(
			mix(
				mix(hash(cell), hash(cell + vec3(1.0, 0.0, 0.0)), fraction.x),
				mix(hash(cell + vec3(0.0, 1.0, 0.0)), hash(cell + vec3(1.0, 1.0, 0.0)), fraction.x),
				fraction.y
			),
			mix(
				mix(hash(cell + vec3(0.0, 0.0, 1.0)), hash(cell + vec3(1.0, 0.0, 1.0)), fraction.x),
				mix(hash(cell + vec3(0.0, 1.0, 1.0)), hash(cell + vec3(1.0, 1.0, 1.0)), fraction.x),
				fraction.y
			),
			fraction.z
		);
	}

	void main() {
		vec3 normal = normalize(vNormal);
		vec3 viewDirection = normalize(vViewPosition);
		vec3 lightDirection = normalize(vec3(-0.45, 0.72, 0.78));
		float diffuse = max(dot(normal, lightDirection), 0.0);
		float gloss = pow(max(dot(reflect(-lightDirection, normal), viewDirection), 0.0), 38.0);
		float rim = pow(1.0 - max(dot(normal, viewDirection), 0.0), 2.7);
		vec3 flowPosition = vec3(vUv.x * 10.0 - uTime * 0.34, vUv.y * 2.8, vLocalPosition.z * 4.0);
		float warp = noise(flowPosition + vec3(0.0, sin(vUv.x * 8.0) * 0.7, 0.0));
		float marbling = noise(flowPosition * 1.4 + vec3(warp * 1.1, -uTime * 0.2, warp));
		float pigment = noise(flowPosition * vec3(1.7, 2.4, 2.0) + vec3(-uTime * 0.28, 0.0, warp * 1.3));
		float vein = smoothstep(0.45, 0.78, marbling * 0.68 + pigment * 0.32);

		vec3 deepRed = vec3(0.13, 0.003, 0.018);
		vec3 bloodRed = vec3(0.48, 0.012, 0.038);
		vec3 scarlet = vec3(0.82, 0.055, 0.075);
		vec3 color = mix(deepRed, bloodRed, 0.35 + marbling * 0.56);
		color = mix(color, scarlet, vein * 0.34);
		color *= 0.62 + diffuse * 0.48;
		color += vec3(1.0, 0.48, 0.39) * gloss * 0.72;
		color += vec3(0.34, 0.025, 0.04) * rim * 0.38;

		gl_FragColor = vec4(color, 0.98);
		#include <tonemapping_fragment>
		#include <colorspace_fragment>
	}
`;
