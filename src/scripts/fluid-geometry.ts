import {
	BufferGeometry,
	Float32BufferAttribute,
	Group,
	InstancedMesh,
	MeshPhysicalMaterial,
	Object3D,
	SphereGeometry,
} from "three";

export interface SplashDrop {
	z: number;
	phase: number;
	size: number;
	spread: number;
}

interface SplashDrops {
	mesh: InstancedMesh;
	seeds: SplashDrop[];
}

export function createSplashGeometry(): BufferGeometry {
	const lengthSegments = 320;
	const radialSegments = 36;
	const positions: number[] = [];
	const uvs: number[] = [];
	const indices: number[] = [];

	for (let lengthIndex = 0; lengthIndex <= lengthSegments; lengthIndex += 1) {
		const progress = lengthIndex / lengthSegments;
		const angle = progress * Math.PI * 2;
		const centerX = 1.58 * Math.sin(angle * 2);
		const centerY = 1.05 * Math.sin(angle);
		const centerZ = 0.34 * Math.cos(angle);
		const tangentX = 3.16 * Math.cos(angle * 2);
		const tangentY = 1.05 * Math.cos(angle);
		const tangentLength = Math.hypot(tangentX, tangentY);
		const normalX = -tangentY / tangentLength;
		const normalY = tangentX / tangentLength;
		const swell = Math.sin(Math.PI * progress);
		const plume = Math.sin(progress * Math.PI * 8 + 0.5) ** 2;
		const taper = 0.105 + 0.095 * Math.pow(swell, 0.45) + 0.035 * plume;

		for (let radialIndex = 0; radialIndex <= radialSegments; radialIndex += 1) {
			const ringProgress = radialIndex / radialSegments;
			const ringAngle = ringProgress * Math.PI * 2;
			const turbulence =
				1 +
				0.12 * Math.sin(progress * 49 + ringAngle * 3) +
				0.06 * Math.cos(progress * 83 - ringAngle * 2);
			const radius = taper * turbulence;

			positions.push(
				centerX + normalX * Math.cos(ringAngle) * radius,
				centerY + normalY * Math.cos(ringAngle) * radius,
				centerZ + Math.sin(ringAngle) * radius,
			);
			uvs.push(progress, ringProgress);
		}
	}

	for (let lengthIndex = 0; lengthIndex < lengthSegments; lengthIndex += 1) {
		for (let radialIndex = 0; radialIndex < radialSegments; radialIndex += 1) {
			const current = lengthIndex * (radialSegments + 1) + radialIndex;
			const next = current + radialSegments + 1;
			indices.push(current, next, current + 1, next, next + 1, current + 1);
		}
	}

	const geometry = new BufferGeometry();
	geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
	geometry.setAttribute("uv", new Float32BufferAttribute(uvs, 2));
	geometry.setIndex(indices);
	geometry.computeVertexNormals();
	return geometry;
}

export function createSplashDrops(group: Group): SplashDrops {
	const dropCount = 54;
	const geometry = new SphereGeometry(1, 10, 8);
	const material = new MeshPhysicalMaterial({
		color: 0xf01835,
		emissive: 0x2a0008,
		roughness: 0.14,
		metalness: 0.02,
		clearcoat: 1,
		clearcoatRoughness: 0.1,
	});
	const mesh = new InstancedMesh(geometry, material, dropCount);
	const seeds: SplashDrop[] = [];
	let seed = 26061988;
	const random = () => {
		seed = (seed * 1664525 + 1013904223) >>> 0;
		return seed / 4294967296;
	};
	const dummy = new Object3D();

	for (let index = 0; index < dropCount; index += 1) {
		const drop: SplashDrop = {
			z: (random() - 0.5) * 0.3,
			phase: random() * Math.PI * 2,
			size: 0.012 + random() ** 2 * 0.043,
			spread: (random() - 0.5) * (0.24 + random() * 0.5),
		};
		seeds.push(drop);
		const x = 1.58 * Math.sin(drop.phase * 2);
		const y = 1.05 * Math.sin(drop.phase);
		dummy.position.set(x, y, drop.z);
		dummy.scale.set(drop.size * 1.2, drop.size * 0.7, drop.size * 0.8);
		dummy.updateMatrix();
		mesh.setMatrixAt(index, dummy.matrix);
	}

	mesh.instanceMatrix.needsUpdate = true;
	group.add(mesh);
	return { mesh, seeds };
}
