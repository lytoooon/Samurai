import {
	DoubleSide,
	DirectionalLight,
	Group,
	HemisphereLight,
	Mesh,
	Object3D,
	OrthographicCamera,
	Scene,
	ShaderMaterial,
	WebGLRenderer,
} from "three";
import type { InstancedMesh } from "three";
import { createSplashDrops, createSplashGeometry, type SplashDrop } from "./fluid-geometry";
import { fluidFragmentShader, fluidVertexShader } from "./fluid-shaders";

interface FluidSceneOptions {
	track: HTMLElement;
	artwork: HTMLElement;
	canvas: HTMLCanvasElement;
	progress: HTMLElement;
	progressFill: HTMLElement;
}

interface FluidSceneState {
	renderer: WebGLRenderer;
	scene: Scene;
	camera: OrthographicCamera;
	group: Group;
	timeUniform: { value: number };
	drops: InstancedMesh;
	dropSeeds: SplashDrop[];
	dummy: Object3D;
}

export function mountFluidScene({
	track,
	artwork,
	canvas,
	progress,
	progressFill,
}: FluidSceneOptions): void {
	const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
	let sceneState: FluidSceneState | undefined;
	let disposed = false;
	let intersecting = false;
	let initializationStarted = false;
	let animationFrame = 0;
	let scrollProgress = 0;
	let elapsed = 0;
	let lastFrame = 0;
	const frameInterval = 1000 / 30;

	const render = () => {
		if (!sceneState) return;
		sceneState.group.rotation.z = Math.sin(scrollProgress * Math.PI * 2 + elapsed * 0.12) * 0.035;
		sceneState.group.rotation.x = Math.sin(elapsed * 0.37) * 0.045;
		sceneState.group.rotation.y = Math.sin(elapsed * 0.51) * 0.055;
		sceneState.group.scale.setScalar(1 + Math.sin(elapsed * 1.1) * 0.012);
		sceneState.timeUniform.value = elapsed;
		const { drops, dropSeeds, dummy } = sceneState;

		for (const [index, drop] of dropSeeds.entries()) {
			const pathPosition = drop.phase + elapsed * 0.38 + scrollProgress * Math.PI * 2;
			const tangentX = 3.16 * Math.cos(pathPosition * 2);
			const tangentY = 1.05 * Math.cos(pathPosition);
			const tangentLength = Math.hypot(tangentX, tangentY);
			const normalX = -tangentY / tangentLength;
			const normalY = tangentX / tangentLength;
			const flowWobble = Math.sin(elapsed * 1.8 + drop.phase) * 0.035;
			dummy.position.set(
				1.58 * Math.sin(pathPosition * 2) + normalX * (drop.spread + flowWobble),
				1.05 * Math.sin(pathPosition) + normalY * (drop.spread + flowWobble),
				0.34 * Math.cos(pathPosition) + drop.z,
			);
			const pulse = 1 + Math.sin(elapsed * 2 + drop.phase) * 0.12;
			dummy.scale.set(
				drop.size * 1.2 * pulse,
				drop.size * (0.58 + 0.22 * Math.sin(drop.phase)) * pulse,
				drop.size * 0.8 * pulse,
			);
			dummy.updateMatrix();
			drops.setMatrixAt(index, dummy.matrix);
		}

		drops.instanceMatrix.needsUpdate = true;
		sceneState.renderer.render(sceneState.scene, sceneState.camera);
	};

	const updateScroll = () => {
		const distance = Math.max(1, track.offsetHeight - window.innerHeight);
		scrollProgress = Math.min(
			1,
			Math.max(0, -track.getBoundingClientRect().top / distance),
		);
		progressFill.style.transform = `scaleX(${scrollProgress})`;
		progress.setAttribute("aria-valuenow", String(Math.round(scrollProgress * 100)));

		if (reducedMotion.matches) render();
	};

	const animate = (now: number) => {
		animationFrame = 0;
		if (disposed || !intersecting || reducedMotion.matches || document.hidden) return;

		if (lastFrame !== 0 && now - lastFrame < frameInterval) {
			animationFrame = window.requestAnimationFrame(animate);
			return;
		}

		const delta = lastFrame === 0 ? 0 : Math.min((now - lastFrame) / 1000, 0.05);
		lastFrame = now;
		elapsed += delta;
		render();
		animationFrame = window.requestAnimationFrame(animate);
	};

	const startAnimation = () => {
		if (!animationFrame && intersecting && !reducedMotion.matches && !document.hidden) {
			animationFrame = window.requestAnimationFrame(animate);
		}
	};

	const pauseAnimation = () => {
		if (animationFrame) {
			window.cancelAnimationFrame(animationFrame);
			animationFrame = 0;
		}
		lastFrame = 0;
	};

	const handleVisibilityChange = () => {
		if (document.hidden) {
			pauseAnimation();
		} else {
			startAnimation();
		}
	};

	const handleMotionChange = () => {
		pauseAnimation();
		render();
		startAnimation();
	};

	const initialize = async () => {
		if (initializationStarted || disposed) return;
		initializationStarted = true;

		try {
			const renderer = new WebGLRenderer({
				canvas,
				alpha: true,
				antialias: true,
				powerPreference: "low-power",
			});
			renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
			renderer.setClearColor(0x000000, 0);

			const scene = new Scene();
			const camera = new OrthographicCamera(-2.35, 2.35, 1.7, -1.7, 0.1, 30);
			camera.position.z = 8;
			scene.add(new HemisphereLight(0xffded8, 0x42121b, 2.1));

			const keyLight = new DirectionalLight(0xffded4, 3.4);
			keyLight.position.set(-3, 4, 6);
			scene.add(keyLight);

			const fillLight = new DirectionalLight(0xff2638, 1.7);
			fillLight.position.set(4, -2, 4);
			scene.add(fillLight);

			const group = new Group();
			scene.add(group);

			const timeUniform = { value: 0 };
			const fluidGeometry = createSplashGeometry();
			const fluidMaterial = new ShaderMaterial({
				uniforms: { uTime: timeUniform },
				vertexShader: fluidVertexShader,
				fragmentShader: fluidFragmentShader,
				side: DoubleSide,
			});
			group.add(new Mesh(fluidGeometry, fluidMaterial));

			const { mesh: drops, seeds: dropSeeds } = createSplashDrops(group);
			const dummy = new Object3D();

			sceneState = {
				renderer,
				scene,
				camera,
				group,
				timeUniform,
				drops,
				dropSeeds,
				dummy,
			};

			resize();
			artwork.classList.add("is-webgl-ready");
			render();
			startAnimation();
		} catch (error) {
			console.error("Could not initialize the fluid WebGL artwork.", error);
		}
	};

	const resize = () => {
		if (!sceneState) return;
		const { renderer, camera } = sceneState;
		const { width, height } = artwork.getBoundingClientRect();
		if (width === 0 || height === 0) return;

		const aspect = width / height;
		const halfWidth = 2.35;
		const halfHeight = halfWidth / aspect;
		camera.left = -halfWidth;
		camera.right = halfWidth;
		camera.top = halfHeight;
		camera.bottom = -halfHeight;
		camera.updateProjectionMatrix();
		renderer.setSize(width, height, false);
		render();
	};

	const intersectionObserver = new IntersectionObserver(
		(entries) => {
			intersecting = entries.some((entry) => entry.isIntersecting);
			if (intersecting) {
				void initialize();
				startAnimation();
			} else {
				pauseAnimation();
			}
		},
		{ rootMargin: "100px" },
	);
	const resizeObserver = new ResizeObserver(resize);

	intersectionObserver.observe(artwork);
	resizeObserver.observe(artwork);
	window.addEventListener("scroll", updateScroll, { passive: true });
	window.addEventListener("resize", resize, { passive: true });
	document.addEventListener("visibilitychange", handleVisibilityChange);
	reducedMotion.addEventListener("change", handleMotionChange);
	updateScroll();

	if (artwork.getBoundingClientRect().top < window.innerHeight + 100) {
		intersecting = true;
		void initialize();
	}

	window.addEventListener(
		"pagehide",
		() => {
			disposed = true;
			pauseAnimation();
			intersectionObserver.disconnect();
			resizeObserver.disconnect();
			window.removeEventListener("scroll", updateScroll);
			window.removeEventListener("resize", resize);
			document.removeEventListener("visibilitychange", handleVisibilityChange);
			reducedMotion.removeEventListener("change", handleMotionChange);
			sceneState?.renderer.dispose();
		},
		{ once: true },
	);
}
