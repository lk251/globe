/* eslint-disable camelcase */
import {
  MeshBasicMaterial,
  InstancedMesh,
  Group,
  BufferGeometry,
  Float32BufferAttribute,
  Points,
  PointsMaterial,
  InstancedBufferAttribute,
  AdditiveBlending,
  Vector3,
  CylinderBufferGeometry,
  Color,
  BoxBufferGeometry,
} from 'three/build/three.module';

import spikeVert from '../../glsl/spike.vert?raw';
import spikeFrag from '../../glsl/spike.frag?raw';
import particleVert from '../../glsl/particle.vert?raw';
import particleFrag from '../../glsl/particle.frag?raw';
import { clamp, hasValidCoordinates, map } from '../utils/utils';
import { polarToCartesian, vectorZero, cleanBufferAttributeArray, disposeHierarchy, disposeNode } from '../utils/three-utils';
import { AppProps } from '../core/app-props';

export default class OpenPrEntity {
  constructor(props) {
    this.props = props;
    this.init();
  }

  init() {
    const {
      maxAmount = 1000,
      data = [],
      radius = 1,
      camera,
      maxIndexDistance,
      visibleIndex,
      colors: { openPrColor, openPrParticleColor },
    } = this.props;

    const { pixelRatio, spikeRadius = 0.06 } = AppProps;

    this.mesh = new Group();

    const spikeIntersectMaterial = new MeshBasicMaterial({ color: 0x00ff00, visible: false });
    const spikeIntersectGeometry = new BoxBufferGeometry(0.75, 1, 0.75);
    spikeIntersectGeometry.translate(0, 0.5, 0);
    spikeIntersectGeometry.rotateX(-Math.PI / 2);
    const spikeIntersects = new InstancedMesh(spikeIntersectGeometry, spikeIntersectMaterial, maxAmount);
    this.mesh.add(spikeIntersects);

    const spikeMaterial = new MeshBasicMaterial({
      color: openPrColor,
      transparent: true,
      opacity: 0.4,
      alphaTest: 0.05,
      blending: AdditiveBlending,
    });

    spikeMaterial.onBeforeCompile = (shader) => {
      shader.uniforms.cameraPosition = { value: camera.position };
      shader.uniforms.radius = { value: radius };
      shader.uniforms.visibleIndex = { value: visibleIndex };
      shader.uniforms.maxIndexDistance = { value: maxIndexDistance };
      shader.uniforms.highlightIndex = { value: -9999 };
      shader.vertexShader = spikeVert;
      shader.fragmentShader = spikeFrag;

      this.spikeUniforms = shader.uniforms;
    };

    const spikeIndices = [];
    const particleIndices = [];
    for (let i = 0; i < maxAmount; i++) {
      spikeIndices.push(i);
      particleIndices.push(i);
    }

    const spikeGeometry = new CylinderBufferGeometry(spikeRadius * pixelRatio, spikeRadius * pixelRatio, 1, 6, 1, false);
    spikeGeometry.setAttribute('index', new InstancedBufferAttribute(new Float32Array(spikeIndices), 1));
    spikeGeometry.translate(0, 0.5, 0);
    spikeGeometry.rotateX(-Math.PI / 2);
    const spikes = new InstancedMesh(spikeGeometry, spikeMaterial, maxAmount);
    this.mesh.add(spikes);

    const particleGeometry = new BufferGeometry();
    const particlePositions = [];
    const particleColors = [];
    const baseColor = new Color(openPrParticleColor);
    const dummy = new Group();
    const densities = this.getDensities();
    const { densityValues, minDensity, maxDensity } = densities;

    let dIndex = 0;
    for (let i = 0; i < maxAmount; i++) {
      const item = data[i];
      const { gop } = item;
      // Casting longitude and latitude to numbers
      const geo_user_opened = { lon: +gop.lon, lat: +gop.lat };

      if (!hasValidCoordinates(geo_user_opened)) {
        continue;
      }

      // spikes
      polarToCartesian(geo_user_opened.lat, geo_user_opened.lon, radius, dummy.position);

      const density = densityValues[dIndex++];
      dummy.scale.z = map(density, minDensity, maxDensity, radius * 0.05, radius * 0.2);

      dummy.lookAt(vectorZero);
      dummy.updateMatrix();
      spikes.setMatrixAt(i, dummy.matrix);
      spikeIntersects.setMatrixAt(i, dummy.matrix);

      // top of spike
      polarToCartesian(geo_user_opened.lat, geo_user_opened.lon, radius + dummy.scale.z + 0.25, dummy.position);
      particlePositions.push(dummy.position.x, dummy.position.y, dummy.position.z);
      particleColors.push(baseColor.r, baseColor.g, baseColor.b);
    }

    particleGeometry.setAttribute(
      'position',
      new Float32BufferAttribute(particlePositions, 3).onUpload(cleanBufferAttributeArray)
    );

    particleGeometry.setAttribute('color', new Float32BufferAttribute(particleColors, 3).onUpload(cleanBufferAttributeArray));

    particleGeometry.setAttribute('index', new Float32BufferAttribute(particleIndices, 1).onUpload(cleanBufferAttributeArray));

    const particleMaterial = new PointsMaterial({
      alphaTest: 0.05,
      size: 0.8,
      depthWrite: false,
    });

    particleMaterial.onBeforeCompile = (shader) => {
      shader.uniforms.cameraPosition = { value: camera.position };
      shader.uniforms.radius = { value: radius };
      shader.uniforms.visibleIndex = { value: visibleIndex };
      shader.uniforms.maxIndexDistance = { value: maxIndexDistance };

      shader.vertexShader = particleVert;
      shader.fragmentShader = particleFrag;

      this.particleUniforms = shader.uniforms;
    };

    const particles = new Points(particleGeometry, particleMaterial);
    this.mesh.add(particles);

    this.materials = [spikeMaterial, particleMaterial];
    this.spikes = spikes;
    this.spikeIntersects = spikeIntersects;
    this.particles = particles;

    this.spikes.renderOrder = 3;
    this.particles.renderOrder = 4;
  }

  getDensities() {
    const { data, maxAmount = 1000, radius } = this.props;
    const vec = new Vector3();

    // figure out densities
    const locations = [];
    const densities = [];
    for (let i = 0; i < maxAmount; i++) {
      const item = data[i];
      const { gop } = item;
      // Casting longitude and latitude to floats
      const geo_user_opened = { lon: +gop.lon, lat: +gop.lat };
      if (geo_user_opened && hasValidCoordinates(geo_user_opened)) {
        polarToCartesian(geo_user_opened.lat, geo_user_opened.lon, radius, vec);
        locations.push(new Vector3().copy(vec));
        densities.push(0);
      }
    }

    const minDist = 10;
    locations.forEach((l1, index1) => {
      locations.forEach((l2, index2) => {
        if (index1 !== index2 && l1.distanceTo(l2) <= minDist) {
          densities[index1]++;
        }
      });
    });

    let minDensity = 99999;
    let maxDensity = -1;
    densities.forEach((d) => {
      if (d < minDensity) minDensity = d;
      else if (d > maxDensity) maxDensity = d;
    });

    return { densityValues: densities, minDensity, maxDensity };
  }

  setHighlightIndex(index) {
    if (this.spikeUniforms && this.spikeUniforms.highlightIndex.value !== index) {
      this.spikeUniforms.highlightIndex.value = index;
    }
  }

  update(visibleIndex) {
    if (this.spikeUniforms && this.particleUniforms) {
      const { maxAmount, maxIndexDistance } = this.props;

      if (this.spikeUniforms) this.spikeUniforms.visibleIndex.value = visibleIndex;
      if (this.particleUniforms) this.particleUniforms.visibleIndex.value = visibleIndex;

      const start = clamp((visibleIndex - maxIndexDistance) | 0, 0, maxAmount);
      const count = (maxIndexDistance * 2) | 0;
      const finalCount = clamp(start + count, 0, maxAmount);

      this.spikes.count = finalCount;
      this.particles.geometry.setDrawRange(start, count);
    }
  }

  dispose() {
    if (this.mesh) disposeHierarchy(this.mesh, disposeNode);
    if (this.mesh && this.mesh.parent) this.mesh.parent.remove(this.mesh);

    this.props = null;
    this.mesh = null;
    this.spikeUniforms = null;
    this.particleUniforms = null;
    this.materials = null;
    this.spikes = null;
    this.particles = null;
  }
}
