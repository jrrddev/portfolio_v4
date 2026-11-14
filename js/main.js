/**
 * Jared Daniel Verana Portfolio — Interactive 3D Cartographic & UI Engine
 * Implements:
 * 1. 3D Topographic Terrain Canvas (Three.js WebGL + Instant 3D Projection Engine)
 * 2. 3D Wireframe Field Record Horizon Canvas
 * 3. Spring-Physics Magnetic Compass & Live Survey Telemetry
 * 4. 3D Perspective Tilt on Portrait Plate & Project Frames
 * 5. Scroll-Triggered Telemetry Counters & Reveal Animations
 * 6. Interactive Project Tag Filtering & Certificate Zoom/Pan
 * 7. Field Dossier Command Palette (Ctrl+K / Cmd+K)
 */

(() => {
    'use strict';

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    /* ==========================================================================
       0. ADAPTIVE POWER, VISIBILITY & FRAME-TIME MONITOR
       ========================================================================== */
    const perfState = {
        hidden: document.hidden,
        lowPower: false,
        visibilityListeners: new Set(),
        lowPowerListeners: new Set()
    };

    function enableLowPowerMode() {
        if (perfState.lowPower) return;
        perfState.lowPower = true;
        document.documentElement.classList.add('is-low-power');
        perfState.lowPowerListeners.forEach((cb) => cb(true));
    }

    document.addEventListener('visibilitychange', () => {
        perfState.hidden = document.hidden;
        perfState.visibilityListeners.forEach((cb) => cb(!perfState.hidden));
    });

    // Check Battery API (Chromium) to proactively protect battery-throttled laptops
    if (typeof navigator.getBattery === 'function') {
        navigator.getBattery().then((battery) => {
            const checkBattery = () => {
                if (!battery.charging && battery.level <= 0.35) {
                    enableLowPowerMode();
                }
            };
            checkBattery();
            battery.addEventListener('chargingchange', checkBattery);
            battery.addEventListener('levelchange', checkBattery);
        }).catch(() => {});
    }

    // Lightweight frame-time sampler: if sustained frames exceed 26ms (<38fps), engage low-power optimizations
    if (!prefersReducedMotion) {
        let slowFrames = 0;
        let sampleCount = 0;
        let lastSample = performance.now();
        function sampleFrameBudget(now) {
            if (perfState.lowPower) return;
            const dt = now - lastSample;
            lastSample = now;
            if (!perfState.hidden && dt < 150) {
                sampleCount++;
                if (dt > 26) slowFrames++;
                if (sampleCount >= 30) {
                    if (slowFrames >= 14) {
                        enableLowPowerMode();
                        return;
                    }
                    sampleCount = 0;
                    slowFrames = 0;
                }
            }
            if (sampleCount < 180) {
                requestAnimationFrame(sampleFrameBudget);
            }
        }
        requestAnimationFrame(sampleFrameBudget);
    }

    /* ==========================================================================
       1. 3D TOPOGRAPHIC TERRAIN ENGINE (Hero Portrait Plate)
       ========================================================================== */
    function initHero3DTopography() {
        const plate = document.querySelector('.portrait-plate');
        const topoContainer = document.querySelector('.portrait-plate .topography');
        if (!plate || !topoContainer) return;

        const canvas = document.createElement('canvas');
        canvas.className = 'topo-canvas';
        canvas.setAttribute('aria-hidden', 'true');
        topoContainer.appendChild(canvas);
        plate.classList.add('has-3d-topo');

        // Add live coordinate readout badge to portrait plate
        const coordsBadge = document.createElement('div');
        coordsBadge.className = 'plate-coords';
        coordsBadge.setAttribute('aria-hidden', 'true');
        coordsBadge.innerHTML = '<span class="coord-dot"></span><span class="coord-text">10.7202° N, 122.5621° E · ELEV 48M</span>';
        plate.appendChild(coordsBadge);
        const coordText = coordsBadge.querySelector('.coord-text');

        // Pointer state for 3D interaction & elevation ripple
        const pointer = {
            x: 0,
            y: 0,
            targetX: 0,
            targetY: 0,
            normX: 0.5,
            normY: 0.5,
            active: false,
            pulseTime: -10
        };

        let plateDocTop = 0;
        let plateDocLeft = 0;
        let plateWidth = 1;
        let plateHeight = 1;
        const updatePlateRect = () => {
            const rect = plate.getBoundingClientRect();
            plateDocTop = rect.top + window.scrollY;
            plateDocLeft = rect.left + window.scrollX;
            plateWidth = rect.width || 1;
            plateHeight = rect.height || 1;
        };
        updatePlateRect();
        window.addEventListener('resize', updatePlateRect, { passive: true });
        if (typeof ResizeObserver === 'function') {
            const plateRo = new ResizeObserver(updatePlateRect);
            plateRo.observe(document.documentElement);
            plateRo.observe(plate);
        }
        if (document.fonts && document.fonts.ready) {
            document.fonts.ready.then(updatePlateRect).catch(() => {});
        }

        plate.addEventListener('pointermove', (e) => {
            const plateLeft = plateDocLeft - window.scrollX;
            const plateTop = plateDocTop - window.scrollY;
            pointer.normX = (e.clientX - plateLeft) / plateWidth;
            pointer.normY = (e.clientY - plateTop) / plateHeight;
            pointer.targetX = (pointer.normX - 0.5) * 2;
            pointer.targetY = (pointer.normY - 0.5) * 2;
            pointer.active = true;

            // Update simulated cartographic survey coordinates around Iloilo (10.7202 N, 122.5621 E)
            if (coordText) {
                const lat = (10.7202 - pointer.targetY * 0.014).toFixed(4);
                const lon = (122.5621 + pointer.targetX * 0.014).toFixed(4);
                const elev = Math.round(48 + Math.sin(pointer.normX * 4) * 18 + Math.cos(pointer.normY * 4) * 12);
                coordText.textContent = `${lat}° N, ${lon}° E · ELEV ${elev}M`;
            }
        }, { passive: true });

        plate.addEventListener('pointerleave', () => {
            pointer.targetX = 0;
            pointer.targetY = 0;
            pointer.active = false;
            if (coordText) {
                coordText.textContent = '10.7202° N, 122.5621° E · ELEV 48M';
            }
        });

        // Clicking compass or plate triggers a 3D topographic sonar wave
        plate.addEventListener('click', () => {
            pointer.pulseTime = performance.now() * 0.001;
        });

        // Try upgrading to Three.js WebGL 3D Mesh if available, while running crisp 3D Canvas Engine immediately
        let usingThree = false;
        let heroVisible = true;
        let rafId = 0;
        let lastRenderTime = 0;
        const ctx = canvas.getContext('2d');
        let width = 0;
        let height = 0;
        let dpr = Math.min(window.devicePixelRatio || 1, perfState.lowPower ? 1 : 1.5);

        function resizeCanvas() {
            dpr = Math.min(window.devicePixelRatio || 1, perfState.lowPower ? 1 : 1.5);
            const rect = topoContainer.getBoundingClientRect();
            width = Math.max(1, rect.width);
            height = Math.max(1, rect.height);
            canvas.width = width * dpr;
            canvas.height = height * dpr;
            if (ctx && !usingThree) {
                ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            }
        }
        resizeCanvas();
        window.addEventListener('resize', resizeCanvas, { passive: true });

        // Simplex-style layered terrain elevation function
        function getElevation(gx, gz, time) {
            const wave1 = Math.sin(gx * 1.45 + time * 0.45) * Math.cos(gz * 1.25 + time * 0.35) * 22;
            const wave2 = Math.sin(gx * 2.8 - gz * 1.9 + time * 0.25) * 9;
            const ridge = Math.cos((gx * gx + gz * gz) * 0.65 - time * 0.4) * 11;

            // Cursor interactive peak/depression
            const dx = gx - pointer.x * 1.8;
            const dz = gz - pointer.y * 1.5;
            const distSq = dx * dx + dz * dz;
            const cursorPeak = pointer.active ? Math.exp(-distSq * 1.6) * 26 : 0;

            // Sonar pulse wave when clicked
            const elapsedPulse = time - pointer.pulseTime;
            let pulseWave = 0;
            if (elapsedPulse > 0 && elapsedPulse < 3.5) {
                const dist = Math.sqrt(distSq);
                const ring = Math.abs(dist - elapsedPulse * 1.6);
                if (ring < 0.45) {
                    pulseWave = Math.cos((ring / 0.45) * Math.PI * 0.5) * 20 * (1 - elapsedPulse / 3.5);
                }
            }

            return wave1 + wave2 + ridge + cursorPeak + pulseWave;
        }

        // 3D Perspective Projection Engine (runs at 60fps with zero external dependencies)
        const cols = 28;
        const rows = 22;
        const fov = 340;
        const gridCount = rows * cols;
        const sxBuf = new Float32Array(gridCount);
        const syBuf = new Float32Array(gridCount);
        const wyBuf = new Float32Array(gridCount);
        const scaleBuf = new Float32Array(gridCount);
        const projOut = { sx: 0, sy: 0, scale: 1 };

        function project3D(x, y, z, cosY, sinY, cosP, sinP) {
            // Rotate around Y axis (yaw)
            const x1 = x * cosY - z * sinY;
            const z1 = z * cosY + x * sinY;

            // Rotate around X axis (pitch)
            const y2 = y * cosP - z1 * sinP;
            const z2 = z1 * cosP + y * sinP + 260;

            const scale = fov / Math.max(60, z2);
            projOut.sx = width * 0.5 + x1 * scale;
            projOut.sy = height * 0.54 - y2 * scale;
            projOut.scale = scale;
        }

        let animTime = 0;
        let threeTickFn = null;

        function startActiveTerrainLoop() {
            if (prefersReducedMotion || !heroVisible || perfState.hidden || rafId) return;
            rafId = requestAnimationFrame(usingThree && threeTickFn ? threeTickFn : render3DCanvas);
        }

        function stopActiveTerrainLoop() {
            if (rafId) {
                cancelAnimationFrame(rafId);
                rafId = 0;
            }
        }

        const heroObs = new IntersectionObserver((entries) => {
            heroVisible = entries[0].isIntersecting;
            if (heroVisible) startActiveTerrainLoop();
            else stopActiveTerrainLoop();
        }, { threshold: 0.02 });
        heroObs.observe(plate);

        perfState.visibilityListeners.add((visible) => {
            if (visible && heroVisible) startActiveTerrainLoop();
            else stopActiveTerrainLoop();
        });

        perfState.lowPowerListeners.add(() => {
            if (!usingThree) resizeCanvas();
        });

        function render3DCanvas(now) {
            rafId = 0;
            if (usingThree || !heroVisible || perfState.hidden) return;

            if (perfState.lowPower && !pointer.active && now - lastRenderTime < 32) {
                if (!prefersReducedMotion) rafId = requestAnimationFrame(render3DCanvas);
                return;
            }
            lastRenderTime = now;
            animTime = prefersReducedMotion ? 1.2 : now * 0.001;

            // Smooth spring interpolation for pointer
            pointer.x += (pointer.targetX - pointer.x) * 0.08;
            pointer.y += (pointer.targetY - pointer.y) * 0.08;

            ctx.clearRect(0, 0, width, height);

            const pitch = 0.62 + pointer.y * 0.18;
            const yaw = -0.28 + pointer.x * 0.24 + (prefersReducedMotion ? 0 : Math.sin(animTime * 0.15) * 0.05);
            const cosY = Math.cos(yaw);
            const sinY = Math.sin(yaw);
            const cosP = Math.cos(pitch);
            const sinP = Math.sin(pitch);

            const spanX = width * 0.95;
            const spanZ = height * 1.05;
            const halfSpanX = spanX * 0.5;
            const halfSpanZ = spanZ * 0.5;
            const invColsMinus1 = 1 / (cols - 1);
            const invRowsMinus1 = 1 / (rows - 1);

            for (let r = 0; r < rows; r++) {
                const nz = (r * invRowsMinus1 - 0.5) * 2; // -1 to 1
                const wz = nz * halfSpanZ;
                const rowOffset = r * cols;
                for (let c = 0; c < cols; c++) {
                    const nx = (c * invColsMinus1 - 0.5) * 2; // -1 to 1
                    const wx = nx * halfSpanX;
                    const wy = getElevation(nx * 2, nz * 2, animTime);
                    project3D(wx, wy, wz, cosY, sinY, cosP, sinP);
                    const idx = rowOffset + c;
                    sxBuf[idx] = projOut.sx;
                    syBuf[idx] = projOut.sy;
                    wyBuf[idx] = wy;
                    scaleBuf[idx] = projOut.scale;
                }
            }

            // Draw longitudinal terrain ribs (subtle sage lines)
            ctx.lineWidth = 0.85;
            ctx.strokeStyle = 'rgba(72, 92, 80, 0.24)';
            for (let c = 0; c < cols; c += 2) {
                ctx.beginPath();
                for (let r = 0; r < rows; r++) {
                    const idx = r * cols + c;
                    if (r === 0) ctx.moveTo(sxBuf[idx], syBuf[idx]);
                    else ctx.lineTo(sxBuf[idx], syBuf[idx]);
                }
                ctx.stroke();
            }

            // Draw latitudinal 3D topographic contour lines
            for (let r = 0; r < rows; r++) {
                const isMajorContour = r % 4 === 0;
                const rowOffset = r * cols;
                ctx.beginPath();
                for (let c = 0; c < cols; c++) {
                    const idx = rowOffset + c;
                    if (c === 0) ctx.moveTo(sxBuf[idx], syBuf[idx]);
                    else ctx.lineTo(sxBuf[idx], syBuf[idx]);
                }
                if (isMajorContour) {
                    ctx.strokeStyle = 'rgba(25, 60, 50, 0.52)';
                    ctx.lineWidth = 1.35;
                } else {
                    ctx.strokeStyle = 'rgba(25, 60, 50, 0.28)';
                    ctx.lineWidth = 0.9;
                }
                ctx.stroke();
            }

            // Highlight elevation peaks & survey datum vertices in safety orange (#ff713c)
            ctx.fillStyle = '#ff713c';
            for (let r = 2; r < rows - 2; r += 3) {
                const rowOffset = r * cols;
                for (let c = 2; c < cols - 2; c += 4) {
                    const idx = rowOffset + c;
                    if (wyBuf[idx] > 14) {
                        ctx.beginPath();
                        ctx.arc(sxBuf[idx], syBuf[idx], 2.1 * scaleBuf[idx], 0, Math.PI * 2);
                        ctx.fill();
                    }
                }
            }

            // Draw 3D interactive cursor survey beacon on the terrain surface
            if (pointer.active) {
                const beaconY = getElevation(pointer.x * 2, pointer.y * 2, animTime);
                project3D(
                    pointer.x * (spanX * 0.45),
                    beaconY,
                    pointer.y * (spanZ * 0.45),
                    cosY,
                    sinY,
                    cosP,
                    sinP
                );
                const bsx = projOut.sx;
                const bsy = projOut.sy;
                const bscale = projOut.scale;

                ctx.strokeStyle = '#ff713c';
                ctx.lineWidth = 1.4;
                ctx.beginPath();
                ctx.arc(bsx, bsy, 11 * bscale, 0, Math.PI * 2);
                ctx.stroke();

                ctx.beginPath();
                ctx.moveTo(bsx - 16 * bscale, bsy);
                ctx.lineTo(bsx + 16 * bscale, bsy);
                ctx.moveTo(bsx, bsy - 16 * bscale);
                ctx.lineTo(bsx, bsy + 16 * bscale);
                ctx.stroke();
            }

            if (!prefersReducedMotion && heroVisible && !perfState.hidden) {
                rafId = requestAnimationFrame(render3DCanvas);
            }
        }

        if (prefersReducedMotion) {
            render3DCanvas(performance.now());
        } else {
            startActiveTerrainLoop();
        }

        // Optional WebGL Three.js Upgrade (loads asynchronously from CDN if online)
        if (!prefersReducedMotion) {
            import('https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js')
                .then((THREE) => {
                    const webglCanvas = document.createElement('canvas');
                    webglCanvas.className = 'topo-canvas';
                    webglCanvas.setAttribute('aria-hidden', 'true');

                    const renderer = new THREE.WebGLRenderer({
                        canvas: webglCanvas,
                        alpha: true,
                        antialias: !perfState.lowPower,
                        powerPreference: 'default'
                    });
                    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, perfState.lowPower ? 1 : 1.5));
                    renderer.setSize(width, height);

                    perfState.lowPowerListeners.add(() => {
                        renderer.setPixelRatio(1);
                        renderer.setSize(width, height);
                    });

                    const scene = new THREE.Scene();
                    const camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 1000);
                    camera.position.set(0, 72, 115);
                    camera.lookAt(0, -6, 0);

                    const segX = 34;
                    const segZ = 26;
                    const geom = new THREE.PlaneGeometry(175, 145, segX, segZ);
                    geom.rotateX(-Math.PI * 0.5);

                    // Dual-layer mesh: solid paper-green mask + crisp ink wireframe + orange peak points
                    const baseMat = new THREE.MeshBasicMaterial({
                        color: 0xd6dec8,
                        transparent: true,
                        opacity: 0.72,
                        polygonOffset: true,
                        polygonOffsetFactor: 1,
                        polygonOffsetUnits: 1
                    });
                    const baseMesh = new THREE.Mesh(geom, baseMat);
                    scene.add(baseMesh);

                    const wireMat = new THREE.MeshBasicMaterial({
                        color: 0x193c32,
                        wireframe: true,
                        transparent: true,
                        opacity: 0.36
                    });
                    const wireMesh = new THREE.Mesh(geom, wireMat);
                    scene.add(wireMesh);

                    // Orange survey points on vertices
                    const ptsMat = new THREE.PointsMaterial({
                        color: 0xff713c,
                        size: 2.4,
                        transparent: true,
                        opacity: 0.75
                    });
                    const ptsMesh = new THREE.Points(geom, ptsMat);
                    scene.add(ptsMesh);

                    // Swap in WebGL canvas seamlessly
                    stopActiveTerrainLoop();
                    topoContainer.replaceChild(webglCanvas, canvas);
                    usingThree = true;

                    window.addEventListener('resize', () => {
                        const rect = topoContainer.getBoundingClientRect();
                        width = Math.max(1, rect.width);
                        height = Math.max(1, rect.height);
                        camera.aspect = width / height;
                        camera.updateProjectionMatrix();
                        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, perfState.lowPower ? 1 : 1.5));
                        renderer.setSize(width, height);
                    }, { passive: true });

                    const posAttr = geom.attributes.position;
                    const origCoords = new Float32Array(posAttr.count * 2);
                    for (let i = 0; i < posAttr.count; i++) {
                        origCoords[i * 2] = posAttr.getX(i);
                        origCoords[i * 2 + 1] = posAttr.getZ(i);
                    }

                    function animateThree(now) {
                        rafId = 0;
                        if (!heroVisible || perfState.hidden) return;

                        if (perfState.lowPower && !pointer.active && now - lastRenderTime < 32) {
                            rafId = requestAnimationFrame(animateThree);
                            return;
                        }
                        lastRenderTime = now;

                        const t = now * 0.001;
                        pointer.x += (pointer.targetX - pointer.x) * 0.07;
                        pointer.y += (pointer.targetY - pointer.y) * 0.07;

                        for (let i = 0; i < posAttr.count; i++) {
                            const x = origCoords[i * 2] / 42;
                            const z = origCoords[i * 2 + 1] / 42;
                            const y = getElevation(x, z, t) * 0.55;
                            posAttr.setY(i, y);
                        }
                        posAttr.needsUpdate = true;

                        camera.position.x = pointer.x * 22 + Math.sin(t * 0.25) * 5;
                        camera.position.y = 70 - pointer.y * 14;
                        camera.lookAt(pointer.x * 6, -4, pointer.y * 4);

                        renderer.render(scene, camera);
                        if (heroVisible && !perfState.hidden) {
                            rafId = requestAnimationFrame(animateThree);
                        }
                    }
                    threeTickFn = animateThree;
                    startActiveTerrainLoop();
                })
                .catch(() => {
                    // Offline or blocked CDN: built-in 3D projection engine continues running smoothly
                });
        }
    }

    /* ==========================================================================
       2. 3D WIREFRAME FIELD HORIZON (Field Experience Section)
       ========================================================================== */
    function initFieldRecordCanvas() {
        const section = document.querySelector('.field-record');
        if (!section) return;

        const canvas = document.createElement('canvas');
        canvas.className = 'field-record-canvas';
        canvas.setAttribute('aria-hidden', 'true');
        section.prepend(canvas);

        const ctx = canvas.getContext('2d');
        let w = 0;
        let h = 0;

        function resize() {
            const rect = section.getBoundingClientRect();
            w = Math.max(1, rect.width);
            h = Math.max(1, rect.height);
            canvas.width = w;
            canvas.height = h;
        }
        resize();
        window.addEventListener('resize', resize, { passive: true });

        let isVisible = false;
        let fieldRafId = 0;
        let lastFieldDraw = 0;

        function startFieldLoop() {
            if (prefersReducedMotion || !isVisible || perfState.hidden || fieldRafId) return;
            fieldRafId = requestAnimationFrame(drawFieldWave);
        }

        function stopFieldLoop() {
            if (fieldRafId) {
                cancelAnimationFrame(fieldRafId);
                fieldRafId = 0;
            }
        }

        const obs = new IntersectionObserver((entries) => {
            isVisible = entries[0].isIntersecting;
            if (isVisible) startFieldLoop();
            else stopFieldLoop();
        }, { threshold: 0.05 });
        obs.observe(section);

        perfState.visibilityListeners.add((visible) => {
            if (visible && isVisible) startFieldLoop();
            else stopFieldLoop();
        });

        function drawFieldWave(now) {
            fieldRafId = 0;
            if (!isVisible && !prefersReducedMotion) return;
            if (perfState.hidden && !prefersReducedMotion) return;

            if (perfState.lowPower && !prefersReducedMotion && now - lastFieldDraw < 32) {
                fieldRafId = requestAnimationFrame(drawFieldWave);
                return;
            }
            lastFieldDraw = now;

            const t = now * 0.0006;
            ctx.clearRect(0, 0, w, h);
            ctx.strokeStyle = '#b9d1bf';
            ctx.lineWidth = 1;

            const lines = 9;
            for (let l = 0; l < lines; l++) {
                const yBase = (h / (lines + 1)) * (l + 1);
                ctx.beginPath();
                for (let x = 0; x <= w; x += 28) {
                    const nx = x / w;
                    const offset = Math.sin(nx * 5 + t + l * 0.55) * 14 + Math.cos(nx * 9 - t * 0.8) * 6;
                    if (x === 0) ctx.moveTo(x, yBase + offset);
                    else ctx.lineTo(x, yBase + offset);
                }
                ctx.stroke();
            }

            if (!prefersReducedMotion && isVisible && !perfState.hidden) {
                fieldRafId = requestAnimationFrame(drawFieldWave);
            }
        }

        if (prefersReducedMotion) {
            drawFieldWave(performance.now());
        } else {
            startFieldLoop();
        }
    }

    /* ==========================================================================
       3. MAGNETIC COMPASS & 3D PORTRAIT TILT
       ========================================================================== */
    function initCompassAndTilt() {
        const plate = document.querySelector('.portrait-plate');
        const print = document.querySelector('.portrait-print');
        const compass = document.querySelector('.compass');
        const needle = document.querySelector('.compass-needle');
        if (!plate || !compass || !needle) return;

        // Add live bearing badge below compass
        const bearingBadge = document.createElement('span');
        bearingBadge.className = 'compass-bearing';
        bearingBadge.setAttribute('aria-hidden', 'true');
        bearingBadge.textContent = '012° NNE';
        compass.appendChild(bearingBadge);

        let currentAngle = 12;
        let targetAngle = 12;
        let velocity = 0;
        let lastNormDeg = 12;
        let compassRafId = 0;
        let heroVisible = true;

        const cardinals = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];

        let compassDocX = 0;
        let compassDocY = 0;
        let plateDocLeft = 0;
        let plateDocTop = 0;
        let plateWidth = 1;
        let plateHeight = 1;
        function cacheGeometry() {
            const scrollX = window.scrollX;
            const scrollY = window.scrollY;
            const cRect = compass.getBoundingClientRect();
            compassDocX = cRect.left + cRect.width * 0.5 + scrollX;
            compassDocY = cRect.top + cRect.height * 0.5 + scrollY;
            const pRect = plate.getBoundingClientRect();
            plateDocLeft = pRect.left + scrollX;
            plateDocTop = pRect.top + scrollY;
            plateWidth = pRect.width || 1;
            plateHeight = pRect.height || 1;
        }
        cacheGeometry();
        window.addEventListener('resize', cacheGeometry, { passive: true });
        if (typeof ResizeObserver === 'function') {
            const geomRo = new ResizeObserver(cacheGeometry);
            geomRo.observe(document.documentElement);
            geomRo.observe(plate);
            geomRo.observe(compass);
        }
        if (document.fonts && document.fonts.ready) {
            document.fonts.ready.then(cacheGeometry).catch(() => {});
        }

        const compassObs = new IntersectionObserver((entries) => {
            heroVisible = entries[0].isIntersecting;
            if (heroVisible) scheduleCompass();
        }, { threshold: 0.02 });
        compassObs.observe(plate);

        function scheduleCompass() {
            if (prefersReducedMotion || !heroVisible || perfState.hidden || compassRafId) return;
            compassRafId = requestAnimationFrame(updateCompassPhysics);
        }

        window.addEventListener('pointermove', (e) => {
            if (prefersReducedMotion || !heroVisible) return;
            const compassViewportX = compassDocX - window.scrollX;
            const compassViewportY = compassDocY - window.scrollY;
            const rad = Math.atan2(e.clientY - compassViewportY, e.clientX - compassViewportX);
            targetAngle = (rad * 180) / Math.PI + 90;
            scheduleCompass();
        }, { passive: true });

        // 3D Tilt on Portrait Print when hovering over Portrait Plate
        if (print && !prefersReducedMotion) {
            plate.addEventListener('pointermove', (e) => {
                const plateLeft = plateDocLeft - window.scrollX;
                const plateTop = plateDocTop - window.scrollY;
                const nx = (e.clientX - plateLeft) / plateWidth - 0.5;
                const ny = (e.clientY - plateTop) / plateHeight - 0.5;
                const rotX = -ny * 11;
                const rotY = nx * 13;
                print.style.transform = `rotate(-5deg) rotateX(${rotX.toFixed(2)}deg) rotateY(${rotY.toFixed(2)}deg) translateZ(14px)`;
            }, { passive: true });

            plate.addEventListener('pointerleave', () => {
                print.style.transform = 'rotate(-5deg) rotateX(0deg) rotateY(0deg) translateZ(0px)';
            });
        }

        function updateCompassPhysics() {
            compassRafId = 0;
            if (!heroVisible || perfState.hidden) return;

            // Shortest angular distance
            const diff = ((targetAngle - currentAngle + 540) % 360) - 180;
            velocity = (velocity + diff * 0.085) * 0.78;
            currentAngle += velocity;

            needle.style.transform = `rotate(${currentAngle.toFixed(2)}deg)`;

            // Normalize 0-359 for cardinal readout only when integer degree changes
            const normDeg = Math.round(((currentAngle % 360) + 360) % 360);
            if (normDeg !== lastNormDeg) {
                lastNormDeg = normDeg;
                const dirIndex = Math.round(normDeg / 22.5) % 16;
                bearingBadge.textContent = `${String(normDeg).padStart(3, '0')}° ${cardinals[dirIndex]}`;
            }

            if (!prefersReducedMotion && (Math.abs(diff) > 0.04 || Math.abs(velocity) > 0.04)) {
                compassRafId = requestAnimationFrame(updateCompassPhysics);
            }
        }
    }

    /* ==========================================================================
       4. TELEMETRY ODOMETERS & SCROLL REVEAL ANIMATIONS
       ========================================================================== */
    function initTelemetryAndReveals() {
        // Scroll progress indicator in sticky header
        const header = document.querySelector('.site-header');
        if (header) {
            const prog = document.createElement('div');
            prog.className = 'scroll-progress';
            prog.setAttribute('aria-hidden', 'true');
            header.appendChild(prog);

            let maxScroll = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
            const updateMaxScroll = () => {
                maxScroll = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
            };
            window.addEventListener('resize', updateMaxScroll, { passive: true });
            if (typeof ResizeObserver === 'function') {
                new ResizeObserver(updateMaxScroll).observe(document.documentElement);
            }

            let progTicking = false;
            window.addEventListener('scroll', () => {
                if (progTicking) return;
                progTicking = true;
                requestAnimationFrame(() => {
                    progTicking = false;
                    const ratio = Math.min(1, Math.max(0, window.scrollY / maxScroll));
                    prog.style.transform = `scaleX(${ratio.toFixed(4)})`;
                });
            }, { passive: true });
        }

        // Add subtle visual meter to Research Evaluation Card without changing its text
        const studyResults = document.querySelector('.study-results');
        const studyScore = document.querySelector('.study-score');
        if (studyResults && studyScore) {
            const meter = document.createElement('div');
            meter.className = 'score-meter';
            meter.setAttribute('aria-hidden', 'true');
            meter.innerHTML = '<div class="score-meter-fill"></div>';
            studyScore.insertAdjacentElement('afterend', meter);
        }

        // Animate 80 Hours on site & 4.50 / 5 Study Score on scroll into view
        const hoursEl = document.querySelector('.field-record__hours strong');
        if (hoursEl && !prefersReducedMotion) {
            const targetHours = 80;
            const hoursObs = new IntersectionObserver((entries, obs) => {
                if (!entries[0].isIntersecting) return;
                obs.disconnect();
                const start = performance.now();
                const duration = 1100;
                function tick(now) {
                    const p = Math.min(1, (now - start) / duration);
                    const eased = 1 - Math.pow(1 - p, 3);
                    hoursEl.textContent = String(Math.round(eased * targetHours));
                    if (p < 1) requestAnimationFrame(tick);
                    else hoursEl.textContent = '80';
                }
                requestAnimationFrame(tick);
            }, { threshold: 0.4 });
            hoursObs.observe(hoursEl);
        }

        if (studyScore && studyResults && !prefersReducedMotion) {
            const textNode = studyScore.firstChild;
            const scoreObs = new IntersectionObserver((entries, obs) => {
                if (!entries[0].isIntersecting) return;
                obs.disconnect();
                studyResults.classList.add('is-visible');
                if (textNode && textNode.nodeType === Node.TEXT_NODE) {
                    const start = performance.now();
                    const duration = 1200;
                    function tick(now) {
                        const p = Math.min(1, (now - start) / duration);
                        const eased = 1 - Math.pow(1 - p, 3);
                        textNode.nodeValue = (eased * 4.5).toFixed(2);
                        if (p < 1) requestAnimationFrame(tick);
                        else textNode.nodeValue = '4.50';
                    }
                    requestAnimationFrame(tick);
                }
            }, { threshold: 0.35 });
            scoreObs.observe(studyResults);
        } else if (studyResults) {
            studyResults.classList.add('is-visible');
        }

        // Scroll reveal for cards & ledger rows
        const revealTargets = document.querySelectorAll(
            '.project, .field-record__body, .research-copy, .study-results, .training-record tbody tr'
        );
        revealTargets.forEach((el, idx) => {
            el.classList.add('reveal-item');
            el.style.transitionDelay = `${(idx % 3) * 70}ms`;
        });

        const revealObs = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('is-visible');
                }
            });
        }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });

        revealTargets.forEach((el) => revealObs.observe(el));

        // Mobile single-row left-to-right marquee for .toolkit
        const toolkitList = document.querySelector('.toolkit-inner ul');
        if (toolkitList && !toolkitList.querySelector('.toolkit-clone')) {
            const origItems = Array.from(toolkitList.children);
            origItems.forEach((li) => {
                const clone = li.cloneNode(true);
                clone.classList.add('toolkit-clone');
                clone.setAttribute('aria-hidden', 'true');
                toolkitList.appendChild(clone);
            });
        }
    }

    /* ==========================================================================
       5. PROJECT FILTERING & 3D CARD INTERACTION
       ========================================================================== */
    function initProjectFilters() {
        const projectsSection = document.querySelector('#projects');
        const projectGrid = document.querySelector('.project-grid');
        const projects = Array.from(document.querySelectorAll('.project'));
        if (!projectsSection || !projectGrid || projects.length === 0) return;

        // Build non-destructive filter bar above project grid
        const controls = document.createElement('div');
        controls.className = 'project-controls';
        controls.innerHTML = `
            <div class="filter-group" role="toolbar" aria-label="Filter projects by technology">
                <button type="button" class="filter-btn is-active" data-filter="all">All <span class="filter-count">${projects.length}</span></button>
                <button type="button" class="filter-btn" data-filter="HTML">HTML / CSS / JS</button>
                <button type="button" class="filter-btn" data-filter="PHP">PHP &amp; MySQL</button>
                <button type="button" class="filter-btn" data-filter="React">React &amp; Next.js</button>
            </div>
        `;
        projectGrid.insertAdjacentElement('beforebegin', controls);

        const filterBtns = Array.from(controls.querySelectorAll('.filter-btn'));

        // Assign unique view-transition-name to each project card for smooth View Transitions morphing
        projects.forEach((card, idx) => {
            card.style.viewTransitionName = `project-card-${idx}`;
        });

        function updateFilterDOM(tag) {
            filterBtns.forEach((btn) => {
                btn.classList.toggle('is-active', btn.dataset.filter === tag);
            });

            projects.forEach((card) => {
                const cardTags = Array.from(card.querySelectorAll('.tags li')).map((li) => li.textContent.trim());
                const matches = tag === 'all' || cardTags.some((t) => t.toLowerCase().includes(tag.toLowerCase()));
                card.classList.toggle('is-filtered-out', !matches);

                card.querySelectorAll('.tags li').forEach((li) => {
                    li.classList.toggle('is-highlighted', tag !== 'all' && li.textContent.toLowerCase().includes(tag.toLowerCase()));
                });
            });
        }

        function applyFilter(tag) {
            if (typeof document.startViewTransition === 'function' && !prefersReducedMotion) {
                document.startViewTransition(() => updateFilterDOM(tag));
            } else {
                updateFilterDOM(tag);
            }
        }

        filterBtns.forEach((btn) => {
            btn.addEventListener('click', () => applyFilter(btn.dataset.filter));
        });

        // Clicking a tag inside a project card toggles filtering by that tag
        projects.forEach((card) => {
            card.querySelectorAll('.tags li').forEach((tagEl) => {
                tagEl.addEventListener('click', () => {
                    const text = tagEl.textContent.trim();
                    if (text === 'HTML' || text === 'CSS' || text === 'JavaScript') applyFilter('HTML');
                    else if (text === 'PHP' || text === 'MySQL') applyFilter('PHP');
                    else if (text === 'Next.js' || text === 'React' || text === 'TypeScript') applyFilter('React');
                });
            });
        });
    }

    /* ==========================================================================
       6. CERTIFICATE VIEWER ZOOM & PAN ENHANCEMENT
       ========================================================================== */
    function initCertificateZoom() {
        const viewers = document.querySelectorAll('.certificate-viewer');
        viewers.forEach((viewer) => {
            const toolbar = viewer.querySelector('.certificate-toolbar');
            const closeBtn = viewer.querySelector('.certificate-close');
            const img = viewer.querySelector('img');
            if (!toolbar || !closeBtn || !img) return;

            // Wrap image in a scrollable stage for smooth zoom/pan without altering img attributes
            const stage = document.createElement('div');
            stage.className = 'cert-stage';
            img.parentNode.insertBefore(stage, img);
            stage.appendChild(img);

            // Add Zoom toggle button next to Close button
            const actionsWrap = document.createElement('div');
            actionsWrap.className = 'certificate-actions';
            const zoomBtn = document.createElement('button');
            zoomBtn.type = 'button';
            zoomBtn.className = 'cert-zoom-btn';
            zoomBtn.setAttribute('aria-pressed', 'false');
            zoomBtn.textContent = 'Zoom +';

            closeBtn.parentNode.insertBefore(actionsWrap, closeBtn);
            actionsWrap.appendChild(zoomBtn);
            actionsWrap.appendChild(closeBtn);

            function toggleZoom() {
                const zoomed = viewer.classList.toggle('is-zoomed');
                zoomBtn.setAttribute('aria-pressed', String(zoomed));
                zoomBtn.textContent = zoomed ? 'Reset 1×' : 'Zoom +';
            }

            zoomBtn.addEventListener('click', toggleZoom);
            stage.addEventListener('click', (e) => {
                if (e.target === img || e.target === stage) {
                    toggleZoom();
                }
            });

            viewer.addEventListener('toggle', () => {
                viewer.classList.remove('is-zoomed');
                zoomBtn.setAttribute('aria-pressed', 'false');
                zoomBtn.textContent = 'Zoom +';
            });
        });

        // #6: Native View Transitions on Certificate Modal open/close triggers
        if (typeof document.startViewTransition === 'function' && !prefersReducedMotion) {
            document.querySelectorAll('[popovertarget^="certificate-"]').forEach((btn) => {
                btn.addEventListener('click', (e) => {
                    const targetId = btn.getAttribute('popovertarget');
                    const viewer = targetId ? document.getElementById(targetId) : null;
                    if (!viewer) return;

                    e.preventDefault();
                    const action = btn.getAttribute('popovertargetaction') || 'toggle';
                    const isOpen = viewer.matches(':popover-open');

                    viewer.style.viewTransitionName = 'cert-modal';
                    const transition = document.startViewTransition(() => {
                        if (action === 'hide' || isOpen) {
                            viewer.hidePopover();
                        } else {
                            viewer.showPopover();
                        }
                    });
                    transition.finished.finally(() => {
                        viewer.style.viewTransitionName = '';
                    });
                });
            });
        }
    }

    /* ==========================================================================
       7. FIELD DOSSIER COMMAND PALETTE (Ctrl+K / Cmd+K) & TOAST
       ========================================================================== */
    function initCommandPalette() {
        const headerInner = document.querySelector('.header-inner');
        const contactBtn = document.querySelector('.header-contact');
        if (!headerInner || !contactBtn) return;

        // Wrap header contact & command trigger cleanly
        const actions = document.createElement('div');
        actions.className = 'header-actions';
        contactBtn.parentNode.insertBefore(actions, contactBtn);

        const trigger = document.createElement('button');
        trigger.type = 'button';
        trigger.className = 'cmd-trigger';
        trigger.setAttribute('aria-label', 'Open quick navigation command palette');
        trigger.innerHTML = '<span>Index</span> <kbd>Ctrl K</kbd>';
        actions.appendChild(trigger);
        actions.appendChild(contactBtn);

        // Toast helper
        const toast = document.createElement('div');
        toast.className = 'field-toast';
        toast.setAttribute('role', 'status');
        toast.setAttribute('aria-live', 'polite');
        document.body.appendChild(toast);

        let toastTimer = null;
        function showToast(msg) {
            toast.textContent = msg;
            toast.classList.add('is-visible');
            clearTimeout(toastTimer);
            toastTimer = setTimeout(() => toast.classList.remove('is-visible'), 2800);
        }

        // Command list items
        const commands = [
            { label: 'Go to Profile & 3D Topography', category: 'Section', action: () => location.hash = '#profile' },
            { label: 'Go to Selected Projects', category: 'Section', action: () => location.hash = '#projects' },
            { label: 'Go to Field Experience (80 Hours)', category: 'Section', action: () => location.hash = '#experience' },
            { label: 'Go to Research: The iFind Study', category: 'Section', action: () => location.hash = '#research' },
            { label: 'Go to Seminars & Trainings', category: 'Section', action: () => location.hash = '#training' },
            { label: 'View Certificate: The Medical City Iloilo', category: 'Credential', action: () => document.getElementById('certificate-immersion')?.showPopover() },
            { label: 'View Certificate: The Human Advantage', category: 'Credential', action: () => document.getElementById('certificate-human-advantage')?.showPopover() },
            { label: 'View Certificate: Code, Conscience, & AI', category: 'Credential', action: () => document.getElementById('certificate-ethical-ai')?.showPopover() },
            { label: 'View Certificate: The DevOps Mindset', category: 'Credential', action: () => document.getElementById('certificate-devops')?.showPopover() },
            {
                label: 'Copy Email: jrrd.dev.projects@gmail.com',
                category: 'Contact',
                action: () => {
                    navigator.clipboard?.writeText('jrrd.dev.projects@gmail.com');
                    showToast('Copied jrrd.dev.projects@gmail.com to clipboard');
                }
            },
            { label: 'Open GitHub (@jrrddev)', category: 'External', action: () => window.open('https://github.com/jrrddev', '_blank', 'noopener') }
        ];

        // Build Command Modal DOM
        const backdrop = document.createElement('div');
        backdrop.className = 'cmd-palette-backdrop';
        backdrop.setAttribute('role', 'dialog');
        backdrop.setAttribute('aria-modal', 'true');
        backdrop.setAttribute('aria-label', 'Portfolio Quick Index');
        backdrop.innerHTML = `
            <div class="cmd-palette">
                <div class="cmd-header">
                    <span class="cmd-header-label">Field Index //</span>
                    <input type="text" class="cmd-input" placeholder="Jump to section, certificate, or action..." aria-label="Search commands">
                </div>
                <div class="cmd-list" role="listbox"></div>
                <div class="cmd-footer">
                    <span>↑↓ to navigate · Enter to select</span>
                    <span>ESC to close</span>
                </div>
            </div>
        `;
        document.body.appendChild(backdrop);

        const input = backdrop.querySelector('.cmd-input');
        const listEl = backdrop.querySelector('.cmd-list');
        let selectedIdx = 0;
        let filtered = commands;

        function renderList() {
            listEl.innerHTML = '';
            filtered.forEach((cmd, idx) => {
                const btn = document.createElement('button');
                btn.type = 'button';
                btn.className = `cmd-item ${idx === selectedIdx ? 'is-selected' : ''}`;
                btn.innerHTML = `<span>${cmd.label}</span><span class="cmd-item-cat">${cmd.category}</span>`;
                btn.addEventListener('click', () => {
                    closePalette();
                    cmd.action();
                });
                listEl.appendChild(btn);
            });
        }

        function openPalette() {
            backdrop.classList.add('is-open');
            input.value = '';
            filtered = commands;
            selectedIdx = 0;
            renderList();
            setTimeout(() => input.focus(), 20);
        }

        function closePalette() {
            backdrop.classList.remove('is-open');
        }

        trigger.addEventListener('click', openPalette);
        backdrop.addEventListener('click', (e) => {
            if (e.target === backdrop) closePalette();
        });

        input.addEventListener('input', () => {
            const q = input.value.trim().toLowerCase();
            filtered = commands.filter((c) => c.label.toLowerCase().includes(q) || c.category.toLowerCase().includes(q));
            selectedIdx = 0;
            renderList();
        });

        window.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
                e.preventDefault();
                if (backdrop.classList.contains('is-open')) closePalette();
                else openPalette();
            } else if (backdrop.classList.contains('is-open')) {
                if (e.key === 'Escape') {
                    closePalette();
                } else if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    selectedIdx = (selectedIdx + 1) % Math.max(1, filtered.length);
                    renderList();
                } else if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    selectedIdx = (selectedIdx - 1 + Math.max(1, filtered.length)) % Math.max(1, filtered.length);
                    renderList();
                } else if (e.key === 'Enter' && filtered[selectedIdx]) {
                    e.preventDefault();
                    const cmd = filtered[selectedIdx];
                    closePalette();
                    cmd.action();
                }
            }
        });
    }

    /* ==========================================================================
       8. LENIS SMOOTH INERTIA SCROLLING + SCROLL-VELOCITY TYPOGRAPHY SKEW
       ========================================================================== */
    const scrollBridge = {
        getVelocity: () => 0,
        scrollTo: (target, options = {}) => {
            const y = typeof target === 'number'
                ? target
                : Math.max(0, target.getBoundingClientRect().top + window.scrollY + (options.offset || 0));
            window.scrollTo({
                top: y,
                behavior: options.immediate || prefersReducedMotion ? 'auto' : 'smooth'
            });
        },
        wake: () => {},
        resize: () => {}
    };

    function initLenisAndVelocitySkew() {
        if (prefersReducedMotion) return;

        const root = document.documentElement;
        let lenisInstance = null;
        let lastScrollY = window.scrollY;
        let lastTime = performance.now();
        let rawVelocity = 0;

        // Spring physics state for typography skew & optical stretch
        let currentSkew = 0;
        let skewVelocity = 0;
        let currentShear = 0;
        let currentStretch = 1;

        const skewTargets = Array.from(document.querySelectorAll(
            '.hero h1, .section-title, .project h3, .field-record__hours strong, .field-record__entry h3, .research-copy h3, .study-score, .training-record__title, .training-record__date strong'
        ));
        let lastWrittenTransform = '';
        let scrollRafId = 0;
        let scrollActiveUntil = 0;

        function wakeScrollLoop(durationMs = 450) {
            scrollActiveUntil = Math.max(scrollActiveUntil, performance.now() + durationMs);
            if (!scrollRafId && !perfState.hidden) {
                root.classList.add('is-scrolling');
                scrollRafId = requestAnimationFrame(rafLoop);
            }
        }

        scrollBridge.getVelocity = () => rawVelocity;
        scrollBridge.wake = wakeScrollLoop;

        function setupLenis(LenisCtor) {
            if (!LenisCtor || lenisInstance) return;

            root.classList.add('lenis', 'lenis-smooth');
            lenisInstance = new LenisCtor({
                lerp: 0.088,
                smoothWheel: true,
                wheelMultiplier: 1.0,
                touchMultiplier: 1.5
            });

            scrollBridge.scrollTo = (target, options = {}) => {
                if (!lenisInstance) return;
                wakeScrollLoop(options.immediate ? 140 : Math.round((options.duration || 1.1) * 1000) + 200);
                lenisInstance.scrollTo(target, options);
            };
            scrollBridge.resize = () => {
                if (lenisInstance && typeof lenisInstance.resize === 'function') {
                    lenisInstance.resize();
                }
            };

            // Prevent Lenis from hijacking scroll inside scrollable popovers/command list
            document.querySelectorAll('.cert-stage, .cmd-list').forEach((el) => {
                el.setAttribute('data-lenis-prevent', '');
            });

            // Intercept internal anchor links for silky Lenis scrollTo transitions
            document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
                anchor.addEventListener('click', (e) => {
                    const href = anchor.getAttribute('href');
                    if (!href || href === '#') return;
                    const target = href === '#top' ? 0 : document.querySelector(href);
                    if (target !== null) {
                        e.preventDefault();
                        wakeScrollLoop(1350);
                        lenisInstance.scrollTo(target, {
                            offset: href === '#top' ? 0 : -74,
                            duration: 1.15
                        });
                        history.pushState(null, '', href);
                    }
                });
            });
        }

        // Initialize immediately if UMD script loaded, otherwise fallback to ESM import
        if (typeof window.Lenis === 'function') {
            setupLenis(window.Lenis);
        } else {
            import('https://cdn.jsdelivr.net/npm/lenis@1.1.20/+esm')
                .then((mod) => setupLenis(mod.default || mod.Lenis))
                .catch(() => {});
        }

        // Wake loop on user scroll/wheel/touch/key input
        window.addEventListener('wheel', () => wakeScrollLoop(600), { passive: true });
        window.addEventListener('touchstart', () => wakeScrollLoop(600), { passive: true });
        window.addEventListener('touchmove', () => wakeScrollLoop(600), { passive: true });
        window.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'PageDown' || e.key === 'PageUp' || e.key === ' ' || e.key === 'Home' || e.key === 'End') {
                wakeScrollLoop(600);
            }
        }, { passive: true });

        // Track native scroll velocity as fallback if offline
        window.addEventListener('scroll', () => {
            wakeScrollLoop(450);
            if (lenisInstance) return;
            const now = performance.now();
            const dt = Math.max(8, now - lastTime);
            const dy = window.scrollY - lastScrollY;
            rawVelocity = (dy / dt) * 16.67;
            lastScrollY = window.scrollY;
            lastTime = now;
        }, { passive: true });

        // Spring-damped RAF loop for Scroll-Velocity Typography Skew & Lenis tick (sleeps when settled)
        function rafLoop(time) {
            scrollRafId = 0;
            if (perfState.hidden) return;

            if (lenisInstance) {
                lenisInstance.raf(time);
                rawVelocity = lenisInstance.velocity || 0;
            } else {
                rawVelocity *= 0.86;
            }

            // Target skew (-4.2deg to +4.2deg) & vertical optical stretch
            const targetSkew = Math.max(-4.2, Math.min(4.2, rawVelocity * 0.12));
            const targetShear = Math.max(-1.8, Math.min(1.8, -rawVelocity * 0.05));
            const targetStretch = 1 + Math.min(0.055, Math.abs(rawVelocity) * 0.0014);

            // Spring physics with subtle elastic rebound for skew
            const force = (targetSkew - currentSkew) * 0.16;
            skewVelocity = (skewVelocity + force) * 0.76;
            currentSkew += skewVelocity;

            currentShear += (targetShear - currentShear) * 0.15;
            currentStretch += (targetStretch - currentStretch) * 0.15;

            if (Math.abs(currentSkew) < 0.004 && Math.abs(skewVelocity) < 0.004) {
                currentSkew = 0;
                skewVelocity = 0;
            }
            if (Math.abs(currentShear) < 0.004) currentShear = 0;
            if (Math.abs(currentStretch - 1) < 0.0004) currentStretch = 1;

            const isSettled = currentSkew === 0 && currentShear === 0 && currentStretch === 1;
            const nextTransform = isSettled
                ? ''
                : `skewY(${currentSkew.toFixed(3)}deg) skewX(${currentShear.toFixed(3)}deg) scaleY(${currentStretch.toFixed(4)})`;

            if (nextTransform !== lastWrittenTransform) {
                lastWrittenTransform = nextTransform;
                for (let i = 0; i < skewTargets.length; i++) {
                    skewTargets[i].style.transform = nextTransform;
                }
            }

            const isMoving = Math.abs(rawVelocity) > 0.02 || currentSkew !== 0 || currentShear !== 0 || currentStretch !== 1 || time < scrollActiveUntil;
            if (isMoving) {
                scrollRafId = requestAnimationFrame(rafLoop);
            } else {
                root.classList.remove('is-scrolling');
            }
        }
    }

    /* ==========================================================================
       9. TACTILE MICRO-INTERACTIONS (Magnetic Buttons/Links & Drafting Cursor)
       ========================================================================== */
    function initTactileMicroInteractions() {
        if (prefersReducedMotion) return;

        // 1. Elastic Magnetic Pull on Interactive Buttons & Links
        const magneticSelectors = [
            '.button',
            '.header-contact',
            '.brand',
            '.cmd-trigger',
            '.filter-btn',
            '.project-link',
            '.text-link',
            '.record-link',
            '.certificate-close',
            '.cert-zoom-btn',
            '.socials a',
            '.colophon a[href="#top"]'
        ].join(', ');

        const magneticElements = document.querySelectorAll(magneticSelectors);
        magneticElements.forEach((el) => {
            el.classList.add('is-magnetic');
            const childSpan = el.querySelector('span[aria-hidden="true"]');
            let elRect = null;

            el.addEventListener('pointerenter', () => {
                el.classList.add('is-pulling');
                elRect = el.getBoundingClientRect();
            });

            el.addEventListener('pointermove', (e) => {
                if (!elRect) elRect = el.getBoundingClientRect();
                const cx = elRect.left + elRect.width * 0.5;
                const cy = elRect.top + elRect.height * 0.5;
                const dx = (e.clientX - cx) * 0.24;
                const dy = (e.clientY - cy) * 0.32;

                const maxPullX = Math.min(8, elRect.width * 0.12);
                const maxPullY = Math.min(6, elRect.height * 0.22);
                const pullX = Math.max(-maxPullX, Math.min(maxPullX, dx));
                const pullY = Math.max(-maxPullY, Math.min(maxPullY, dy));

                el.style.transform = `translate3d(${pullX.toFixed(2)}px, ${pullY.toFixed(2)}px, 0)`;
                if (childSpan) {
                    childSpan.style.transform = `translate3d(${(pullX * 0.45).toFixed(2)}px, ${(pullY * 0.45).toFixed(2)}px, 0)`;
                }
            }, { passive: true });

            el.addEventListener('pointerleave', () => {
                el.classList.remove('is-pulling');
                elRect = null;
                el.style.transform = '';
                if (childSpan) {
                    childSpan.style.transform = '';
                }
            });
        });

        // 2. Precision Drafting Crosshair Cursor Follower (Desktop Fine Pointer)
        if (window.matchMedia('(pointer: fine)').matches) {
            const cursor = document.createElement('div');
            cursor.className = 'drafting-cursor';
            cursor.setAttribute('aria-hidden', 'true');
            document.body.appendChild(cursor);

            let mouseX = -100;
            let mouseY = -100;
            let curX = -100;
            let curY = -100;
            let active = false;
            let cursorRafId = 0;

            const interactiveHoverSelector = 'a, button, summary, input, .tags li, .compass, .vernier-rail, .vernier-waypoint';
            let lastHoverTarget = null;
            let lastHoverResult = false;

            function wakeCursor() {
                if (active && !cursorRafId && !perfState.hidden) {
                    cursorRafId = requestAnimationFrame(updateCursor);
                }
            }

            window.addEventListener('pointermove', (e) => {
                mouseX = e.clientX;
                mouseY = e.clientY;
                if (!active) {
                    active = true;
                    curX = mouseX;
                    curY = mouseY;
                    cursor.style.translate = `${curX.toFixed(2)}px ${curY.toFixed(2)}px`;
                    cursor.classList.add('is-active');
                }
                if (e.target !== lastHoverTarget) {
                    lastHoverTarget = e.target;
                    const nextHover = Boolean(e.target && e.target.closest && e.target.closest(interactiveHoverSelector));
                    if (nextHover !== lastHoverResult) {
                        lastHoverResult = nextHover;
                        cursor.classList.toggle('is-hovering', nextHover);
                    }
                }
                wakeCursor();
            }, { passive: true });

            window.addEventListener('pointerdown', () => {
                cursor.classList.add('is-pressed');
            }, { passive: true });

            window.addEventListener('pointerup', () => {
                cursor.classList.remove('is-pressed');
            }, { passive: true });

            document.addEventListener('mouseleave', () => {
                cursor.classList.remove('is-active');
                active = false;
            });

            function updateCursor() {
                cursorRafId = 0;
                if (!active || perfState.hidden) return;
                curX += (mouseX - curX) * 0.22;
                curY += (mouseY - curY) * 0.22;
                cursor.style.translate = `${curX.toFixed(2)}px ${curY.toFixed(2)}px`;

                if (Math.abs(mouseX - curX) > 0.1 || Math.abs(mouseY - curY) > 0.1) {
                    cursorRafId = requestAnimationFrame(updateCursor);
                }
            }
        }

        // 3. Cartographic Survey Sonar Tap / Click Ripple + Tactile Audio Synthesis
        let audioCtx = null;
        function playTapSound(isInteractive) {
            try {
                const AudioContextClass = window.AudioContext || window.webkitAudioContext;
                if (!AudioContextClass) return;
                if (!audioCtx) {
                    audioCtx = new AudioContextClass();
                }
                if (audioCtx.state === 'suspended') {
                    audioCtx.resume();
                }

                const now = audioCtx.currentTime;
                // Loud, punchy dual-oscillator click/blip for clear speaker output
                const osc = audioCtx.createOscillator();
                const subOsc = audioCtx.createOscillator();
                const gain = audioCtx.createGain();

                osc.type = 'square';
                subOsc.type = 'triangle';

                const startFreq = isInteractive ? 920 : 640;
                const endFreq = isInteractive ? 260 : 180;
                const duration = isInteractive ? 0.085 : 0.07;
                const peakGain = isInteractive ? 0.9 : 0.65;

                osc.frequency.setValueAtTime(startFreq, now);
                osc.frequency.exponentialRampToValueAtTime(endFreq, now + duration);

                subOsc.frequency.setValueAtTime(startFreq * 0.5, now);
                subOsc.frequency.exponentialRampToValueAtTime(endFreq * 0.5, now + duration);

                gain.gain.setValueAtTime(peakGain, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

                osc.connect(gain);
                subOsc.connect(gain);
                gain.connect(audioCtx.destination);

                osc.start(now);
                subOsc.start(now);
                osc.stop(now + duration);
                subOsc.stop(now + duration);
            } catch (_) {
                // Ignore if audio is blocked by browser autoplay policy
            }
        }

        const tapInteractiveSelector = 'a, button, summary, input, .tags li, .compass, .portrait-plate';

        window.addEventListener('pointerdown', (e) => {
            if (e.button !== undefined && e.button !== 0) return;

            const isInteractive = Boolean(e.target && e.target.closest && e.target.closest(tapInteractiveSelector));
            const isMobileOrTouch = e.pointerType === 'touch' || window.matchMedia('(max-width: 47rem), (pointer: coarse)').matches;

            // On mobile / touchscreens, ignore normal background touches (like scrolling)
            if (isMobileOrTouch && !isInteractive) return;

            playTapSound(isInteractive);

            const ripple = document.createElement('span');
            ripple.className = 'tap-ripple';
            ripple.setAttribute('aria-hidden', 'true');
            ripple.style.left = `${e.clientX}px`;
            ripple.style.top = `${e.clientY}px`;
            document.body.appendChild(ripple);
            ripple.addEventListener('animationend', () => ripple.remove(), { once: true });
        }, { passive: true });
    }

    /* ==========================================================================
       10. ATMOSPHERIC POLISH (Archival Paper Grain + Chameleon Sticky Header)
       ========================================================================== */
    function initAtmosphericPolish() {
        // #4: Subtle Archival Paper Grain
        const atmosphere = document.createElement('div');
        atmosphere.className = 'paper-atmosphere';
        atmosphere.setAttribute('aria-hidden', 'true');

        // Pre-bake 180x180 archival paper grain tile once (replaces live SVG feTurbulence filter)
        try {
            const grainSize = 180;
            const grainCanvas = document.createElement('canvas');
            grainCanvas.width = grainSize;
            grainCanvas.height = grainSize;
            const grainCtx = grainCanvas.getContext('2d');
            if (grainCtx) {
                const imgData = grainCtx.createImageData(grainSize, grainSize);
                const pixels = imgData.data;
                for (let i = 0; i < pixels.length; i += 4) {
                    pixels[i] = 25;
                    pixels[i + 1] = 60;
                    pixels[i + 2] = 50;
                    pixels[i + 3] = Math.floor(Math.random() * 13); // 0..12 (~4.7% max alpha)
                }
                grainCtx.putImageData(imgData, 0, 0);
                const dataUrl = grainCanvas.toDataURL('image/png');
                atmosphere.style.backgroundImage = `url(${dataUrl})`;
            }
        } catch (_) {
            // Fallback gracefully if canvas is unavailable
        }

        document.body.appendChild(atmosphere);

        // #7: Chameleon Dark / Light Sticky Header over Dark Sections (.toolkit, #experience, #contact)
        const header = document.querySelector('.site-header');
        const darkSections = Array.from(document.querySelectorAll('.toolkit, .field-record, .footer'));
        if (!header || darkSections.length === 0) return;

        let headerProbeOffset = 0;
        let darkZones = [];
        let lastOverDark = null;
        let ticking = false;

        function cacheHeaderZones() {
            const scrollY = window.scrollY;
            const headerRect = header.getBoundingClientRect();
            headerProbeOffset = headerRect.top + headerRect.height * 0.55;
            darkZones = darkSections.map((sec) => {
                const r = sec.getBoundingClientRect();
                return {
                    top: r.top + scrollY,
                    bottom: r.bottom + scrollY
                };
            });
            updateHeaderTheme();
        }

        function updateHeaderTheme() {
            ticking = false;
            const probeDocY = window.scrollY + headerProbeOffset;

            let overDark = false;
            for (let i = 0; i < darkZones.length; i++) {
                const zone = darkZones[i];
                if (zone.top <= probeDocY && zone.bottom >= probeDocY) {
                    overDark = true;
                    break;
                }
            }

            if (overDark !== lastOverDark) {
                lastOverDark = overDark;
                header.classList.toggle('is-dark-surface', overDark);
            }
        }

        cacheHeaderZones();
        window.addEventListener('scroll', () => {
            if (!ticking) {
                ticking = true;
                requestAnimationFrame(updateHeaderTheme);
            }
        }, { passive: true });
        window.addEventListener('resize', cacheHeaderZones, { passive: true });
        if (typeof ResizeObserver === 'function') {
            const headerRo = new ResizeObserver(cacheHeaderZones);
            headerRo.observe(document.documentElement);
            headerRo.observe(header);
        }
        if (document.fonts && document.fonts.ready) {
            document.fonts.ready.then(cacheHeaderZones).catch(() => {});
        }
    }

    /* ==========================================================================
       11. IMAGE PREFETCHING, DECODE REVEAL & SERVICE WORKER CACHING
       ========================================================================== */
    function initImageCachingAndPrefetch() {
        // Smooth decode reveal for project and certificate images that aren't cached yet
        document.querySelectorAll('.browser-frame img, .certificate-viewer img').forEach((img) => {
            if (img.complete && img.naturalWidth > 0) {
                img.classList.add('is-loaded');
                return;
            }
            img.classList.add('is-decoding');
            const markLoaded = () => {
                img.classList.remove('is-decoding');
                img.classList.add('is-loaded');
            };
            if (typeof img.decode === 'function') {
                img.decode().then(markLoaded).catch(() => {
                    img.addEventListener('load', markLoaded, { once: true });
                    img.addEventListener('error', markLoaded, { once: true });
                });
            } else {
                img.addEventListener('load', markLoaded, { once: true });
                img.addEventListener('error', markLoaded, { once: true });
            }
        });

        const prefetchedUrls = new Set();
        function prefetchImage(src) {
            if (!src || prefetchedUrls.has(src)) return;
            prefetchedUrls.add(src);
            const preImg = new Image();
            preImg.decoding = 'async';
            preImg.src = src;
        }

        // Pre-warm certificate image immediately on hover/focus of its trigger button
        document.querySelectorAll('[popovertarget^="certificate-"]').forEach((btn) => {
            const targetId = btn.getAttribute('popovertarget');
            const viewer = targetId ? document.getElementById(targetId) : null;
            const img = viewer ? viewer.querySelector('img') : null;
            if (!img) return;
            const src = img.getAttribute('src');
            const warm = () => {
                img.loading = 'eager';
                prefetchImage(src);
            };
            btn.addEventListener('pointerenter', warm, { once: true, passive: true });
            btn.addEventListener('focus', warm, { once: true, passive: true });
        });

        // Idle background prefetch for certificate popovers (skipped on Data Saver)
        const scheduleIdlePrefetch = () => {
            if (navigator.connection && navigator.connection.saveData) return;
            const run = () => {
                document.querySelectorAll('.certificate-viewer img').forEach((img) => {
                    img.loading = 'eager';
                    prefetchImage(img.getAttribute('src'));
                });
            };
            if (typeof window.requestIdleCallback === 'function') {
                window.requestIdleCallback(run, { timeout: 2500 });
            } else {
                setTimeout(run, 1200);
            }
        };

        if (document.readyState === 'complete') {
            scheduleIdlePrefetch();
        } else {
            window.addEventListener('load', scheduleIdlePrefetch, { once: true });
        }

        // Register Service Worker for instant repeat-visit & offline asset caching
        if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
            window.addEventListener('load', () => {
                navigator.serviceWorker.register('./sw.js').catch(() => {});
            }, { once: true });
        }
    }

    /* ==========================================================================
       12. CARTOGRAPHIC VERNIER & ALTIMETER CUSTOM SCROLLBAR
       ========================================================================== */
    function initCustomScrollbar() {
        const root = document.documentElement;
        const desktopQuery = window.matchMedia('(pointer: fine) and (min-width: 47.01rem)');

        const sectionDefs = [
            { id: 'profile', code: '01', label: 'Profile', scrollTarget: 0 },
            { id: 'projects', code: '02', label: 'Projects' },
            { id: 'experience', code: '03', label: 'Experience' },
            { id: 'research', code: '04', label: 'Research' },
            { id: 'training', code: '05', label: 'Training' },
            { id: 'contact', code: '06', label: 'Contact' }
        ];

        const sections = sectionDefs
            .map((def) => {
                const el = document.getElementById(def.id);
                return el ? { ...def, el } : null;
            })
            .filter(Boolean);

        if (sections.length === 0) return;

        // Build Vernier Scrollbar DOM
        const scrollbar = document.createElement('aside');
        scrollbar.className = 'vernier-scrollbar';
        scrollbar.setAttribute('role', 'scrollbar');
        scrollbar.setAttribute('aria-controls', 'main');
        scrollbar.setAttribute('aria-orientation', 'vertical');
        scrollbar.setAttribute('aria-valuemin', '0');
        scrollbar.setAttribute('aria-valuemax', '100');
        scrollbar.setAttribute('aria-valuenow', '0');
        scrollbar.setAttribute('aria-label', 'Page scroll navigator');

        scrollbar.innerHTML = `
            <span class="vernier-datum vernier-datum--top" aria-hidden="true">00</span>
            <div class="vernier-rail">
                <div class="vernier-ticks" aria-hidden="true"></div>
                <div class="vernier-spine" aria-hidden="true"></div>
                <div class="vernier-progress" aria-hidden="true"></div>
                <div class="vernier-waypoints"></div>
                <div class="vernier-thumb" aria-hidden="true">
                    <span class="vernier-thumb-core"></span>
                    <span class="vernier-thumb-cap vernier-thumb-cap--top"></span>
                    <span class="vernier-thumb-reticle"></span>
                    <span class="vernier-thumb-cap vernier-thumb-cap--bottom"></span>
                </div>
                <div class="vernier-readout" aria-hidden="true">
                    <div class="vernier-readout-row">
                        <span class="vernier-pct">000%</span>
                        <span class="vernier-sec">SEC 01</span>
                    </div>
                    <div class="vernier-elev">EL +048M</div>
                </div>
            </div>
            <span class="vernier-datum vernier-datum--bottom" aria-hidden="true">MAX</span>
        `;

        document.body.appendChild(scrollbar);

        const rail = scrollbar.querySelector('.vernier-rail');
        const waypointsContainer = scrollbar.querySelector('.vernier-waypoints');
        const pctEl = scrollbar.querySelector('.vernier-pct');
        const secEl = scrollbar.querySelector('.vernier-sec');
        const elevEl = scrollbar.querySelector('.vernier-elev');
        const darkEls = Array.from(document.querySelectorAll('.toolkit, .field-record, .footer'));

        const waypoints = sections.map((sec) => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'vernier-waypoint';
            btn.tabIndex = -1;
            btn.setAttribute('aria-label', `Jump to ${sec.label} section`);
            btn.innerHTML = `
                <span class="vernier-waypoint-pip" aria-hidden="true"></span>
                <span class="vernier-waypoint-label">${sec.code} ${sec.label}</span>
            `;

            btn.addEventListener('pointerenter', () => {
                scrollbar.classList.add('is-waypoint-hover');
            });
            btn.addEventListener('pointerleave', () => {
                scrollbar.classList.remove('is-waypoint-hover');
            });
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const target = sec.scrollTarget === 0 ? 0 : sec.el;
                const offset = sec.scrollTarget === 0 ? 0 : -74;
                scrollBridge.scrollTo(target, { offset, duration: 1.05 });
                wakeScrollbar(1150, true);
            });

            waypointsContainer.appendChild(btn);
            return { ...sec, btn, docTop: 0, targetY: 0, ratio: 0 };
        });

        // Layout & geometry caches
        let isEnabled = false;
        let maxScroll = 1;
        let railTop = 85;
        let railHeight = 500;
        let baseThumbHeight = 44;
        let maxThumbY = 456;
        let darkZones = [];

        // Physics & render caches
        let rafId = 0;
        let activeUntil = 0;
        let scrollBadgeUntil = 0;
        let reducedIdleTimer = null;
        let hasRenderedOnce = false;

        let currentLeadY = 0;
        let currentTopY = 0;
        let currentRenderedHeight = 44;
        let lagPx = 0;
        let lagVel = 0;
        let readoutY = 22;

        let lastPct = -1;
        let lastElev = null;
        let lastActiveCode = '';
        let lastThumbY = '';
        let lastExtraPx = '';
        let lastStretch = '';
        let lastReadoutY = '';
        let lastProgress = '';

        // Pointer drag / scrub state
        let isDragging = false;
        let isPendingTrackDrag = false;
        let activePointerId = null;
        let dragStartY = 0;
        let dragGrabOffset = 0;
        let prevDragLeadY = 0;
        let dragVel = 0;

        function measureLayout() {
            const scrollH = document.documentElement.scrollHeight;
            const viewH = window.innerHeight;
            const canScroll = scrollH > viewH + 16;

            const shouldEnable = desktopQuery.matches && canScroll;
            if (shouldEnable !== isEnabled) {
                isEnabled = shouldEnable;
                root.classList.toggle('has-custom-scrollbar', isEnabled);
                scrollbar.style.display = isEnabled ? 'flex' : 'none';
            }

            if (!isEnabled) return;

            maxScroll = Math.max(1, scrollH - viewH);
            const rect = rail.getBoundingClientRect();
            railTop = rect.top;
            railHeight = Math.max(1, rect.height);

            baseThumbHeight = Math.max(34, Math.min(84, Math.round((viewH / Math.max(1, scrollH)) * railHeight)));
            maxThumbY = Math.max(1, railHeight - baseThumbHeight);
            scrollbar.style.setProperty('--thumb-height', `${baseThumbHeight}px`);

            waypoints.forEach((wp) => {
                const elRect = wp.el.getBoundingClientRect();
                const docTop = elRect.top + window.scrollY;
                const targetY = wp.scrollTarget === 0 ? 0 : Math.max(0, Math.min(maxScroll, docTop - 74));
                wp.docTop = docTop;
                wp.targetY = targetY;
                wp.ratio = Math.max(0, Math.min(1, targetY / maxScroll));
                wp.btn.style.setProperty('--wp-ratio', wp.ratio.toFixed(4));
            });

            darkZones = darkEls.map((el) => {
                const r = el.getBoundingClientRect();
                return {
                    top: r.top + window.scrollY,
                    bottom: r.bottom + window.scrollY
                };
            });

            scrollBridge.resize();
        }

        function isDocYDark(docY) {
            for (let i = 0; i < darkZones.length; i++) {
                if (docY >= darkZones[i].top && docY <= darkZones[i].bottom) {
                    return true;
                }
            }
            return false;
        }

        function renderScrollbar(now, forceSnap = false) {
            rafId = 0;
            if (!isEnabled || perfState.hidden) return;

            const scrollY = window.scrollY;
            const ratio = Math.max(0, Math.min(1, scrollY / maxScroll));
            const leadY = ratio * maxThumbY;
            currentLeadY = leadY;

            const velocity = isDragging ? dragVel : scrollBridge.getVelocity();
            if (isDragging) {
                dragVel *= 0.8;
            }

            if (prefersReducedMotion || forceSnap) {
                lagPx = 0;
                lagVel = 0;
            } else {
                const targetLag = Math.max(-52, Math.min(52, -velocity * 1.25));
                const force = (targetLag - lagPx) * 0.19;
                lagVel = (lagVel + force) * 0.73;
                lagPx += lagVel;

                if (Math.abs(targetLag) < 0.04 && Math.abs(lagPx) < 0.08 && Math.abs(lagVel) < 0.08) {
                    lagPx = 0;
                    lagVel = 0;
                }
            }

            const topY = Math.max(0, Math.min(maxThumbY, leadY + Math.min(0, lagPx)));
            const bottomY = Math.min(
                railHeight,
                Math.max(topY + baseThumbHeight, Math.min(maxThumbY, leadY + Math.max(0, lagPx)) + baseThumbHeight)
            );
            const renderedHeight = Math.max(baseThumbHeight, bottomY - topY);
            const extraPx = renderedHeight - baseThumbHeight;
            const stretchScale = renderedHeight / baseThumbHeight;

            currentTopY = topY;
            currentRenderedHeight = renderedHeight;

            const targetReadoutY = Math.max(18, Math.min(railHeight - 18, topY + renderedHeight * 0.5));
            if (prefersReducedMotion || forceSnap || !hasRenderedOnce) {
                readoutY = targetReadoutY;
            } else {
                readoutY += (targetReadoutY - readoutY) * 0.2;
                if (Math.abs(targetReadoutY - readoutY) < 0.08) {
                    readoutY = targetReadoutY;
                }
            }
            hasRenderedOnce = true;

            const nextThumbY = `${topY.toFixed(2)}px`;
            const nextExtraPx = `${extraPx.toFixed(2)}px`;
            const nextStretch = stretchScale.toFixed(4);
            const nextReadoutY = `${readoutY.toFixed(2)}px`;
            const nextProgress = ratio.toFixed(4);

            if (nextThumbY !== lastThumbY) {
                lastThumbY = nextThumbY;
                scrollbar.style.setProperty('--thumb-y', nextThumbY);
            }
            if (nextExtraPx !== lastExtraPx) {
                lastExtraPx = nextExtraPx;
                scrollbar.style.setProperty('--thumb-extra-px', nextExtraPx);
            }
            if (nextStretch !== lastStretch) {
                lastStretch = nextStretch;
                scrollbar.style.setProperty('--thumb-stretch', nextStretch);
            }
            if (nextReadoutY !== lastReadoutY) {
                lastReadoutY = nextReadoutY;
                scrollbar.style.setProperty('--readout-y', nextReadoutY);
            }
            if (nextProgress !== lastProgress) {
                lastProgress = nextProgress;
                scrollbar.style.setProperty('--progress-ratio', nextProgress);
            }

            // Telemetry percentage & simulated depth/elevation readout
            const pct = Math.round(ratio * 100);
            if (pct !== lastPct) {
                lastPct = pct;
                pctEl.textContent = `${String(pct).padStart(3, '0')}%`;
                scrollbar.setAttribute('aria-valuenow', String(pct));
            }

            const elevMeters = Math.round(48 - ratio * 188);
            if (elevMeters !== lastElev) {
                lastElev = elevMeters;
                elevEl.textContent = elevMeters >= 0
                    ? `EL +${String(elevMeters).padStart(3, '0')}M`
                    : `DP -${String(Math.abs(elevMeters)).padStart(3, '0')}M`;
            }

            // Active waypoint detection based on reading line
            const docProbeY = scrollY + window.innerHeight * 0.35;
            let activeWp = waypoints[0];
            if (scrollY >= maxScroll - 24) {
                activeWp = waypoints[waypoints.length - 1];
            } else {
                for (let i = 0; i < waypoints.length; i++) {
                    if (waypoints[i].docTop <= docProbeY) {
                        activeWp = waypoints[i];
                    }
                }
            }

            if (activeWp && activeWp.code !== lastActiveCode) {
                lastActiveCode = activeWp.code;
                secEl.textContent = `SEC ${activeWp.code}`;
                waypoints.forEach((wp) => {
                    wp.btn.classList.toggle('is-active', wp.code === activeWp.code);
                });
            }

            // Chameleon dark-surface contrast check using cached section bounds
            const thumbDocCenterY = scrollY + railTop + topY + renderedHeight * 0.5;
            scrollbar.classList.toggle('is-thumb-dark', isDocYDark(thumbDocCenterY));
            scrollbar.classList.toggle('is-top-dark', isDocYDark(scrollY + railTop - 10));
            scrollbar.classList.toggle('is-bottom-dark', isDocYDark(scrollY + railTop + railHeight + 10));
            scrollbar.classList.toggle('is-rail-dark', isDocYDark(scrollY + railTop + railHeight * 0.5));

            for (let i = 0; i < waypoints.length; i++) {
                const wp = waypoints[i];
                const wpDocY = scrollY + railTop + 4 + wp.ratio * (railHeight - 8);
                wp.btn.classList.toggle('is-on-dark', isDocYDark(wpDocY));
            }

            const showBadge = isDragging || Math.abs(velocity) > 0.05 || now < scrollBadgeUntil;
            scrollbar.classList.toggle('is-scrolling', showBadge);

            const needsContinue = !prefersReducedMotion && (
                isDragging ||
                Math.abs(velocity) > 0.03 ||
                Math.abs(lagPx) > 0.05 ||
                Math.abs(lagVel) > 0.05 ||
                Math.abs(targetReadoutY - readoutY) > 0.1 ||
                now < activeUntil ||
                now < scrollBadgeUntil
            );

            if (needsContinue) {
                rafId = requestAnimationFrame(renderScrollbar);
            } else {
                scrollbar.classList.remove('is-scrolling');
            }
        }

        function wakeScrollbar(durationMs = 700, showBadge = false) {
            if (!isEnabled) return;
            const now = performance.now();
            activeUntil = Math.max(activeUntil, now + durationMs);
            if (showBadge) {
                scrollBadgeUntil = Math.max(scrollBadgeUntil, now + 950);
                if (prefersReducedMotion) {
                    clearTimeout(reducedIdleTimer);
                    reducedIdleTimer = setTimeout(() => {
                        if (!isDragging) scrollbar.classList.remove('is-scrolling');
                    }, 960);
                }
            }
            if (!rafId && !perfState.hidden) {
                rafId = requestAnimationFrame(renderScrollbar);
            }
        }

        // Scroll & wheel listeners
        window.addEventListener('scroll', () => wakeScrollbar(750, true), { passive: true });
        window.addEventListener('wheel', () => wakeScrollbar(850, true), { passive: true });

        // Hover & right-edge proximity detection
        scrollbar.addEventListener('pointerenter', () => {
            scrollbar.classList.add('is-hovering');
            wakeScrollbar(350, false);
        });
        scrollbar.addEventListener('pointerleave', () => {
            scrollbar.classList.remove('is-hovering', 'is-waypoint-hover');
        });

        window.addEventListener('pointermove', (e) => {
            if (!isEnabled || (e.pointerType && e.pointerType !== 'mouse')) return;
            const nearRight = e.clientX >= window.innerWidth - 56;
            scrollbar.classList.toggle('is-near-edge', nearRight);
        }, { passive: true });

        // Direct manipulation: Thumb drag & Track click-to-seek
        rail.addEventListener('pointerdown', (e) => {
            if (!isEnabled || e.button !== 0) return;
            if (e.target && e.target.closest && e.target.closest('.vernier-waypoint')) return;

            const pointerY = e.clientY - railTop;
            activePointerId = e.pointerId;
            dragStartY = e.clientY;

            if (rail.setPointerCapture) {
                try {
                    rail.setPointerCapture(e.pointerId);
                } catch (_) {}
            }

            const insideThumb = pointerY >= currentTopY - 6 && pointerY <= currentTopY + currentRenderedHeight + 6;
            if (insideThumb) {
                dragGrabOffset = Math.max(0, Math.min(baseThumbHeight, pointerY - currentLeadY));
                prevDragLeadY = currentLeadY;
                isDragging = true;
                isPendingTrackDrag = false;
                scrollbar.classList.add('is-dragging');
                wakeScrollbar(500, true);
            } else {
                dragGrabOffset = baseThumbHeight * 0.5;
                const nextLeadY = Math.max(0, Math.min(maxThumbY, pointerY - dragGrabOffset));
                prevDragLeadY = nextLeadY;
                isPendingTrackDrag = true;
                isDragging = false;
                const targetRatio = nextLeadY / maxThumbY;
                scrollBridge.scrollTo(targetRatio * maxScroll, { duration: 0.72 });
                wakeScrollbar(850, true);
            }
        });

        rail.addEventListener('pointermove', (e) => {
            if (!isEnabled || e.pointerId !== activePointerId) return;

            if (isPendingTrackDrag) {
                if (Math.abs(e.clientY - dragStartY) > 4) {
                    isPendingTrackDrag = false;
                    isDragging = true;
                    scrollbar.classList.add('is-dragging');
                } else {
                    return;
                }
            }

            if (!isDragging) return;

            const pointerY = e.clientY - railTop;
            const nextLeadY = Math.max(0, Math.min(maxThumbY, pointerY - dragGrabOffset));
            const nextRatio = nextLeadY / maxThumbY;

            dragVel = Math.max(-36, Math.min(36, (nextLeadY - prevDragLeadY) * 0.85));
            prevDragLeadY = nextLeadY;

            scrollBridge.scrollTo(nextRatio * maxScroll, { immediate: true });
            wakeScrollbar(450, true);
        });

        function finishDrag(e) {
            if (e.pointerId !== activePointerId) return;
            if (rail.hasPointerCapture && rail.hasPointerCapture(e.pointerId)) {
                try {
                    rail.releasePointerCapture(e.pointerId);
                } catch (_) {}
            }
            isDragging = false;
            isPendingTrackDrag = false;
            activePointerId = null;
            dragVel = 0;
            scrollbar.classList.remove('is-dragging');
            wakeScrollbar(650, false);
        }

        rail.addEventListener('pointerup', finishDrag);
        rail.addEventListener('pointercancel', finishDrag);

        // Layout updates on resize, content filtering, fonts load, or mode switch
        const refreshLayout = () => {
            measureLayout();
            if (isEnabled) {
                renderScrollbar(performance.now(), !hasRenderedOnce);
            }
        };

        window.addEventListener('resize', refreshLayout, { passive: true });
        if (typeof desktopQuery.addEventListener === 'function') {
            desktopQuery.addEventListener('change', refreshLayout);
        }
        if (typeof ResizeObserver === 'function') {
            new ResizeObserver(refreshLayout).observe(document.documentElement);
        }
        if (document.fonts && document.fonts.ready) {
            document.fonts.ready.then(refreshLayout).catch(() => {});
        }

        perfState.visibilityListeners.add((visible) => {
            if (visible && isEnabled) {
                measureLayout();
                renderScrollbar(performance.now(), true);
            }
        });

        measureLayout();
        renderScrollbar(performance.now(), true);
    }

    /* ==========================================================================
       INITIALIZE ALL MODULES ON DOM READY
       ========================================================================== */
    function init() {
        initHero3DTopography();
        initFieldRecordCanvas();
        initCompassAndTilt();
        initTelemetryAndReveals();
        initProjectFilters();
        initCertificateZoom();
        initCommandPalette();
        initLenisAndVelocitySkew();
        initTactileMicroInteractions();
        initAtmosphericPolish();
        initImageCachingAndPrefetch();
        initCustomScrollbar();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();

